'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth, Profile } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

const CALENDAR_STEALTH_MESSAGES = [
  "Upcoming event reminder: Daily check-in.",
  "Event starts soon: Schedule sync.",
  "Reminder: Calendar event scheduled for today.",
  "Schedule update: Event reminder.",
  "Upcoming task: Review calendar sync agenda."
];

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  message_type: 'text' | 'image'
  image_path: string | null
  reply_to_message_id: string | null
  read_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  reply_preview?: {
    id: string
    sender_id: string
    sender_name: string
    content: string | null
    message_type: string
  }
}

export interface Reaction {
  id: string
  message_id: string
  user_id: string
  reaction: string
  created_at: string
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  partner: Profile
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  
  // Refs to prevent stale closures in global realtime handlers
  const conversationsRef = useRef<Conversation[]>([])
  const activeConversationRef = useRef<Conversation | null>(null)

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    activeConversationRef.current = activeConversation
  }, [activeConversation])
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const supabase = createClient()
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  // 1. Fetch conversations list for user
  const fetchConversations = useCallback(async () => {
    if (!user) return
    setLoadingConversations(true)

    try {
      // Get all conversations where the user is a member and hasn't deleted them
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)

      if (memberErr) throw memberErr

      if (!memberRows || memberRows.length === 0) {
        setConversations([])
        setLoadingConversations(false)
        return
      }

      const conversationIds = memberRows.map((r) => r.conversation_id)

      // Fetch the members of these conversations
      const { data: allMembers, error: membersErr } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          user_id,
          profiles (
            id,
            username,
            display_name,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .in('conversation_id', conversationIds)

      if (membersErr) throw membersErr

      // Parse conversations and find the chat partner (the other user)
      const list: Conversation[] = []
      const processedIds = new Set<string>()

      allMembers?.forEach((row: any) => {
        if (row.user_id !== user.id && !processedIds.has(row.conversation_id)) {
          processedIds.add(row.conversation_id)
          list.push({
            id: row.conversation_id,
            created_at: '', // placeholder, can query later if needed
            updated_at: '',
            partner: row.profiles as Profile,
          })
        }
      })

      setConversations(list)
    } catch (err: any) {
      console.error('Error fetching conversations:', err?.message || err?.details || err)
      showToast('Failed to load conversations', 'error')
    } finally {
      setLoadingConversations(false)
    }
  }, [user, supabase, showToast])

  // 2. Start or retrieve a conversation with a username
  const startConversation = async (targetUsername: string): Promise<Conversation | null> => {
    if (!user || !profile) return null
    const cleanedUsername = targetUsername.toLowerCase().trim()

    if (cleanedUsername === profile.username.toLowerCase()) {
      showToast('You cannot start a conversation with yourself.', 'error')
      return null
    }

    try {
      // Find the target user profile
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanedUsername)
        .maybeSingle()

      if (profileErr || !targetProfile) {
        showToast('User not found.', 'error')
        return null
      }

      // Check if conversation already exists
      const { data: memberA } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      const { data: memberB } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetProfile.id)

      const commonId = memberA?.find((a) =>
        memberB?.some((b) => b.conversation_id === a.conversation_id)
      )?.conversation_id

      if (commonId) {
        // Reactivate conversation for the user if they had deleted it
        await supabase
          .from('conversation_members')
          .update({ is_deleted: false })
          .eq('conversation_id', commonId)
          .eq('user_id', user.id)

        const existingConv: Conversation = {
          id: commonId,
          created_at: '',
          updated_at: '',
          partner: targetProfile,
        }
        setActiveConversation(existingConv)
        await fetchConversations()
        return existingConv
      }

      // Create new conversation
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single()

      if (convErr) throw convErr

      // Add members (trigger enforces at most 2 members)
      const { error: membersErr } = await supabase
        .from('conversation_members')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetProfile.id },
        ])

      if (membersErr) {
        // Cleanup conversation row if adding members fails
        await supabase.from('conversations').delete().eq('id', newConv.id)
        throw membersErr
      }

      const newConvObj: Conversation = {
        id: newConv.id,
        created_at: newConv.created_at,
        updated_at: newConv.updated_at,
        partner: targetProfile,
      }

      setActiveConversation(newConvObj)
      await fetchConversations()
      showToast('Conversation initialized', 'success')
      return newConvObj
    } catch (err: any) {
      console.error('Error starting conversation:', err)
      showToast(err.message || 'Failed to start conversation', 'error')
      return null
    }
  }

  // Helper to mark messages in a conversation as read
  const markMessagesAsRead = useCallback(async (convId: string) => {
    if (!user) return
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .neq('sender_id', user.id)
        .is('read_at', null)
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }, [supabase, user])

  // 3. Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      // Get the current user's membership details to find history_cleared_at
      const { data: memberInfo } = await supabase
        .from('conversation_members')
        .select('history_cleared_at')
        .eq('conversation_id', convId)
        .eq('user_id', user.id)
        .maybeSingle()

      const historyClearedAt = memberInfo?.history_cleared_at || new Date(0).toISOString()

      const { data: msgRows, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .gte('created_at', historyClearedAt)
        .order('created_at', { ascending: true })

      if (msgErr) throw msgErr

      // Fetch all reactions for these messages
      if (msgRows && msgRows.length > 0) {
        const msgIds = msgRows.map((m) => m.id)
        const { data: reactionRows, error: reactErr } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', msgIds)

        if (reactErr) throw reactErr

        const reactionMap: Record<string, Reaction[]> = {}
        reactionRows?.forEach((r) => {
          if (!reactionMap[r.message_id]) {
            reactionMap[r.message_id] = []
          }
          reactionMap[r.message_id].push(r)
        })

        setReactions(reactionMap)
      } else {
        setReactions({})
      }

      setMessages(msgRows || [])
      
      // Mark messages as read when loaded
      if (msgRows && msgRows.some((m) => m.sender_id !== user?.id && !m.read_at)) {
        markMessagesAsRead(convId)
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      showToast('Failed to load messages', 'error')
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase, showToast, user, markMessagesAsRead])

  // Fetch messages whenever the active conversation changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).activeConversationId = activeConversation?.id || null
    }
    if (activeConversation) {
      fetchMessages(activeConversation.id)
    } else {
      setMessages([])
      setReactions([])
    }
  }, [activeConversation, fetchMessages])

  // 4. Global Realtime subscription to new messages (for updating active chat feed in realtime)
  useEffect(() => {
    if (!user) return

    const globalChannel = supabase
      .channel('global_messages_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message
          if (newMsg.sender_id === user.id) return

          // If the chat room is currently open, load the message in the feed
          if (activeConversationRef.current?.id === newMsg.conversation_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            markMessagesAsRead(newMsg.conversation_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(globalChannel)
    }
  }, [supabase, user, markMessagesAsRead])

  // 5. Active Chat subscription (for realtime message updates/deletes and reactions)
  useEffect(() => {
    if (!activeConversation) return

    const convId = activeConversation.id

    // Messages UPDATE subscription
    const activeChannel = supabase
      .channel(`active_chat_updates_${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)))
        }
      )
      .subscribe()

    // Message Reactions subscription
    const reactionChannel = supabase
      .channel(`chat_reactions_${convId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as Reaction
            setReactions((prev) => {
              const current = prev[newReaction.message_id] || []
              if (current.some((r) => r.id === newReaction.id)) return prev
              return {
                ...prev,
                [newReaction.message_id]: [...current, newReaction],
              }
            })
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as { id: string }
            setReactions((prev) => {
              const next = { ...prev }
              Object.keys(next).forEach((msgId) => {
                next[msgId] = next[msgId].filter((r) => r.id !== oldReaction.id)
              })
              return next
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(activeChannel)
      supabase.removeChannel(reactionChannel)
    }
  }, [activeConversation, supabase])

  // 5. Send message action
  const sendMessage = async (
    content: string | null,
    messageType: 'text' | 'image' = 'text',
    imagePath: string | null = null,
    replyToMessageId: string | null = null
  ) => {
    if (!user || !activeConversation) return null

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content,
          message_type: messageType,
          image_path: imagePath,
          reply_to_message_id: replyToMessageId,
        })
        .select()
        .single()

      if (error) throw error

      // Automatically unhide conversation for the recipient
      await supabase
        .from('conversation_members')
        .update({ is_deleted: false })
        .eq('conversation_id', activeConversation.id)
        .neq('user_id', user.id)
      
      // Update local messages array optimistically
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data]
      })

      return data
    } catch (err: any) {
      console.error('Error sending message:', err)
      showToast('Failed to send message', 'error')
      return null
    }
  }

  // 6. Delete message (soft delete)
  const deleteMessage = async (messageId: string) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: 'This message was deleted.',
          image_path: null,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id) // security check: only own messages

      if (error) throw error

      showToast('Message deleted', 'success')
      return true
    } catch (err: any) {
      console.error('Error deleting message:', err)
      showToast('Failed to delete message', 'error')
      return false
    }
  }

  // 7. Add reaction
  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          reaction: emoji,
        })

      if (error) {
        // If unique constraint triggers, it means user already reacted. Silently return or ignore.
        if (error.code !== '23505') {
          throw error
        }
      }
    } catch (err: any) {
      console.error('Error adding reaction:', err)
    }
  }

  // 8. Remove reaction
  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('reaction', emoji)

      if (error) throw error
    } catch (err: any) {
      console.error('Error removing reaction:', err)
    }
  }

  // 9. Delete conversation (one-sided soft delete)
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('conversation_members')
        .update({
          is_deleted: true,
          history_cleared_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)

      if (error) throw error

      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      setActiveConversation(null)
      showToast('Conversation deleted successfully', 'success')
    } catch (err: any) {
      console.error('Error deleting conversation:', err)
      showToast(err?.message || 'Failed to delete conversation', 'error')
    }
  }, [supabase, showToast, user, setActiveConversation])

  // Fetch initial conversations list on mount and request Notification permission (including Capacitor support)
  useEffect(() => {
    fetchConversations()
    if (typeof window !== 'undefined') {
      const cap = (window as any).Capacitor
      if (cap && cap.isPluginAvailable('LocalNotifications')) {
        try {
          const { LocalNotifications } = require('@capacitor/local-notifications')
          LocalNotifications.requestPermissions().then((res: any) => {
            console.log("Capacitor local notifications permission request response:", res)
          })
        } catch (e) {
          console.error("Capacitor permission request failed:", e)
        }
      } else if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then((res) => {
            console.log("Web Notification permission request response:", res)
          })
        }
      } else {
        console.warn("This browser/device context does not support native or Web Notification APIs (requires HTTPS or Localhost).")
      }
    }
  }, [fetchConversations])

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    reactions,
    loadingConversations,
    loadingMessages,
    startConversation,
    sendMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    fetchConversations,
    deleteConversation,
  }
}
