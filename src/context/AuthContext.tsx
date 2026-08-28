'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type User } from '@supabase/supabase-js'
import { useGallerySync } from '@/hooks/useGallerySync'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string
  last_seen: string
  read_receipts_enabled?: boolean
  active_status_enabled?: boolean
  is_admin?: boolean
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_user')
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch {}
      }
    }
    return null
  })
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_profile')
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch {}
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('cached_user')
    }
    return true
  })
  
  const supabaseRef = useRef<any>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }
  const supabase = supabaseRef.current

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, last_seen, created_at, updated_at, read_receipts_enabled, active_status_enabled, is_admin')
        .eq('id', uid)
        .single()
      if (data) {
        setProfile(data)
        if (typeof window !== 'undefined') {
          localStorage.setItem('profile_' + uid, JSON.stringify(data))
          localStorage.setItem('cached_profile', JSON.stringify(data))
        }
      } else {
        setProfile(null)
      }
    } catch {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('profile_' + uid)
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setProfile(parsed)
            localStorage.setItem('cached_profile', cached)
            return
          } catch {}
        }
      }
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setIsLoading(false)
        if (currentUser) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('cached_user', JSON.stringify(currentUser))
          }
          await fetchProfile(currentUser.id)
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cached_user')
            localStorage.removeItem('cached_profile')
          }
        }
      } catch (err) {
        console.error('Error fetching initial session:', err)
        setIsLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      const currentUser = session?.user ?? null
      setUser((prevUser) => {
        if (prevUser?.id === currentUser?.id) {
          return prevUser
        }
        if (currentUser) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('cached_user', JSON.stringify(currentUser))
          }
          fetchProfile(currentUser.id)
        } else {
          setProfile(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cached_user')
            localStorage.removeItem('cached_profile')
          }
        }
        return currentUser
      })
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Update last_seen column in database periodically (every 1 minute)
  useEffect(() => {
    if (!user) return

    const updateLastSeen = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id)
      } catch (err) {
        console.error('Error updating last_seen:', err)
      }
    }

    updateLastSeen()
    const interval = setInterval(updateLastSeen, 60 * 1000)
    return () => clearInterval(interval)
  }, [user, supabase])

  // Register and update device presence periodically
  useEffect(() => {
    if (!user) return

    const registerAndHeartbeat = async () => {
      try {
        const { getDeviceMetadata } = await import('@/utils/device')
        const metadata = await getDeviceMetadata()
        
        await fetch('/api/device/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        })
      } catch (err) {
        console.error('Error during device registration/heartbeat:', err)
      }
    }

    registerAndHeartbeat()
    const interval = setInterval(registerAndHeartbeat, 60 * 1000)
    return () => clearInterval(interval)
  }, [user])


  const signOut = async () => {
    setIsLoading(true)
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', user.id)
      }

      if (typeof window !== 'undefined') {
        const cap = (window as any).Capacitor
        if (cap && cap.isPluginAvailable('PushNotifications')) {
          try {
            const { PushNotifications } = require('@capacitor/push-notifications')
            await PushNotifications.removeAllListeners()
          } catch (e) {
            console.error('Failed to clear push listeners:', e)
          }
        }
      }

      try {
        await supabase.removeAllChannels()
      } catch (err) {
        console.error('Error removing channels on signout:', err)
      }
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error during sign out:', err)
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('private_space_token')
        localStorage.removeItem('cached_user')
        localStorage.removeItem('cached_profile')
        sessionStorage.clear()
        window.location.href = '/login'
      }
      setUser(null)
      setProfile(null)
      setIsLoading(false)
    }
  }

  // Request notification permissions and register tap handlers at mount time (no user dep).
  // IMPORTANT: pushNotificationActionPerformed fires ONCE on cold-start from the launch
  // Intent. It must be registered here — before auth completes — to avoid missing the event.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cap = (window as any).Capacitor

      // ── FCM: register tap handler at mount time (cold-start safe) ──────────────
      if (cap && cap.isPluginAvailable('PushNotifications')) {
        try {
          const { PushNotifications } = require('@capacitor/push-notifications')
          PushNotifications.addListener('pushNotificationActionPerformed', (_action: any) => {
            // SECURITY: ignore all routing data in the notification payload.
            // Always navigate to the main Calendar page only.
            console.log('FCM notification tapped — navigating to Calendar (cold-start safe handler).')
            window.location.href = '/calendar'
          })
        } catch (e) {
          console.error('Failed to register FCM tap handler:', e)
        }
      }

      // ── Local Notifications: permission + channel + tap handler ───────────────
      if (cap && cap.isPluginAvailable('LocalNotifications')) {
        try {
          const { LocalNotifications } = require('@capacitor/local-notifications')
          LocalNotifications.requestPermissions().then((res: any) => {
            console.log("Capacitor local notifications permission response:", res)
          })

          // Create high importance Android notification channel for native banners
          LocalNotifications.createChannel({
            id: 'calendar_stealth_notifications',
            name: 'Calendar Event Reminders',
            description: 'Calendar event sync and agenda reminders',
            importance: 5, // High importance (shows banner, plays sound)
            visibility: 1,
            sound: 'default',
            vibration: true,
          }).catch((e: any) => console.error('Failed to create notification channel:', e))

          // SECURITY: tap always goes to Calendar — never to chat/private/game.
          LocalNotifications.addListener('localNotificationActionPerformed', (_action: any) => {
            console.log('Local notification tapped — navigating to Calendar.')
            window.location.href = '/calendar'
          })
        } catch (e) {
          console.error('Capacitor local notification setup failed:', e)
        }
      } else if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then((res) => {
            console.log('Web Notification permission request response:', res)
          })
        }
      }
    }
  }, [])

  // Global Realtime subscription to new messages for stealth notifications
  useEffect(() => {
    if (!user) return

    const CALENDAR_STEALTH_MESSAGES = [
      "Upcoming event reminder: Daily check-in.",
      "Event starts soon: Schedule sync.",
      "Reminder: Calendar event scheduled for today.",
      "Schedule update: Event reminder.",
      "Upcoming task: Review calendar sync agenda."
    ]

    const channel = supabase
      .channel('global_notifications_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new as any
          if (newMsg.sender_id === user.id) return

          // If the user is currently looking at this conversation, do not show notification
          if (typeof window !== 'undefined' && (window as any).activeConversationId === newMsg.conversation_id) {
            return
          }

          // Trigger stealth local notification
          if (typeof window !== 'undefined') {
            const randomMsg = CALENDAR_STEALTH_MESSAGES[Math.floor(Math.random() * CALENDAR_STEALTH_MESSAGES.length)]
            const cap = (window as any).Capacitor

            // Only trigger notification on desktop web browsers.
            // On mobile native (Android), FCM background push notifications are handled natively by the OS (showing the custom calendar app logo).
            // We skip triggering a local notification here to prevent duplicates.
            if (!cap && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                try {
                  const notification = new Notification("Calendar Event", {
                    body: randomMsg,
                    icon: "/favicon.ico",
                    tag: "calendar-event-reminder"
                  })
                  notification.onclick = (e) => {
                    e.preventDefault()
                    window.focus()
                    window.location.href = '/calendar'
                    notification.close()
                  }
                } catch (e) {
                  console.error("Failed to render web notification:", e)
                }
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  // Register push notifications FCM token — runs when user is authenticated.
  // NOTE: pushNotificationActionPerformed tap handler is registered at mount time
  // (above) to handle cold-start. Only token registration needs the user here.
  useEffect(() => {
    if (!user) return

    const setupPushToken = async () => {
      if (typeof window !== 'undefined') {
        const cap = (window as any).Capacitor
        if (cap && cap.isPluginAvailable('PushNotifications')) {
          try {
            const { PushNotifications } = require('@capacitor/push-notifications')

            const permStatus = await PushNotifications.requestPermissions()
            if (permStatus.receive === 'granted') {
              await PushNotifications.register()
            }

            await PushNotifications.addListener('registration', async (token: any) => {
              console.log('FCM Registration Token received:', token.value)
              await supabase
                .from('profiles')
                .update({ push_token: token.value })
                .eq('id', user.id)
            })

            await PushNotifications.addListener('registrationError', (error: any) => {
              console.error('Push notification registration error:', error)
            })
          } catch (e) {
            console.error('Capacitor Push Notifications FCM token setup failed:', e)
          }
        }
      }
    }

    setupPushToken()
  }, [user, supabase])

  // Start incremental background gallery sync for paired devices
  useGallerySync(user)

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
