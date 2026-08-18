'use client'

import React from 'react'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import UnlockScreen from '@/components/privacy/UnlockScreen'
import ChatArea from '@/components/chat/ChatArea'
import { Loader2 } from 'lucide-react'

export default function PrivatePage() {
  const { isUnlocked, loading } = usePrivateSpace()

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Opening secure portal...</p>
      </div>
    )
  }

  if (!isUnlocked) {
    return <UnlockScreen />
  }

  return <ChatArea />
}
