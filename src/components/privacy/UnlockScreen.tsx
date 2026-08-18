'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import { ShieldAlert, Lock, ArrowLeft, Loader2, KeyRound } from 'lucide-react'

export default function UnlockScreen() {
  const router = useRouter()
  const { hasPasscode, unlock, setupPasscode, loading } = usePrivateSpace()
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcode) return

    setIsSubmitting(true)
    setErrorMsg('')
    const success = await unlock(passcode)
    setIsSubmitting(false)
    if (!success) {
      setPasscode('')
    }
  }

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcode || !confirmPasscode) return

    if (passcode.length < 4) {
      setErrorMsg('Passcode must be at least 4 characters long.')
      return
    }

    if (passcode !== confirmPasscode) {
      setErrorMsg('Passcodes do not match.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    const success = await setupPasscode(passcode)
    setIsSubmitting(false)
    if (!success) {
      setPasscode('')
      setConfirmPasscode('')
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Securing private workspace...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white border border-border rounded-2xl shadow-sm space-y-6">
        
        {/* Header Icon */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
            {hasPasscode ? <Lock className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {hasPasscode ? 'Private Workspace Locked' : 'Set Up Private Access'}
            </h1>
            <p className="text-xs text-gray-500 max-w-[260px] mx-auto mt-1 leading-relaxed">
              {hasPasscode
                ? 'Enter your passcode to unlock your private messages.'
                : 'Configure a passcode. You will need this passcode to enter the private area.'
              }
            </p>
          </div>
        </div>

        {/* Setup/Unlock Form */}
        {hasPasscode ? (
          /* Unlock Form */
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider" htmlFor="passcode">
                Enter Passcode
              </label>
              <input
                id="passcode"
                type="password"
                placeholder="••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-3 py-3 border border-border rounded-lg text-center font-bold tracking-widest text-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-300"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !passcode}
              className="w-full py-2.5 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock Space'}
            </button>
          </form>
        ) : (
          /* Setup Form */
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider" htmlFor="new-passcode">
                Choose Passcode
              </label>
              <input
                id="new-passcode"
                type="password"
                placeholder="Minimum 4 characters"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-center font-medium tracking-wide text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider" htmlFor="confirm-passcode">
                Confirm Passcode
              </label>
              <input
                id="confirm-passcode"
                type="password"
                placeholder="Repeat passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-center font-medium tracking-wide text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !passcode || !confirmPasscode}
              className="w-full py-2.5 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Configure & Unlock'}
            </button>
          </form>
        )}

        {/* Back Button */}
        <div className="border-t border-gray-100 pt-4 text-center">
          <button
            onClick={() => router.push('/calendar')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer min-h-[44px] px-3 py-2 hover:bg-gray-50 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Calendar
          </button>
        </div>

      </div>
    </div>
  )
}
