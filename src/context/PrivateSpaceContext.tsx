'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { getApiUrl, getAuthHeaders } from '@/utils/api'
import { createClient } from '@/utils/supabase/client'

async function getHeaders() {
  const authHeaders = await getAuthHeaders()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('private_space_token')
    if (token) {
      headers['x-private-space-token'] = token
    }
  }
  return headers
}

interface PrivateSpaceContextType {
  isUnlocked: boolean
  hasPasscode: boolean
  loading: boolean
  checkPasscodeStatus: () => Promise<void>
  unlock: (passcode: string, silent?: boolean) => Promise<boolean>
  setupPasscode: (passcode: string) => Promise<boolean>
  lock: () => Promise<void>
}

const PrivateSpaceContext = createContext<PrivateSpaceContextType | undefined>(undefined)

export function PrivateSpaceProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('private_space_token')
    }
    return false
  })
  const [hasPasscode, setHasPasscode] = useState(false)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const { user, isLoading: authLoading } = useAuth()

  const checkPasscodeStatus = useCallback(async () => {
    if (authLoading) return // Wait for AuthContext to resolve the initial user session

    if (!user) {
      setHasPasscode(false)
      setIsUnlocked(false)
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      const reqHeaders = await getHeaders()
      // Check passcode status and verify session in a single API call
      const checkRes = await fetch(getApiUrl('/api/private/check'), {
        headers: reqHeaders,
      })

      if (!checkRes.ok) {
        throw new Error(`Passcode check failed with status: ${checkRes.status}`)
      }

      const checkData = await checkRes.json()
      const exists = !!checkData.exists
      setHasPasscode(exists)
      setIsUnlocked(!!checkData.unlocked)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('has_privacy_passcode_' + user.id, exists ? 'true' : 'false')
      }
      
      if (!checkData.unlocked && typeof window !== 'undefined') {
        localStorage.removeItem('private_space_token')
      }
    } catch (err) {
      console.error('Error checking private space status:', err)
      // Fallback to local hash existence or cached passcode status when offline/unauthorized token refresh
      if (typeof window !== 'undefined' && user) {
        const localHash = localStorage.getItem('local_privacy_hash')
        const cachedHasPasscode = localStorage.getItem('has_privacy_passcode_' + user.id)
        if (localHash || cachedHasPasscode === 'true') {
          setHasPasscode(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('private_space_token')
      if (token) {
        setIsUnlocked(true)
      }
      if (user) {
        const cachedHasPasscode = localStorage.getItem('has_privacy_passcode_' + user.id)
        if (cachedHasPasscode !== null) {
          setHasPasscode(cachedHasPasscode === 'true')
        }
      }
    }
    checkPasscodeStatus()
  }, [checkPasscodeStatus, user, authLoading])

  // Handle native screenshot and screen-recording blocking (FLAG_SECURE) inside Private Space
  useEffect(() => {
    const togglePrivacyScreen = async () => {
      if (typeof window === 'undefined') return
      const cap = (window as any).Capacitor
      if (cap && cap.isPluginAvailable('PrivacyScreen')) {
        try {
          const { PrivacyScreen } = require('@capacitor-community/privacy-screen')
          if (isUnlocked) {
            await PrivacyScreen.enable()
            console.log('Android Native Privacy Screen Enabled (screenshots/recordings blocked)')
          } else {
            await PrivacyScreen.disable()
            console.log('Android Native Privacy Screen Disabled')
          }
        } catch (e) {
          console.error('Failed to toggle native PrivacyScreen plugin:', e)
        }
      }
    }

    togglePrivacyScreen()

    return () => {
      // Restore normal screen state on unmount
      if (typeof window !== 'undefined') {
        const cap = (window as any).Capacitor
        if (cap && cap.isPluginAvailable('PrivacyScreen')) {
          try {
            const { PrivacyScreen } = require('@capacitor-community/privacy-screen')
            PrivacyScreen.disable()
          } catch {}
        }
      }
    }
  }, [isUnlocked])

  const lock = useCallback(async () => {
    try {
      const reqHeaders = await getHeaders()
      await fetch(getApiUrl('/api/private/lock'), { 
        method: 'POST',
        headers: reqHeaders,
      })
    } catch (err) {
      console.error('Error calling lock API:', err)
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('private_space_token')
      }
      setIsUnlocked(false)
    }
  }, [])

  const unlock = useCallback(async (passcode: string, silent?: boolean): Promise<boolean> => {
    // 1. Perform local instant hash check to unlock the UI immediately
    let isLocalMatch = false
    if (typeof window !== 'undefined') {
      try {
        const localHash = localStorage.getItem('local_privacy_hash')
        if (localHash) {
          const encoder = new TextEncoder()
          const dataBytes = encoder.encode(passcode)
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          
          if (computedHash === localHash) {
            isLocalMatch = true
            setIsUnlocked(true)
          }
        }
      } catch (e) {
        console.error('Failed local instant hash check:', e)
      }
    }

    const runBackendUnlock = async () => {
      try {
        const reqHeaders = await getHeaders()
        const res = await fetch(getApiUrl('/api/private/unlock'), {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({ passcode }),
        })

        const data = await res.json()

        if (res.ok && data.success) {
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('private_space_token', data.token)
            
            // Save local hash for subsequent instant unlocks
            try {
              const encoder = new TextEncoder()
              const dataBytes = encoder.encode(passcode)
              const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes)
              const hashArray = Array.from(new Uint8Array(hashBuffer))
              const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
              localStorage.setItem('local_privacy_hash', computedHash)
            } catch (hErr) {
              console.error('Failed to cache local privacy hash:', hErr)
            }
          }
          setIsUnlocked(true)
          if (!silent && !isLocalMatch) showToast('Private space unlocked', 'success')
          return true
        } else {
          // If local check was bypassed incorrectly, lock it back
          if (isLocalMatch) {
            setIsUnlocked(false)
            if (typeof window !== 'undefined') {
              localStorage.removeItem('private_space_token')
            }
          }
          if (!silent) showToast(data.error || 'Unable to unlock private space.', 'error')
          return false
        }
      } catch (err) {
        console.error('Unlock error details:', err)
        // If background fails due to network offline but they had a local match, keep them unlocked
        if (isLocalMatch) {
          return true
        }
        if (!silent) showToast('Connection error. Failed to unlock.', 'error')
        return false
      }
    }

    if (isLocalMatch) {
      // Fire backend API in background and resolve instantly
      runBackendUnlock()
      return true
    } else {
      // Run and await backend
      return await runBackendUnlock()
    }
  }, [showToast])

  const setupPasscode = useCallback(async (passcode: string): Promise<boolean> => {
    try {
      const reqHeaders = await getHeaders()
      const res = await fetch(getApiUrl('/api/private/setup'), {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ passcode }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Cache the local hash for instant unlocking
        if (typeof window !== 'undefined') {
          try {
            const encoder = new TextEncoder()
            const dataBytes = encoder.encode(passcode)
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
            localStorage.setItem('local_privacy_hash', computedHash)
            if (user) {
              localStorage.setItem('has_privacy_passcode_' + user.id, 'true')
            }
          } catch (hErr) {
            console.error('Failed to cache local privacy hash during setup:', hErr)
          }
        }

        setHasPasscode(true)
        showToast('Passcode configured successfully', 'success')
        // Automatically unlock after setting it up
        return await unlock(passcode)
      } else {
        showToast(data.error || 'Failed to setup passcode.', 'error')
        return false
      }
    } catch (err) {
      console.error('Setup passcode error details:', err)
      showToast('Connection error. Failed to configure passcode.', 'error')
      return false
    }
  }, [unlock, showToast])

  // Listen to background app suspension / switching to lock the private space
  useEffect(() => {
    if (typeof window === 'undefined') return
    const cap = (window as any).Capacitor
    let appStateListener: any = null
    let isMounted = true

    const handleWebVisibility = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && isMounted) {
        console.log('Web tab hidden. Locking private space and returning to calendar.')
        await lock()
        window.location.href = '/calendar'
      }
    }

    const setupListener = async () => {
      // 1. Mobile (Capacitor) background/inactive listener
      if (cap && cap.isPluginAvailable('App')) {
        try {
          const { App } = require('@capacitor/app')
          appStateListener = await App.addListener('appStateChange', async ({ isActive }: { isActive: boolean }) => {
            if (!isActive && isMounted) {
              console.log('App went to background. Locking private space and returning to calendar.')
              await lock()
              window.location.href = '/calendar'
            }
          })
        } catch (e) {
          console.error('Failed to setup Capacitor App state listener:', e)
        }
      }

      // 2. Web browser tab visibility change listener
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleWebVisibility)
      }
    }

    setupListener()

    return () => {
      isMounted = false
      if (appStateListener) {
        appStateListener.remove()
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWebVisibility)
      }
    }
  }, [lock])

  return (
    <PrivateSpaceContext.Provider
      value={{
        isUnlocked,
        hasPasscode,
        loading,
        checkPasscodeStatus,
        unlock,
        setupPasscode,
        lock,
      }}
    >
      {children}
    </PrivateSpaceContext.Provider>
  )
}

export function usePrivateSpace() {
  const context = useContext(PrivateSpaceContext)
  if (!context) {
    throw new Error('usePrivateSpace must be used within a PrivateSpaceProvider')
  }
  return context
}
