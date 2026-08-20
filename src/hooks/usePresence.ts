'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export function usePresence(
  conversationId: string | null,
  targetUserId: string | null,
  currentUserId: string | null,
  currentUserActiveStatusEnabled: boolean,
  partnerActiveStatusEnabled: boolean
) {
  const [isOnline, setIsOnline] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (
      !conversationId ||
      !targetUserId ||
      !currentUserId ||
      !currentUserActiveStatusEnabled ||
      !partnerActiveStatusEnabled
    ) {
      setIsOnline(false)
      return
    }

    const channel = supabase.channel(`presence_${conversationId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    })

    const handleSync = () => {
      if (!currentUserActiveStatusEnabled || !partnerActiveStatusEnabled) {
        setIsOnline(false)
        return
      }

      const state = channel.presenceState()
      let partnerOnline = false
      
      Object.keys(state).forEach((key) => {
        const presences = state[key] as any[]
        if (presences.some((p) => p.user_id === targetUserId)) {
          partnerOnline = true
        }
      })
      
      setIsOnline(partnerOnline)
    }

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          if (currentUserActiveStatusEnabled && partnerActiveStatusEnabled) {
            await channel.track({
              user_id: currentUserId,
              online_at: new Date().toISOString(),
            })
          }
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [
    conversationId,
    targetUserId,
    currentUserId,
    currentUserActiveStatusEnabled,
    partnerActiveStatusEnabled,
    supabase
  ])

  return isOnline
}
