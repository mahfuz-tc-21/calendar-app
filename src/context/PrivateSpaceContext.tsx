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

    setLoading(true) // Show secure portal loading state while checking database
    try {
      const reqHeaders = await getHeaders()
      // 1. Check if passcode is configured
      const checkRes = await fetch(getApiUrl('/api/private/check'), {
        headers: reqHeaders,
      })
      const checkData = await checkRes.json()
      setHasPasscode(!!checkData.exists)

      // 2. Check if already unlocked (verified by cookie or header)
      if (checkData.exists) {
        const verifyRes = await fetch(getApiUrl('/api/private/verify-session'), {
          headers: reqHeaders,
        })
        const verifyData = await verifyRes.json()
        setIsUnlocked(!!verifyData.unlocked)
      } else {
        setIsUnlocked(false)
      }
    } catch (err) {
      console.error('Error checking private space status:', err)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    checkPasscodeStatus()
  }, [checkPasscodeStatus, user, authLoading])

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
      showToast('Private space locked', 'info')
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
