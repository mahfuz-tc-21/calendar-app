'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'

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
  const { user } = useAuth()

  const checkPasscodeStatus = useCallback(async () => {
    if (!user) {
      setHasPasscode(false)
      setIsUnlocked(false)
      setLoading(false)
      return
    }

    try {
      // 1. Check if passcode is configured
      const checkRes = await fetch('/api/private/check')
      const checkData = await checkRes.json()
      setHasPasscode(!!checkData.exists)

      // 2. Check if already unlocked (verified by cookie)
      if (checkData.exists) {
        const verifyRes = await fetch('/api/private/verify-session')
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
  }, [user])

  useEffect(() => {
    checkPasscodeStatus()
  }, [checkPasscodeStatus, user])

  const unlock = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/private/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setIsUnlocked(true)
        showToast('Private space unlocked', 'success')
        return true
      } else {
        showToast(data.error || 'Unable to unlock private space.', 'error')
        return false
      }
    } catch (err) {
      showToast('Connection error. Failed to unlock.', 'error')
      return false
    }
  }

  const setupPasscode = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/private/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      showToast('Connection error. Failed to configure passcode.', 'error')
      return false
    }
  }

  const lock = async () => {
    try {
      await fetch('/api/private/lock', { method: 'POST' })
    } catch (err) {
      console.error('Error calling lock API:', err)
    } finally {
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
