'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { getApiUrl } from '@/utils/api'
import { createClient } from '@/utils/supabase/client'

async function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  if (session?.refresh_token) {
    headers['x-refresh-token'] = session.refresh_token
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
  unlock: (passcode: string) => Promise<boolean>
  setupPasscode: (passcode: string) => Promise<boolean>
  lock: () => Promise<void>
}

const PrivateSpaceContext = createContext<PrivateSpaceContextType | undefined>(undefined)

export function PrivateSpaceProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
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

    const tokenExists = typeof window !== 'undefined' && !!localStorage.getItem('private_space_token')
    if (tokenExists) {
      setHasPasscode(true)
      setIsUnlocked(true)
      setLoading(false)
      return
    }

    setLoading(true) // Only show secure portal loading state if checking database without cached token
    
    try {
      const reqHeaders = await getHeaders()
      // Check passcode status and verify session in a single API call
      const checkRes = await fetch(getApiUrl('/api/private/check'), {
        headers: reqHeaders,
      })
      const checkData = await checkRes.json()
      setHasPasscode(!!checkData.exists)
      setIsUnlocked(!!checkData.unlocked)
      
      if (!checkData.unlocked && typeof window !== 'undefined') {
        localStorage.removeItem('private_space_token')
      }
    } catch (err) {
      console.error('Error checking private space status:', err)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('private_space_token')
      if (token) {
        setIsUnlocked(true)
        setLoading(false)
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

  const unlock = async (passcode: string): Promise<boolean> => {
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
        }
        setIsUnlocked(true)
        showToast('Private space unlocked', 'success')
        return true
      } else {
        showToast(data.error || 'Unable to unlock private space.', 'error')
        return false
      }
    } catch (err) {
      console.error('Unlock error details:', err)
      showToast('Connection error. Failed to unlock.', 'error')
      return false
    }
  }

  const setupPasscode = async (passcode: string): Promise<boolean> => {
    try {
      const reqHeaders = await getHeaders()
      const res = await fetch(getApiUrl('/api/private/setup'), {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ passcode }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
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
  }

  const lock = async () => {
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
  }

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
