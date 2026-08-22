'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Network } from '@capacitor/network'
import { App } from '@capacitor/app'
import { Download, AlertTriangle, Info, X, RefreshCw } from 'lucide-react'

// Define types for our custom plugin
interface AppInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
}

interface InstallPermissionResult {
  allowed: boolean;
}

interface AutoUpdatePluginType {
  getAppInfo(): Promise<AppInfo>;
  checkInstallPermission(): Promise<InstallPermissionResult>;
  requestInstallPermission(): Promise<void>;
  downloadAndInstall(options: { url: string; sha256?: string }): Promise<{ status: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { progress?: number; status: string; error?: string }) => void
  ): Promise<any>;
}

const AutoUpdate = registerPlugin<AutoUpdatePluginType>('AutoUpdate');

interface UpdateMetadata {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  mandatory: boolean;
  releaseNotes?: string[];
  minimumSupportedVersionCode?: number;
  sha256?: string;
}

interface AutoUpdateContextType {
  checkForUpdate: (force?: boolean) => Promise<void>;
  isChecking: boolean;
}

const AutoUpdateContext = createContext<AutoUpdateContextType | undefined>(undefined);

export function AutoUpdateProvider({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateMetadata | null>(null);
  const [currentVersionInfo, setCurrentVersionInfo] = useState<AppInfo | null>(null);
  const [isMandatory, setIsMandatory] = useState(false);

  // Download & Install State
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'installing' | 'failed'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Permission Flow State
  const [waitingForPermission, setWaitingForPermission] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  const downloadListenerRef = useRef<any>(null);

  const getManifestUrl = (): string | null => {
    if (process.env.NEXT_PUBLIC_UPDATE_MANIFEST_URL) {
      return process.env.NEXT_PUBLIC_UPDATE_MANIFEST_URL;
    }
    const host = process.env.NEXT_PUBLIC_HOSTED_URL;
    if (host) {
      // Ensure trailing slash behavior
      const base = host.endsWith('/') ? host.slice(0, -1) : host;
      return `${base}/latest.json`;
    }
    return null;
  };

  const checkForUpdate = async (force = false) => {
    // Only run on native Android
    if (Capacitor.getPlatform() !== 'android') return;

    // Check network connectivity first
    const netStatus = await Network.getStatus();
    if (!netStatus.connected) return;

    const manifestUrl = getManifestUrl();
    if (!manifestUrl) {
      console.warn('AutoUpdate: Update manifest URL is not configured.');
      return;
    }

    // Cache throttle check: 12 hours
    const now = Date.now();
    const THROTTLE_MS = 12 * 60 * 60 * 1000;
    if (!force) {
      try {
        const { value: lastCheck } = await Preferences.get({ key: 'last_update_check_time' });
        if (lastCheck && now - parseInt(lastCheck, 10) < THROTTLE_MS) {
          return; // Skip checking to save bandwidth
        }
      } catch (e) {
        // Silently continue if preferences fail
      }
    }

    setIsChecking(true);

    try {
      // Fetch latest metadata
      const res = await fetch(manifestUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const latest: UpdateMetadata = await res.json();

      // Retrieve current app information
      const current = await AutoUpdate.getAppInfo();
      setCurrentVersionInfo(current);

      // Validate metadata versionCode & compare
      if (latest && typeof latest.versionCode === 'number' && latest.versionCode > current.versionCode) {
        setUpdateInfo(latest);

        // Determine if mandatory
        const minSupported = latest.minimumSupportedVersionCode || 0;
        const mustUpdate = latest.mandatory || current.versionCode < minSupported;
        setIsMandatory(mustUpdate);
        setShowModal(true);

        // Record successful update check time
        await Preferences.set({ key: 'last_update_check_time', value: now.toString() });
      }
    } catch (err) {
      console.error('AutoUpdate check failed:', err);
      // Fail silently without blocking the user
    } finally {
      setIsChecking(false);
    }
  };

  // Perform initial update check and setup background listeners
  useEffect(() => {
    checkForUpdate(false);

    // Re-check when app returns from background
    const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkForUpdate(false);
      }
    });

    return () => {
      resumeListener.then(l => l.remove());
    };
  }, []);

  // Set up listeners for background download progress
  const startDownload = async () => {
    if (!updateInfo) return;

    try {
      setDownloadError(null);
      setDownloadProgress(0);
      setDownloadStatus('downloading');

      // Check package installation permission
      const perm = await AutoUpdate.checkInstallPermission();
      if (!perm.allowed) {
        setShowPermissionPrompt(true);
        return;
      }

      // Remove any existing listeners first
      if (downloadListenerRef.current) {
        await downloadListenerRef.current.remove();
        downloadListenerRef.current = null;
      }

      // Start listening to the progress events
      downloadListenerRef.current = await AutoUpdate.addListener('downloadProgress', (info) => {
        if (info.status === 'downloading' && typeof info.progress === 'number') {
          setDownloadProgress(info.progress);
        } else if (info.status === 'installing') {
          setDownloadStatus('installing');
          // Close modal since installer has opened
          if (!isMandatory) {
            handleClose();
          }
        } else if (info.status === 'failed') {
          setDownloadStatus('failed');
          setDownloadError(info.error || 'Failed to download updates.');
        }
      });

      // Start downloading natively
      await AutoUpdate.downloadAndInstall({
        url: updateInfo.apkUrl,
        sha256: updateInfo.sha256
      });

    } catch (err: any) {
      console.error('Failed to start update download:', err);
      setDownloadStatus('failed');
      setDownloadError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleGrantPermission = async () => {
    setShowPermissionPrompt(false);
    setWaitingForPermission(true);
    await AutoUpdate.requestInstallPermission();

    // Set up a one-time resume listener to check if permission was granted
    const onResume = App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && waitingForPermission) {
        setWaitingForPermission(false);
        onResume.then(l => l.remove());

        const perm = await AutoUpdate.checkInstallPermission();
        if (perm.allowed) {
          startDownload();
        } else {
          setDownloadStatus('failed');
          setDownloadError('Permission to install apps from this source was denied.');
        }
      }
    });
  };

  const handleClose = async () => {
    if (isMandatory) return; // Cannot bypass mandatory update
    setShowModal(false);
    // Cleanup listeners
    if (downloadListenerRef.current) {
      await downloadListenerRef.current.remove();
      downloadListenerRef.current = null;
    }
    setDownloadStatus('idle');
    setDownloadProgress(0);
    setDownloadError(null);
  };

  return (
    <AutoUpdateContext.Provider value={{ checkForUpdate, isChecking }}>
      {children}

      {/* Modern Overlay & Modal Dialog */}
      {showModal && updateInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Close Button (only for optional updates) */}
            {!isMandatory && downloadStatus !== 'downloading' && downloadStatus !== 'installing' && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Header Icon */}
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                <Download className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isMandatory ? 'Required Update' : 'New Update Available'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentVersionInfo ? `Version ${currentVersionInfo.versionName}` : ''} → Version {updateInfo.versionName}
                </p>
              </div>
            </div>

            {/* Content States */}
            {downloadStatus === 'idle' && !showPermissionPrompt && (
              <>
                <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-4 mb-6 max-h-40 overflow-y-auto custom-scrollbar">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What's New</h4>
                  {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 ? (
                    <ul className="space-y-1.5">
                      {updateInfo.releaseNotes.map((note, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-blue-500 shrink-0 mt-1">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No release notes provided.</p>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  {!isMandatory && (
                    <button
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                    >
                      Later
                    </button>
                  )}
                  <button
                    onClick={startDownload}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm shadow-blue-200 dark:shadow-none flex items-center justify-center gap-1.5"
                  >
                    Update Now
                  </button>
                </div>
              </>
            )}

            {/* Permission Prompt Modal state */}
            {showPermissionPrompt && (
              <div className="mb-4">
                <div className="flex gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl mb-5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    To install updates, Android requires permission to allow install settings from this app.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  {!isMandatory && (
                    <button
                      onClick={() => setShowPermissionPrompt(false)}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleGrantPermission}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm shadow-blue-200 dark:shadow-none"
                  >
                    Open Settings
                  </button>
                </div>
              </div>
            )}

            {/* Downloading & Progress display */}
            {(downloadStatus === 'downloading' || downloadStatus === 'installing') && (
              <div className="my-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {downloadStatus === 'installing' ? 'Opening installer...' : 'Downloading update...'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                  Do not close the app while update is in progress.
                </p>
              </div>
            )}

            {/* Failure state */}
            {downloadStatus === 'failed' && (
              <div className="my-4">
                <div className="flex gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-2xl mb-5">
                  <Info className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-300">
                    {downloadError || 'Update download failed.'}
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  {!isMandatory && (
                    <button
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={startDownload}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm shadow-blue-200 dark:shadow-none flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </AutoUpdateContext.Provider>
  );
}

export function useAutoUpdate() {
  const context = useContext(AutoUpdateContext);
  if (!context) {
    throw new Error('useAutoUpdate must be used within an AutoUpdateProvider');
  }
  return context;
}
