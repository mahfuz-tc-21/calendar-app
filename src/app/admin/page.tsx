'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/context/ToastContext'
import { Loader2, Shield, RefreshCw, LogOut, ArrowLeft, Laptop, Smartphone, User, ChevronRight, Trash2, ImageIcon, FileText, Calendar, HardDrive } from 'lucide-react'

interface Device {
  id: string
  user_id: string
  device_id: string
  device_name: string
  device_model: string
  platform: string
  os_version: string
  app_version: string
  is_online: boolean
  last_seen: string
  created_at: string
  updated_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string
  last_seen: string
}

interface MediaMetadata {
  id: string
  device_id: string
  media_store_id: string
  file_name: string
  mime_type: string
  width: number
  height: number
  size: number
  created_at: string
  modified_at: string
  media_type: string
  indexed_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { showToast } = useToast()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Data State
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [mediaItems, setMediaItems] = useState<MediaMetadata[]>([])
  
  // Loaders
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Verify Admin Role on Mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/login')
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()

        if (error || !profile || !profile.is_admin) {
          showToast('Access Denied: Administrators only.', 'error')
          setTimeout(() => router.replace('/calendar'), 2000)
          return
        }

        setIsAdmin(true)
        await fetchData()
      } catch (err) {
        console.error('Admin auth check error:', err)
        router.replace('/calendar')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/devices')
      if (!res.ok) {
        throw new Error('Failed to fetch admin data')
      }
      const data = await res.json()
      if (data.success) {
        setProfiles(data.profiles || [])
        setDevices(data.devices || [])
      }
    } catch (err: any) {
      showToast(err.message || 'Error fetching dashboard data', 'error')
    }
  }

  const fetchMedia = async (deviceId: string) => {
    setLoadingMedia(true)
    try {
      const res = await fetch(`/api/admin/media?deviceId=${deviceId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch media metadata')
      }
      const data = await res.json()
      if (data.success) {
        setMediaItems(data.media || [])
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading media metadata cache', 'error')
    } finally {
      setLoadingMedia(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    if (selectedDevice) {
      await fetchMedia(selectedDevice.id)
    }
    setIsRefreshing(false)
    showToast('Dashboard data reloaded.', 'success')
  }

  const handleRemoveDevice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting device when clicking remove button
    if (!confirm('Are you sure you want to remove this device? It will be completely unregistered.')) return
    setIsRemovingId(id)
    try {
      const res = await fetch('/api/admin/devices/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('Device removed successfully', 'success')
        await fetchData()
        if (selectedDevice && selectedDevice.id === id) {
          setSelectedDevice(null)
          setMediaItems([])
        }
      } else {
        showToast(data.error || 'Failed to remove device', 'error')
      }
    } catch (err) {
      showToast('Error removing device', 'error')
    } finally {
      setIsRemovingId(null)
    }
  }

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile)
    setSelectedDevice(null)
    setMediaItems([])
  }

  const handleSelectDevice = async (device: Device) => {
    setSelectedDevice(device)
    await fetchMedia(device.id)
  }

  const isDeviceOnline = (lastSeenStr: string) => {
    const lastSeen = new Date(lastSeenStr).getTime()
    const now = Date.now()
    return now - lastSeen < 3 * 60 * 1000 // online if seen in last 3 minutes
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 text-foreground">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground mt-2">Checking administrative portal credentials...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 text-foreground p-6 text-center">
        <Shield className="w-12 h-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          You do not have administrative privileges. Redirecting back...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-foreground p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
        
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            {selectedProfile && (
              <button
                onClick={() => {
                  if (selectedDevice) {
                    setSelectedDevice(null)
                    setMediaItems([])
                  } else {
                    setSelectedProfile(null)
                  }
                }}
                className="p-2 border border-border bg-card rounded-xl hover:bg-secondary transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                title="Go Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Remote Gallery Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDevice 
                  ? `Device: ${selectedDevice.device_name} (${selectedDevice.device_model})` 
                  : selectedProfile 
                  ? `Devices registered under: ${selectedProfile.display_name || selectedProfile.username}`
                  : 'Manage registered user accounts and their gallery capability'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 border border-border bg-card hover:bg-secondary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => router.push('/calendar')}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>
        </header>

        {/* View 1: List All Profiles (Accounts) */}
        {!selectedProfile && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-foreground pl-1">All User Accounts</h2>
            {profiles.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
                <p className="text-sm text-muted-foreground">No registered accounts found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map((profile) => {
                  const userDevices = devices.filter((d) => d.user_id === profile.id)
                  const onlineCount = userDevices.filter((d) => isDeviceOnline(d.last_seen)).length
                  
                  return (
                    <div
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile)}
                      className="p-6 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-lg text-muted-foreground overflow-hidden shrink-0">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                          ) : (
                            profile.display_name?.charAt(0).toUpperCase() || profile.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {profile.display_name || profile.username}
                          </h3>
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full font-semibold text-muted-foreground">
                              {userDevices.length} {userDevices.length === 1 ? 'Device' : 'Devices'}
                            </span>
                            {onlineCount > 0 && (
                              <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                {onlineCount} Online
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* View 2: List Selected User's Devices */}
        {selectedProfile && !selectedDevice && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pl-1">
              <h2 className="text-base font-bold text-foreground">
                Devices under {selectedProfile.display_name || selectedProfile.username}
              </h2>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                Back to all accounts
              </button>
            </div>

            {devices.filter((d) => d.user_id === selectedProfile.id).length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
                <p className="text-sm text-muted-foreground">No devices registered under this account.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {devices
                  .filter((d) => d.user_id === selectedProfile.id)
                  .map((device) => {
                    const online = isDeviceOnline(device.last_seen)
                    
                    return (
                      <div
                        key={device.id}
                        onClick={() => handleSelectDevice(device)}
                        className="p-6 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-secondary rounded-xl text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                              {device.platform === 'android' ? (
                                <Smartphone className="w-6 h-6" />
                              ) : (
                                <Laptop className="w-6 h-6" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                {device.device_name}
                              </h3>
                              <p className="text-xs text-muted-foreground">Model: {device.device_model}</p>
                              <p className="text-[10px] text-muted-foreground">
                                OS: {device.os_version} • App: v{device.app_version}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Last seen: {new Date(device.last_seen).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              online 
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                : 'bg-gray-500/10 text-gray-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/60 pt-4 mt-2">
                          <button
                            onClick={(e) => handleRemoveDevice(device.id, e)}
                            disabled={isRemovingId === device.id}
                            className="px-3 py-1.5 border border-red-200 dark:border-red-950/60 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isRemovingId === device.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Remove Device</span>
                          </button>

                          <span className="text-xs font-bold text-primary group-hover:underline flex items-center gap-1">
                            <span>Open Gallery</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* View 3: Selected Device's Remote Gallery Metadata */}
        {selectedProfile && selectedDevice && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-1">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Remote Gallery Cache: {selectedDevice.device_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Device Model: {selectedDevice.device_model} • Account: {selectedProfile.display_name || selectedProfile.username}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedDevice(null)
                  setMediaItems([])
                }}
                className="text-xs text-primary font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0 self-start sm:self-center"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to devices</span>
              </button>
            </div>

            {loadingMedia ? (
              <div className="p-16 text-center bg-card border border-border rounded-2xl flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">Loading remote media metadata cache...</p>
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-border rounded-2xl bg-card space-y-2">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No media metadata cached</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Either the device hasn't completed synchronization yet or no photos exist in its MediaStore database.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cache Stats Info Box */}
                <div className="p-4 bg-secondary/50 border border-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-primary" />
                    <span>Metadata Count: <strong>{mediaItems.length} items</strong> cached</span>
                  </div>
                  <span>Note: Image downloads are deferred to Phase 3. Currently showing index metadata details.</span>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {mediaItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-card border border-border rounded-xl overflow-hidden flex flex-col group select-none shadow-xs"
                    >
                      {/* Image Thumbnail Placeholder */}
                      <div className="aspect-square bg-secondary flex flex-col items-center justify-center gap-2 relative border-b border-border/60">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/60 group-hover:scale-105 transition-transform duration-250" />
                        <span className="text-[9px] font-bold text-muted-foreground bg-card border border-border/80 px-2 py-0.5 rounded-full">
                          {item.width} x {item.height}
                        </span>
                      </div>
                      
                      {/* Info */}
                      <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
                        <p className="text-[10px] font-bold text-foreground truncate pl-0.5" title={item.file_name}>
                          {item.file_name}
                        </p>
                        <div className="flex items-center justify-between text-[8px] text-muted-foreground font-semibold">
                          <span className="flex items-center gap-0.5 uppercase">
                            <FileText className="w-2.5 h-2.5" />
                            {item.mime_type.split('/')[1] || 'img'}
                          </span>
                          <span>{formatBytes(item.size)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[8px] text-muted-foreground border-t border-border/40 pt-1.5 mt-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
