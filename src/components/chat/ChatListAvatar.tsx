'use client'

import React from 'react'
import { usePresence } from '@/hooks/usePresence'
import { Profile } from '@/context/AuthContext'

interface ChatListAvatarProps {
  conversationId: string
  partner: Profile
  currentUserId: string
  currentUserActiveStatusEnabled: boolean
}

export default function ChatListAvatar({
  conversationId,
  partner,
  currentUserId,
  currentUserActiveStatusEnabled,
}: ChatListAvatarProps) {
  const isOnline = usePresence(
    conversationId,
    partner.id,
    currentUserId,
    currentUserActiveStatusEnabled,
    partner.active_status_enabled !== false
  )

  return (
    <div className="relative shrink-0 select-none">
      <div className="w-10 h-10 rounded-full bg-blue-500/10 text-primary dark:text-blue-400 font-bold flex items-center justify-center shrink-0 uppercase overflow-hidden">
        {partner.avatar_url ? (
          <img src={partner.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          (partner.display_name || partner.username).substring(0, 2)
        )}
      </div>
      {currentUserActiveStatusEnabled && partner.active_status_enabled !== false && isOnline && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
      )}
    </div>
  )
}
