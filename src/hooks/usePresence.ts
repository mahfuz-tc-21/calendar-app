'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export function usePresence(conversationId: string | null, targetUserId: string | null, currentUserId: string | null) {
  const [isOnline, setIsOnline] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!conversationId || !targetUserId || !currentUserId) {
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [conversationId, targetUserId, currentUserId, supabase])

  return isOnline
}
