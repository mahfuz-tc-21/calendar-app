'use client'

import React, { useState } from 'react'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import UnlockScreen from '@/components/privacy/UnlockScreen'
import ChatArea from '@/components/chat/ChatArea'
import PrivateJournal from '@/components/chat/PrivateJournal'
import { Loader2 } from 'lucide-react'

export default function PrivatePage() {
  const { isUnlocked, loading } = usePrivateSpace()
  const [activeTab, setActiveTab] = useState<'chats' | 'journal'>('chats')
  const [hasActiveChat, setHasActiveChat] = useState(false)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-2">Opening secure portal...</p>
      </div>
    )
  }

  if (!isUnlocked) {
    return <UnlockScreen />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Secure Header */}
      {!hasActiveChat && (
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shadow-xs shrink-0 select-none">
          <span className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-1.5">
            🔒 Private Space
          </span>
          <div className="flex gap-2 bg-secondary p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chats' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'journal' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Journal
            </button>
          </div>
        </header>
      )}

      {/* Main secure portal workspace */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'chats' ? (
          <ChatArea onActiveChatChange={setHasActiveChat} />
        ) : (
          <PrivateJournal />
        )}
      </div>
    </div>
  )
}
