'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Image as ImageIcon, X, Trash2, Heart, ThumbsUp, Laugh, AlertCircle, Smile, HelpCircle, Lock, Loader2, Sparkles, Reply, MoreVertical } from 'lucide-react'
import { useChat, Message, Reaction, Conversation } from '@/hooks/useChat'
import { usePresence } from '@/hooks/usePresence'
import { useAuth, Profile } from '@/context/AuthContext'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import { createClient } from '@/utils/supabase/client'
import SignedImage from './SignedImage'

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡']

function formatLastSeen(lastSeenStr: string | null | undefined) {
  if (!lastSeenStr) return 'Offline'
  try {
    const date = new Date(lastSeenStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Active just now'
    if (diffMins < 60) return `Active ${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24 && date.toDateString() === now.toDateString()) {
      return `Active today at ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })}`
    }

    return `Active on ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}`
  } catch {
    return 'Offline'
  }
}

export default function ChatArea() {
  const router = useRouter()
  const { user } = useAuth()
  const { lock } = usePrivateSpace()
  const {
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
    deleteConversation,
  } = useChat()

  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)

  const isPartnerOnline = usePresence(
    activeConversation?.id || null,
    activeConversation?.partner?.id || null,
    user?.id || null
  )

  const supabase = createClient()

  // Dynamic partner profile sync for fetching fresh last_seen values
  useEffect(() => {
    if (!activeConversation) {
      setPartnerProfile(null)
      return
    }

    setPartnerProfile(activeConversation.partner)

    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeConversation.partner.id)
          .single()
        if (data && !error) {
          setPartnerProfile(data as any)
        }
      } catch (err) {
        console.error('Error fetching partner profile:', err)
      }
    }

    fetchPartnerProfile()
    const interval = setInterval(fetchPartnerProfile, 30 * 1000)
    return () => clearInterval(interval)
  }, [activeConversation, supabase])

  // Input states
  const [inputText, setInputText] = useState('')
  const [partnerUsername, setPartnerUsername] = useState('')
  const [isStartingChat, setIsStartingChat] = useState(false)

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Action states
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null)
  const [activeMenuType, setActiveMenuType] = useState<'reactions' | 'more' | null>(null)
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null)

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle outside click to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMessageMenu(null)
      setActiveMenuType(null)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  // Touch / Swipe to Reply Handlers
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [draggingMessageId, setDraggingMessageId] = useState<string | null>(null)

  const handleTouchStart = (e: React.TouchEvent, messageId: string) => {
    setTouchStartX(e.touches[0].clientX)
    setDraggingMessageId(messageId)
    setDragOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent, isOwn: boolean) => {
    if (touchStartX === null) return
    const currentX = e.touches[0].clientX
    const diffX = currentX - touchStartX

    if (isOwn) {
      // Swiping left (negative X)
      if (diffX < 0) {
        setDragOffset(Math.max(-80, diffX))
      }
    } else {
      // Swiping right (positive X)
      if (diffX > 0) {
        setDragOffset(Math.min(80, diffX))
      }
    }
  }

  const handleTouchEnd = (message: Message) => {
    if (Math.abs(dragOffset) > 50) {
      setReplyingTo(message)
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(15)
        } catch {}
      }
    }
    setTouchStartX(null)
    setDraggingMessageId(null)
    setDragOffset(0)
  }

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type (images only)
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Cancel image attachment
  const handleCancelImage = () => {
    setSelectedFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Group messages by date helper
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; msgs: Message[] }[] = []
    const datesMap: Record<string, Message[]> = {}

    // Hydrate parent message reference info for replies
    const msgMap = new Map<string, Message>()
    messages.forEach((m) => msgMap.set(m.id, m))

    messages.forEach((m) => {
      const date = new Date(m.created_at)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(today.getDate() - 1)

      let label = ''
      if (date.toDateString() === today.toDateString()) {
        label = 'Today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday'
      } else {
        label = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }

      // Link reply messages previews
      if (m.reply_to_message_id) {
        const parent = msgMap.get(m.reply_to_message_id)
        if (parent) {
          m.reply_preview = {
            id: parent.id,
            sender_id: parent.sender_id,
            sender_name: parent.sender_id === user?.id ? 'You' : activeConversation?.partner?.display_name || 'Partner',
            content: parent.content,
            message_type: parent.message_type,
          }
        } else {
          m.reply_preview = {
            id: m.reply_to_message_id,
            sender_id: '',
            sender_name: 'System',
            content: 'Message deleted or unavailable',
            message_type: 'text',
          }
        }
      }

      if (!datesMap[label]) {
        datesMap[label] = []
      }
      datesMap[label].push(m)
    })

    Object.keys(datesMap).forEach((label) => {
      groups.push({ dateLabel: label, msgs: datesMap[label] })
    })

    return groups
  }, [messages, activeConversation, user])

  // Start chat handler
  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerUsername) return

    setIsStartingChat(true)
    const conv = await startConversation(partnerUsername)
    setIsStartingChat(false)
    if (conv) {
      setPartnerUsername('')
    }
  }

  // Send message composer handler
  const handleSendSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isUploading) return
    if (!inputText.trim() && !selectedFile) return

    let imagePath: string | null = null

    if (selectedFile && activeConversation) {
      setIsUploading(true)
      try {
        const fileExt = selectedFile.name.split('.').pop()
        const uniqueId = Math.random().toString(36).substring(2, 9)
        const path = `${activeConversation.id}/${Date.now()}_${uniqueId}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('chat_images')
          .upload(path, selectedFile)

        if (uploadError) throw uploadError
        imagePath = path
      } catch (err: any) {
        console.error('Error uploading image:', err)
        alert('Failed to upload image. Please try again.')
        setIsUploading(false)
        return
      }
    }

    const type = imagePath ? 'image' : 'text'
    const content = inputText.trim() || null

    await sendMessage(content, type, imagePath, replyingTo?.id || null)

    // Clear composer states
    setInputText('')
    setSelectedFile(null)
    setImagePreview(null)
    setReplyingTo(null)
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Textarea keypress handler (Enter sends, Shift+Enter new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendSubmit()
    }
  }

  // Lock and exit chat space handler
  const handleLockExit = async () => {
    await lock()
    router.push('/calendar')
  }

  // Handle reaction toggle
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const list = reactions[messageId] || []
    const myReaction = list.find((r) => r.user_id === user?.id && r.reaction === emoji)

    if (myReaction) {
      await removeReaction(messageId, emoji)
    } else {
      await addReaction(messageId, emoji)
    }
  }

  // Calculate emoji tallies for a message bubble
  const getReactionSummaries = (messageId: string) => {
    const list = reactions[messageId] || []
    const summary: Record<string, { count: number; active: boolean }> = {}

    list.forEach((r) => {
      if (!summary[r.reaction]) {
        summary[r.reaction] = { count: 0, active: false }
      }
      summary[r.reaction].count += 1
      if (r.user_id === user?.id) {
        summary[r.reaction].active = true
      }
    })

    return Object.keys(summary).map((emoji) => ({
      emoji,
      count: summary[emoji].count,
      isActive: summary[emoji].active,
    }))
  }

  // Scroll to original message from reply click
  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight animation
      element.classList.add('bg-blue-50/50')
      setTimeout(() => element.classList.remove('bg-blue-50/50'), 1500)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen max-h-screen overflow-hidden">
      
      {/* 1. HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-border shadow-xs">
        <div className="flex items-center gap-3">
          {activeConversation ? (
            <button
              onClick={() => setActiveConversation(null)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => router.push('/calendar')}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {activeConversation ? (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-primary font-bold flex items-center justify-center shrink-0 uppercase">
                {((partnerProfile || activeConversation.partner).display_name || (partnerProfile || activeConversation.partner).username).substring(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-gray-900 leading-tight">
                  {(partnerProfile || activeConversation.partner).display_name || (partnerProfile || activeConversation.partner).username}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {isPartnerOnline ? 'Online' : formatLastSeen((partnerProfile || activeConversation.partner).last_seen)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-base text-gray-900 tracking-tight">Private Space</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeConversation && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this full conversation? This will permanently delete all messages and history.')) {
                  deleteConversation(activeConversation.id)
                }
              }}
              title="Delete Full Conversation"
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all cursor-pointer shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          )}
          <button
            onClick={handleLockExit}
            title="Lock Private Space"
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-primary transition-all cursor-pointer shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Lock className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* 2. CHAT AGENT CONTAINER */}
      {!activeConversation ? (
        /* NO CONVERSATION OPEN: CHAT LIST & NEW CHAT SEARCH */
        <div className="flex-1 flex flex-col md:flex-row max-w-4xl w-full mx-auto p-4 gap-4 overflow-hidden">
          
          {/* List panel */}
          <div className="flex-1 bg-white border border-border rounded-2xl flex flex-col overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-sm text-gray-800">Conversations</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded-full border border-gray-100">
                {conversations.length} Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
              {loadingConversations ? (
                <div className="py-12 flex justify-center text-sm text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400 italic">
                  No private chats started yet
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-primary font-bold flex items-center justify-center shrink-0 uppercase">
                      {conv.partner.display_name?.substring(0, 2) || conv.partner.username.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {conv.partner.display_name || conv.partner.username}
                      </h3>
                      <p className="text-xs text-gray-400 truncate">
                        @{conv.partner.username}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Setup / Invite panel */}
          <div className="w-full md:w-80 bg-white border border-border rounded-2xl p-5 shadow-xs space-y-4 shrink-0 h-fit">
            <div className="space-y-1">
              <h2 className="font-semibold text-sm text-gray-950">Add Authorized User</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Connect with another user by inputting their exact username below. Conversations are limited to 2 people.
              </p>
            </div>

            <form onSubmit={handleStartChat} className="space-y-3">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Recipient Username"
                  value={partnerUsername}
                  onChange={(e) => setPartnerUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-450"
                />
              </div>

              <button
                type="submit"
                disabled={isStartingChat || !partnerUsername.trim()}
                className="w-full py-2 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isStartingChat && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Partner
              </button>
            </form>
          </div>

        </div>
      ) : (
        /* CONVERSATION ACTIVE: SCROLLABLE CHAT FEED & COMPOSER */
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto overflow-hidden bg-white border-x border-border shadow-xs">
          
          {/* Scrollable messages container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={chatContainerRef}>
            {loadingMessages ? (
              <div className="py-12 flex justify-center text-sm text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                <Smile className="w-10 h-10 text-gray-300" />
                <h3 className="font-semibold text-sm text-gray-800">Secure Conversation</h3>
                <p className="text-xs text-gray-500 max-w-[240px] leading-relaxed">
                  Say hello! This chat is encrypted using server session protection and Row-Level Security.
                </p>
              </div>
            ) : (
              groupedMessages.map(({ dateLabel, msgs }) => (
                <div key={dateLabel} className="space-y-4">
                  {/* Date Separator */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      {dateLabel}
                    </span>
                  </div>

                  {/* Messages Feed */}
                  {msgs.map((m) => {
                    const isOwn = m.sender_id === user?.id
                    const isDeleted = !!m.deleted_at
                    const msgReactions = getReactionSummaries(m.id)

                    return (
                      <div
                        key={m.id}
                        id={`msg-${m.id}`}
                        className={`flex flex-col group max-w-[80%] ${isOwn ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        
                        {/* Sender tag (for partner only in two-person view, optional but nice for avatar) */}
                        {!isOwn && (
                          <span className="text-[10px] font-bold text-gray-400 mb-1 ml-1">
                            {activeConversation.partner.display_name}
                          </span>
                        )}

                        {/* Message Bubble container */}
                        <div className="relative w-fit max-w-full">
                          
                          {/* Swipe Reply indicator behind bubble (mobile only / touch only helper) */}
                          {draggingMessageId === m.id && Math.abs(dragOffset) > 10 && !isDeleted && (
                            <div className={`absolute top-1/2 -translate-y-1/2 text-gray-400 flex items-center transition-all ${
                              isOwn ? 'left-full ml-3' : 'right-full mr-3'
                            }`}>
                              <Reply className={`w-4 h-4 transition-transform duration-150 ${
                                Math.abs(dragOffset) > 50 ? 'scale-125 text-primary' : 'scale-100'
                              }`} />
                            </div>
                          )}

                          {/* Options circular buttons group (desktop only, only Reply button left) */}
                          {!isDeleted && (
                            <div className={`absolute top-1/2 -translate-y-1/2 transition-opacity z-10 flex items-center ${
                              activeMessageMenu === m.id 
                                ? 'opacity-100' 
                                : 'opacity-0 md:opacity-0 group-hover:opacity-100 md:group-hover:opacity-100'
                            } ${
                              isOwn ? 'right-full mr-2' : 'left-full ml-2'
                            }`}>
                              {/* Reply Action Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReplyingTo(m)
                                }}
                                className="w-7 h-7 rounded-full flex items-center justify-center bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm shrink-0 cursor-pointer"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Message Body */}
                          <div
                            style={{ 
                              transform: draggingMessageId === m.id ? `translateX(${dragOffset}px)` : 'none',
                              transition: draggingMessageId === m.id ? 'none' : 'transform 0.2s ease-out'
                            }}
                            onTouchStart={(e) => !isDeleted && handleTouchStart(e, m.id)}
                            onTouchMove={(e) => !isDeleted && handleTouchMove(e, isOwn)}
                            onTouchEnd={() => !isDeleted && handleTouchEnd(m)}
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed touch-pan-y ${
                              isDeleted
                                ? 'bg-gray-100 text-gray-400 italic border border-gray-150'
                                : isOwn
                                  ? 'bg-primary text-white font-medium rounded-tr-none'
                                  : 'bg-gray-100 text-gray-800 font-medium rounded-tl-none border border-gray-150'
                            }`}
                          >
                            {/* Inner Reply Card (nested inside bubble) */}
                            {m.reply_preview && !isDeleted && (
                              <div
                                onClick={() => m.reply_to_message_id && handleScrollToMessage(m.reply_to_message_id)}
                                className={`flex flex-col text-left px-2.5 py-1.5 border-l-2 mb-2 rounded-r-md text-[11px] cursor-pointer transition-colors ${
                                  isOwn 
                                    ? 'bg-black/10 border-white/50 text-blue-100 hover:bg-black/15' 
                                    : 'bg-black/5 border-gray-400 text-gray-600 hover:bg-black/10'
                                }`}
                              >
                                <span className={`font-semibold text-[10px] ${isOwn ? 'text-white' : 'text-gray-700'}`}>
                                  Replying to {m.reply_preview.sender_name}
                                </span>
                                <span className={`truncate max-w-[220px] italic ${isOwn ? 'text-blue-100/90' : 'text-gray-500'}`}>
                                  {m.reply_preview.message_type === 'image' ? '📷 Image' : m.reply_preview.content}
                                </span>
                              </div>
                            )}

                            {isDeleted ? (
                              'This message was deleted.'
                            ) : m.message_type === 'image' && m.image_path ? (
                              <div className="space-y-1.5 max-w-[240px]">
                                <SignedImage
                                  path={m.image_path}
                                  alt="Sent image"
                                  onClick={() => m.image_path && setPreviewImageSrc(m.image_path)}
                                  className="w-full max-h-48"
                                />
                                {m.content && (
                                  <p className="text-sm pt-0.5 leading-snug break-words">
                                    {m.content}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            )}

                            {/* Timestamp */}
                            <div className={`text-[9px] mt-1 text-right shrink-0 select-none ${
                              isOwn ? 'text-blue-200' : 'text-gray-400'
                            }`}>
                              {new Date(m.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </div>
                          </div>

                        </div>

                        {/* Render reactions list below message bubble */}
                        {msgReactions.length > 0 && (
                          <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                            {msgReactions.map(({ emoji, count, isActive }) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-blue-50 border-primary text-primary'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={messageEndRef} />
          </div>

          {/* 3. COMPOSER PANEL */}
          <div className="border-t border-border bg-white px-4 py-3 space-y-2 shrink-0">
            {/* Image Preview Container */}
            {imagePreview && (
              <div className="relative flex items-center justify-between p-2 bg-gray-50 border border-gray-150 rounded-xl max-w-sm animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="Upload preview" className="w-12 h-12 object-cover rounded-lg" />
                  <span className="text-xs text-gray-500 truncate max-w-[150px]">
                    {selectedFile?.name}
                  </span>
                </div>
                <button
                  onClick={handleCancelImage}
                  className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Reply Preview Container */}
            {replyingTo && (
              <div className="flex items-center justify-between p-2.5 bg-blue-50/50 border-l-2 border-primary rounded-r-xl animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex flex-col text-left text-xs">
                  <span className="font-semibold text-[10px] text-primary">
                    Replying to {replyingTo.sender_id === user?.id ? 'Yourself' : activeConversation.partner.display_name}
                  </span>
                  <span className="text-gray-600 truncate max-w-[240px]">
                    {replyingTo.message_type === 'image' ? '📷 Image' : replyingTo.content}
                  </span>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input compositor form */}
            <form onSubmit={handleSendSubmit} className="flex items-end gap-2.5">
              {/* Attachment Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 rounded-xl border border-gray-250 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Textcomposer area */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value.substring(0, 1000))} // 1000 char limit
                onKeyDown={handleKeyDown}
                placeholder="Write a message..."
                disabled={isUploading}
                rows={1}
                className="flex-1 px-3.5 py-2.5 border border-border bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none min-h-[44px] max-h-24 custom-scrollbar leading-snug"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isUploading || (!inputText.trim() && !selectedFile)}
                className="p-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>

        </div>
      )}

      {/* 4. EXPANDED IMAGE PREVIEW PORTAL MODAL */}
      {previewImageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
          <button
            onClick={() => setPreviewImageSrc(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer min-h-[44px]"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center">
            <SignedImage
              path={previewImageSrc}
              alt="Expanded preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

    </div>
  )
}
