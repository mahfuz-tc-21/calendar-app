'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/context/ToastContext'
import { Loader2, Plus, Shield, RefreshCw, Key, LogOut, ArrowLeft, ToggleLeft, ToggleRight, Laptop, Smartphone } from 'lucide-react'

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
  is_paired: boolean
  paired_at: string
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

export default function AdminDashboard() {
  const router = useRouter()
  const { showToast } = useToast()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [pairingCodeExpires, setPairingCodeExpires] = useState<string | null>(null)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [isUnpairingId, setIsUnpairingId] = useState<string | null>(null)
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
    showToast('Dashboard data reloaded.', 'success')
  }

  const handleGeneratePairingCode = async () => {
    setIsGeneratingCode(true)
    try {
      const res = await fetch('/api/admin/pairing/generate', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setPairingCode(data.code)
        setPairingCodeExpires(data.expiresAt)
        showToast('Pairing code generated!', 'success')
      } else {
        showToast(data.error || 'Failed to generate code', 'error')
      }
    } catch (err) {
      showToast('Error generating pairing code', 'error')
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const handleUnpairDevice = async (id: string) => {
    if (!confirm('Are you sure you want to unpair this device? It will lose authorization.')) return
    setIsUnpairingId(id)
    try {
      const res = await fetch('/api/admin/devices/unpair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('Device unpaired successfully', 'success')
        await fetchData()
      } else {
        showToast(data.error || 'Failed to unpair device', 'error')
      }
    } catch (err) {
      showToast('Error unpairing device', 'error')
    } finally {
      setIsUnpairingId(null)
    }
  }

  const isDeviceOnline = (lastSeenStr: string) => {
    const lastSeen = new Date(lastSeenStr).getTime()
    const now = Date.now()
    return now - lastSeen < 3 * 60 * 1000 // consider online if seen in last 3 minutes
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
          You do not have administrative privileges. Redirecting back to the main Calendar page...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-foreground p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/calendar')}
              className="p-2 border border-border bg-card rounded-xl hover:bg-secondary transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              title="Back to Calendar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage paired devices and authorized accounts</p>
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
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Generate Pairing Code Widget */}
          <div className="space-y-6">
            <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Key className="w-4 h-4" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Device Authorization</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate a temporary, single-use pairing code to authorize a new device. The code expires in 15 minutes.
              </p>
              
              {pairingCode ? (
                <div className="p-4 bg-secondary rounded-xl border border-border text-center space-y-2 animate-in fade-in zoom-in duration-200">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    Active Pairing Code
                  </span>
                  <span className="text-2xl font-mono font-extrabold text-primary tracking-wider block">
                    {pairingCode}
                  </span>
                  {pairingCodeExpires && (
                    <span className="text-[10px] text-muted-foreground block">
                      Expires: {new Date(pairingCodeExpires).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ) : null}

              <button
                onClick={handleGeneratePairingCode}
                disabled={isGeneratingCode}
                className="w-full py-2.5 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isGeneratingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Generate Pairing Code</span>
              </button>
            </div>
          </div>

          {/* Right Column: User Accounts & Registered Devices */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-base font-bold text-foreground pl-1">Authorized User Accounts & Paired Devices</h2>
            
            {profiles.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-2xl bg-card">
                <p className="text-sm text-muted-foreground">No accounts found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => {
                  const userDevices = devices.filter((d) => d.user_id === profile.id)
                  
                  return (
                    <div key={profile.id} className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4">
                      
                      {/* Profile info header */}
                      <div className="flex items-center justify-between pb-3 border-b border-border/60">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center font-bold text-sm">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                            ) : (
                              profile.display_name?.charAt(0).toUpperCase() || profile.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">{profile.display_name || profile.username}</h3>
                            <p className="text-[10px] text-muted-foreground">@{profile.username}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Last active: {new Date(profile.last_seen).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Device Listing */}
                      <div className="space-y-3">
                        {userDevices.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic pl-1">
                            No devices registered under this account.
                          </p>
                        ) : (
                          userDevices.map((device) => {
                            const online = isDeviceOnline(device.last_seen)
                            
                            return (
                              <div key={device.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-secondary/40 border border-border/80 rounded-xl gap-3">
                                
                                {/* Device info */}
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    {device.platform === 'android' ? (
                                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <Laptop className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-foreground">{device.device_name}</span>
                                      
                                      {/* Status bubble */}
                                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                        online 
                                          ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                          : 'bg-gray-500/10 text-gray-500'
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                        {online ? 'Online' : 'Offline'}
                                      </span>

                                      {/* Pairing badge */}
                                      {device.is_paired && (
                                        <span className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                          Paired
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-normal">
                                      Model: {device.device_model} • OS: {device.os_version} • App: v{device.app_version}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">
                                      Last seen: {new Date(device.last_seen).toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Unpair Button */}
                                <div>
                                  {device.is_paired ? (
                                    <button
                                      onClick={() => handleUnpairDevice(device.id)}
                                      disabled={isUnpairingId === device.id}
                                      className="px-3 py-1.5 border border-red-200 dark:border-red-950 text-red-600 dark:text-red-400 bg-card hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      {isUnpairingId === device.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : null}
                                      <span>Unpair</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground font-semibold italic p-1 block">
                                      Unpaired
                                    </span>
                                  )}
                                </div>

                              </div>
                            )
                          })
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
