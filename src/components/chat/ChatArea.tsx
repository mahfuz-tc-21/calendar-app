'use client'

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Image as ImageIcon, Camera as CameraIcon, X, Trash2, Heart, ThumbsUp, Laugh, AlertCircle, Smile, HelpCircle, Lock, Loader2, Sparkles, Reply, MoreVertical, Check, CheckCheck, ChevronDown, Gamepad2 } from 'lucide-react'
import { useChat, Message, Reaction, Conversation } from '@/hooks/useChat'
import { usePresence } from '@/hooks/usePresence'
import { useAuth, Profile } from '@/context/AuthContext'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import { useToast } from '@/context/ToastContext'
import { createClient } from '@/utils/supabase/client'
import SignedImage from './SignedImage'
import LinkPreview from './LinkPreview'
import dynamic from 'next/dynamic'

const EmojiPicker = dynamic(() => import('./EmojiPicker'), { ssr: false })
const GifPicker = dynamic(() => import('./GifPicker'), { ssr: false })
const StickerPicker = dynamic(() => import('./StickerPicker'), { ssr: false })
const MessageMenu = dynamic(() => import('./MessageMenu'), { ssr: false })
const ProfileModal = dynamic(() => import('../profile/ProfileModal'), { ssr: false })
import GameCard from './GameCard'
import GamesMenu from './GamesMenu'
import { Clipboard } from '@capacitor/clipboard'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

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
  const { user, profile } = useAuth()
  const { lock } = usePrivateSpace()
  const { showToast } = useToast()
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    reactions,
    activeGames,
    setActiveGames,
    loadingConversations,
    loadingMessages,
    startConversation,
    sendMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    deleteConversation,
    editMessage,
    offlineQueue,
    partnerIsTyping,
    setLocalTypingStatus,
    syncOfflineQueue,
    hasMoreMessages,
    loadOlderMessages,
  } = useChat()

  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)

  const isPartnerOnline = usePresence(
    activeConversation?.id || null,
    activeConversation?.partner?.id || null,
    user?.id || null,
    profile?.active_status_enabled !== false,
    (partnerProfile || activeConversation?.partner)?.active_status_enabled !== false
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
          .select('id, username, display_name, avatar_url, last_seen, created_at, updated_at, active_status_enabled')
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
  }, [activeConversation, supabase])

  // Input states
  const [inputText, setInputText] = useState('')
  const [partnerUsername, setPartnerUsername] = useState('')
  const [isStartingChat, setIsStartingChat] = useState(false)

  // Picker & Modal Toggles
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)

  // Context Bottom Sheet Menu State
  const [selectedMenuMessage, setSelectedMenuMessage] = useState<Message | null>(null)

  // Inline Editing States
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editInputText, setEditInputText] = useState('')

  // Multi-image upload attachments queue state
  const [attachmentImages, setAttachmentImages] = useState<Array<{
    id: string
    blob: Blob
    preview: string
    status: 'pending' | 'uploading' | 'success' | 'failed'
    progress: number
    format: string
    path?: string
  }>>([])

  // Image states (legacy compatibility)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Action states
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null)
  const [activeMenuType, setActiveMenuType] = useState<'reactions' | 'more' | null>(null)
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null)
  const [showImageSourceSheet, setShowImageSourceSheet] = useState(false)

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatContentRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isTypingRef = useRef(false)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // useTransition: marks typing indicator broadcast as low-priority so input stays snappy
  const [, startTransition] = useTransition()

  // Track whether we've done the initial instant scroll for the current conversation
  const initialScrollDoneRef = useRef(false)
  const lastMessageIdRef = useRef<string | null>(null)
  const previousScrollHeightRef = useRef<number>(0)
  const isScrollLoadingRef = useRef(false)
  const observerRunsRef = useRef(0)

  // Reset flag whenever conversation changes
  useEffect(() => {
    initialScrollDoneRef.current = false
    lastMessageIdRef.current = null
    observerRunsRef.current = 0
  }, [activeConversation?.id])

  // Scroll to bottom whenever messages change (using useLayoutEffect to prevent visual jump/flicker)
  useLayoutEffect(() => {
    if (messages.length === 0) {
      lastMessageIdRef.current = null
      return
    }

    const container = chatContainerRef.current
    const lastMsg = messages[messages.length - 1]

    if (!initialScrollDoneRef.current) {
      // First load: jump instantly to bottom with no animation
      initialScrollDoneRef.current = true
      lastMessageIdRef.current = lastMsg.id
      messageEndRef.current?.scrollIntoView({ behavior: 'instant' })
    } else if (lastMsg.id !== lastMessageIdRef.current) {
      // New message arrived at the bottom
      lastMessageIdRef.current = lastMsg.id
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (container && isScrollLoadingRef.current) {
      // Older messages were prepended
      isScrollLoadingRef.current = false
      const newScrollHeight = container.scrollHeight
      container.scrollTop = newScrollHeight - previousScrollHeightRef.current
    }
  }, [messages])

  // Scroll to bottom when partner starts typing
  useEffect(() => {
    if (partnerIsTyping) {
      const timer = setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [partnerIsTyping])

  // Use ResizeObserver to detect when the content size changes (e.g. image loads, elements render)
  // and scroll to bottom if the user was already near the bottom.
  useEffect(() => {
    const container = chatContainerRef.current
    const content = chatContentRef.current
    if (!container || !content) return

    const resizeObserver = new ResizeObserver(() => {
      observerRunsRef.current += 1

      // Check if user is close to the bottom (within 20px)
      const threshold = 20
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold

      // During the first few renders (images loading, layout shifting on mount),
      // force scroll to the bottom. Afterwards, only scroll if the user was near the bottom.
      if (observerRunsRef.current <= 5 || isNearBottom) {
        container.scrollTop = container.scrollHeight
      }
    })

    resizeObserver.observe(content)

    return () => {
      resizeObserver.disconnect()
    }
  }, [activeConversation?.id])

  // Scroll handler to detect when user reaches the top to paginate messages
  const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    
    // Toggle show scroll to bottom button if scrolled up past 300px
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 300
    setShowScrollBottomBtn(isScrolledUp)

    if (container.scrollTop < 50 && hasMoreMessages && !loadingMessages && !isScrollLoadingRef.current) {
      isScrollLoadingRef.current = true
      previousScrollHeightRef.current = container.scrollHeight
      await loadOlderMessages()
    }
  }, [hasMoreMessages, loadingMessages, loadOlderMessages])

  const handleScrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle outside click to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMessageMenu(null)
      setActiveMenuType(null)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  // Create ref to access the latest UI states inside the global Capacitor back button listener
  const backStatesRef = useRef({
    activeConversation,
    showProfileModal,
    isGamesMenuOpen,
    previewImageSrc,
    selectedMenuMessage,
    showEmojiPicker,
    showGifPicker,
    showStickerPicker,
    editingMessageId,
  })

  // Keep ref updated with latest values
  useEffect(() => {
    backStatesRef.current = {
      activeConversation,
      showProfileModal,
      isGamesMenuOpen,
      previewImageSrc,
      selectedMenuMessage,
      showEmojiPicker,
      showGifPicker,
      showStickerPicker,
      editingMessageId,
    }
  }, [
    activeConversation,
    showProfileModal,
    isGamesMenuOpen,
    previewImageSrc,
    selectedMenuMessage,
    showEmojiPicker,
    showGifPicker,
    showStickerPicker,
    editingMessageId,
  ])

  // Handle mobile hardware back button using Capacitor App plugin
  useEffect(() => {
    let backButtonListener: any = null

    const setupListener = async () => {
      try {
        const { App } = await import('@capacitor/app')
        backButtonListener = await App.addListener('backButton', () => {
          const {
            activeConversation,
            showProfileModal,
            previewImageSrc,
            selectedMenuMessage,
            showEmojiPicker,
            showGifPicker,
            showStickerPicker,
            editingMessageId,
          } = backStatesRef.current

          if (showProfileModal) {
            setShowProfileModal(false)
          } else if (isGamesMenuOpen) {
            setIsGamesMenuOpen(false)
          } else if (previewImageSrc) {
            setPreviewImageSrc(null)
          } else if (selectedMenuMessage) {
            setSelectedMenuMessage(null)
          } else if (showEmojiPicker) {
            setShowEmojiPicker(false)
          } else if (showGifPicker) {
            setShowGifPicker(false)
          } else if (showStickerPicker) {
            setShowStickerPicker(false)
          } else if (editingMessageId) {
            setEditingMessageId(null)
          } else if (activeConversation) {
            setActiveConversation(null)
          } else {
            router.push('/calendar')
          }
        })
      } catch (err) {
        console.warn('Capacitor App plugin not available, using default web back navigation', err)
      }
    }

    setupListener()

    return () => {
      if (backButtonListener) {
        backButtonListener.remove()
      }
    }
  }, [router, setActiveConversation])


  // Combined Touch/Swipe to Reply & Long Press Handlers
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [draggingMessageId, setDraggingMessageId] = useState<string | null>(null)

  const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
    setTouchStartX(e.touches[0].clientX)
    setDraggingMessageId(msg.id)
    setDragOffset(0)

    // Clear previous timer if any
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
    }

    // Start 600ms Android-style long-press timer
    pressTimerRef.current = setTimeout(() => {
      setSelectedMenuMessage(msg)
      setDraggingMessageId(null) // Cancel swipe drag if long-press is active
      setDragOffset(0)
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(30)
        } catch {}
      }
    }, 600)
  }

  const handleTouchMove = (e: React.TouchEvent, isOwn: boolean) => {
    if (touchStartX === null) return
    const currentX = e.touches[0].clientX
    const diffX = currentX - touchStartX

    // If they drag/scroll more than 15px, cancel the long press timer!
    if (Math.abs(diffX) > 15 && pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    if (isOwn) {
      if (diffX < 0) {
        setDragOffset(Math.max(-80, diffX))
      }
    } else {
      if (diffX > 0) {
        setDragOffset(Math.min(80, diffX))
      }
    }
  }

  const handleTouchEnd = (message: Message) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    if (Math.abs(dragOffset) > 50) {
      setReplyingTo(message)
      textareaRef.current?.focus()
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

  // Helper: Append selected emoji to message composer
  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji)
    textareaRef.current?.focus()
  }

  // Helper: Send selected GIF immediately
  const handleSelectGif = async (gifUrl: string) => {
    await sendMessage(null, 'gif', gifUrl, replyingTo?.id || null)
    setReplyingTo(null)
    setShowGifPicker(false)
    textareaRef.current?.focus()
  }

  // Helper: Send selected Sticker immediately
  const handleSelectSticker = async (stickerId: string) => {
    textareaRef.current?.focus()
    await sendMessage(null, 'sticker', stickerId, replyingTo?.id || null)
    setReplyingTo(null)
    setShowStickerPicker(false)
  }

  // Helper: Copy text to Native Clipboard
  const handleCopyMessage = async (text: string) => {
    try {
      await Clipboard.write({ string: text })
      showToast('Text copied to clipboard', 'success')
    } catch (e) {
      // Fallback
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        showToast('Text copied to clipboard', 'success')
      }
    }
  }

  // Helper: Save edited message
  const handleSaveEdit = async (msgId: string) => {
    const trimmed = editInputText.trim()
    if (!trimmed) return
    const success = await editMessage(msgId, trimmed)
    if (success) {
      setEditingMessageId(null)
      setEditInputText('')
    }
  }

  // Helper: Native picking of multiple images from Android Gallery
  const handleNativeGalleryPick = async () => {
    try {
      const images = await Camera.pickImages({
        quality: 70, // Natively compress photo quality to 70%
        limit: 0, // No selection count limit
      })

      if (!images || images.photos.length === 0) return

      const mapped = await Promise.all(
        images.photos.map(async (photo) => {
          const response = await fetch(photo.webPath)
          const blob = await response.blob()
          const tempId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

          return {
            id: tempId,
            blob,
            preview: photo.webPath,
            status: 'pending' as const,
            progress: 0,
            format: photo.format || 'jpeg',
          }
        })
      )

      setAttachmentImages((prev) => [...prev, ...mapped])

      // Start uploading immediately after selection
      mapped.forEach((item) => {
        uploadImageItem(item.id, item.blob, item.format)
      })
    } catch (err) {
      console.error('Error selecting images from Android Gallery:', err)
    }
  }

  // Helper: Native camera capture (Take Photo)
  const handleCameraCapture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })

      if (!image || !image.dataUrl) return

      const response = await fetch(image.dataUrl)
      const blob = await response.blob()
      const tempId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const format = image.format || 'jpeg'

      const mappedItem = {
        id: tempId,
        blob,
        preview: image.dataUrl,
        status: 'pending' as const,
        progress: 0,
        format,
      }

      setAttachmentImages((prev) => [...prev, mappedItem])

      // Start uploading immediately after capture
      uploadImageItem(tempId, blob, format)
    } catch (err) {
      console.error('Error capturing image from Camera:', err)
    }
  }

  // Helper: Upload a single queued attachment image with simulated progress indicator
  // Returns the uploaded storage path on success, or null on failure
  const uploadAttachmentImage = async (imgId: string): Promise<string | null> => {
    const item = attachmentImages.find((i) => i.id === imgId)
    if (!item || !activeConversation) return null
    return uploadImageItem(imgId, item.blob, item.format)
  }

  // Core upload helper — takes data directly to avoid stale state reads
  const uploadImageItem = async (imgId: string, blob: Blob, format: string): Promise<string | null> => {
    if (!activeConversation) return null

    setAttachmentImages((prev) =>
      prev.map((i) => (i.id === imgId ? { ...i, status: 'uploading', progress: 10 } : i))
    )

    try {
      const uniqueId = Math.random().toString(36).substring(2, 9)
      const path = `${activeConversation.id}/${Date.now()}_${uniqueId}.${format}`

      const progressInterval = setInterval(() => {
        setAttachmentImages((prev) =>
          prev.map((i) => {
            if (i.id === imgId && i.status === 'uploading' && i.progress < 90) {
              return { ...i, progress: i.progress + 15 }
            }
            return i
          })
        )
      }, 200)

      const { error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(path, blob, { contentType: `image/${format}` })

      clearInterval(progressInterval)

      if (uploadError) throw uploadError

      setAttachmentImages((prev) =>
        prev.map((i) => (i.id === imgId ? { ...i, status: 'success', progress: 100, path } : i))
      )
      return path
    } catch (err) {
      console.error('Upload failed for image item:', imgId, err)
      setAttachmentImages((prev) =>
        prev.map((i) => (i.id === imgId ? { ...i, status: 'failed', progress: 0 } : i))
      )
      return null
    }
  }

  // Helper: Remove an image attachment from queue
  const handleCancelAttachment = (imgId: string) => {
    setAttachmentImages((prev) => prev.filter((i) => i.id !== imgId))
  }

  // Helper: InputText change & typing indicator broadcast trigger
  const handleInputChange = useCallback((text: string) => {
    // Synchronous: update the displayed text immediately (no lag)
    setInputText(text.substring(0, 1000))

    // Smooth scroll to bottom on keypress to keep viewport locked
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    // Deferred (low-priority): broadcast typing status to socket
    startTransition(() => {
      if (!isTypingRef.current) {
        isTypingRef.current = true
        setLocalTypingStatus(true)
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
        setLocalTypingStatus(false)
      }, 2000)
    })
  }, [setLocalTypingStatus])

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleAddWebFile(file)
  }

  // Cancel image attachment
  const handleCancelImage = () => {
    setSelectedFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Web file processor (used for drop, paste, or file selection)
  const handleAddWebFile = async (file: File) => {
    // Validate type (images only)
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error')
      return
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.', 'error')
      return
    }

    const tempId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // Extract extension cleanly
    const fileExt = file.name.split('.').pop() || 'jpeg'
    const format = fileExt.toLowerCase() === 'png' ? 'png' : 'jpeg'

    const previewUrl = URL.createObjectURL(file)

    const mappedItem = {
      id: tempId,
      blob: file,
      preview: previewUrl,
      status: 'pending' as const,
      progress: 0,
      format,
    }

    setAttachmentImages((prev) => [...prev, mappedItem])

    // Start uploading immediately after queueing
    uploadImageItem(tempId, file, format)
  }

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    if (!activeConversation) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  // Drag leave handler
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  // Drop handler
  const handleDrop = async (e: React.DragEvent) => {
    if (!activeConversation) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        await handleAddWebFile(file)
      }
    }
  }

  // Clipboard paste event handler
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault() // Stop binary string paste in text box
        const file = item.getAsFile()
        if (file) {
          await handleAddWebFile(file)
        }
      }
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

  // Send message composer handler (supports multi-image upload & queueing)
  const handleSendSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isUploading) return

    // 1. Check for unsent/pending image attachments in queue
    const pendingImages = attachmentImages.filter(
      (img) => img.status === 'pending' || img.status === 'failed'
    )
    const hasUploading = attachmentImages.some((img) => img.status === 'uploading')

    if (hasUploading) {
      showToast('Please wait for image uploads to finish', 'error')
      return
    }

    const textContent = inputText.trim()

    // If there are pending images, upload them all now then send in one pass
    if (pendingImages.length > 0) {
      setIsUploading(true)
      textareaRef.current?.focus()

      const uploadResults = await Promise.all(
        pendingImages.map((img) => uploadAttachmentImage(img.id))
      )

      // Gather all paths that uploaded successfully
      const successPaths = uploadResults.filter((p): p is string => p !== null)

      if (successPaths.length === 0 && !textContent && !selectedFile) {
        setIsUploading(false)
        return
      }

      // Send each image, attaching the text caption to the last one
      try {
        for (let i = 0; i < successPaths.length; i++) {
          const caption = i === successPaths.length - 1 ? textContent || null : null
          await sendMessage(caption, 'image', successPaths[i], replyingTo?.id || null)
        }

        setInputText('')
        setAttachmentImages([])
        setReplyingTo(null)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        isTypingRef.current = false
        setLocalTypingStatus(false)
        setTimeout(() => textareaRef.current?.focus(), 50)
      } catch (err: any) {
        console.error('Error sending image messages:', err)
        showToast('Failed to send message', 'error')
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      return
    }

    // 2. Compile already-uploaded images and text content
    const uploadedImages = attachmentImages.filter((img) => img.status === 'success')

    if (uploadedImages.length === 0 && !textContent && !selectedFile) return

    // Focus synchronously now while we are still in the click event call stack
    textareaRef.current?.focus()

    // Save states to local variables before clearing UI state instantly
    const savedTextContent = textContent
    const savedUploadedImages = [...uploadedImages]
    const savedSelectedFile = selectedFile
    const savedReplyingTo = replyingTo

    // Clear composer states and typing indicator instantly for a snappy send response!
    setInputText('')
    setSelectedFile(null)
    setImagePreview(null)
    setAttachmentImages([])
    setReplyingTo(null)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    isTypingRef.current = false
    setLocalTypingStatus(false)

    // Set uploading state only if we actually need to upload a legacy selectedFile
    if (savedSelectedFile) {
      setIsUploading(true)
    }

    try {
      // Check network status
      let isConnected = true
      try {
        const { Network } = require('@capacitor/network')
        const netStatus = await Network.getStatus()
        isConnected = netStatus.connected
      } catch (e) {
        isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true
      }

      if (!isConnected) {
        // If offline and we have images, queue each image with local path details!
        if (savedUploadedImages.length > 0) {
          for (let i = 0; i < savedUploadedImages.length; i++) {
            const img = savedUploadedImages[i]
            const caption = i === savedUploadedImages.length - 1 ? savedTextContent : null
            await sendMessage(caption, 'image', null, savedReplyingTo?.id || null, img.preview, img.format)
          }
        } else if (savedTextContent) {
          await sendMessage(savedTextContent, 'text', null, savedReplyingTo?.id || null)
        }
      } else {
        // Normal online flow: send multiple images as separate messages
        if (savedUploadedImages.length > 0) {
          for (let i = 0; i < savedUploadedImages.length; i++) {
            const img = savedUploadedImages[i]
            const caption = i === savedUploadedImages.length - 1 ? savedTextContent : null
            await sendMessage(caption, 'image', img.path, savedReplyingTo?.id || null)
          }
        } else if (savedSelectedFile && activeConversation) {
          // Legacy image selection fallback upload
          const fileExt = savedSelectedFile.name.split('.').pop()
          const uniqueId = Math.random().toString(36).substring(2, 9)
          const path = `${activeConversation.id}/${Date.now()}_${uniqueId}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('chat_images')
            .upload(path, savedSelectedFile)

          if (uploadError) throw uploadError
          await sendMessage(savedTextContent || null, 'image', path, savedReplyingTo?.id || null)
        } else if (savedTextContent) {
          // Standard text message send
          await sendMessage(savedTextContent, 'text', null, savedReplyingTo?.id || null)
        }
      }
    } catch (err: any) {
      console.error('Error during send:', err)
      showToast('Failed to send message', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Textarea keypress handler (Enter sends, Shift+Enter new line)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendSubmit()
    }
  }, [handleSendSubmit])

  // Lock and exit chat space handler
  const handleLockExit = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('private_space_token')
    }
    window.location.href = '/calendar'
  }

  // Handle reaction toggle
  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const list = reactions[messageId] || []
    const myReaction = list.find((r) => r.user_id === user?.id && r.reaction === emoji)

    if (myReaction) {
      await removeReaction(messageId, emoji)
    } else {
      await addReaction(messageId, emoji)
    }
  }, [reactions, user, removeReaction, addReaction])

  // Calculate emoji tallies for a message bubble
  const getReactionSummaries = useCallback((messageId: string) => {
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
  }, [reactions, user])

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
              <div className="w-9 h-9 rounded-full bg-blue-100 text-primary font-bold flex items-center justify-center shrink-0 uppercase overflow-hidden">
                {(partnerProfile || activeConversation.partner).avatar_url ? (
                  <img src={(partnerProfile || activeConversation.partner).avatar_url} alt="Partner" className="w-full h-full object-cover" />
                ) : (
                  ((partnerProfile || activeConversation.partner).display_name || (partnerProfile || activeConversation.partner).username).substring(0, 2)
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-gray-900 leading-tight">
                  {(partnerProfile || activeConversation.partner).display_name || (partnerProfile || activeConversation.partner).username}
                </span>
                {profile?.active_status_enabled !== false && (partnerProfile || activeConversation.partner).active_status_enabled !== false && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {isPartnerOnline ? 'Online' : formatLastSeen((partnerProfile || activeConversation.partner).last_seen)}
                  </span>
                )}
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
              onClick={() => setIsGamesMenuOpen(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              title="Games"
            >
              <Gamepad2 className="w-5 h-5 text-gray-600" />
            </button>
          )}
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
          {!activeConversation && (
            <button
              onClick={() => setShowProfileModal(true)}
              title="Edit Profile"
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-primary transition-all cursor-pointer shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <div className="w-5.5 h-5.5 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center font-bold text-[10px] text-gray-500 uppercase select-none">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || profile?.username || 'U').substring(0, 1)
                )}
              </div>
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
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-primary font-bold flex items-center justify-center shrink-0 uppercase overflow-hidden">
                      {conv.partner.avatar_url ? (
                        <img src={conv.partner.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (conv.partner.display_name || conv.partner.username).substring(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {conv.partner.display_name || conv.partner.username}
                      </h3>
                      <p className="text-xs text-gray-400 truncate">
                        @{conv.partner.username}
                      </p>
                    </div>
                    {conv.unreadCount && conv.unreadCount > 0 ? (
                      <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 animate-pulse">
                        {conv.unreadCount}
                      </div>
                    ) : null}
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
        <div 
          className="flex-1 flex flex-col max-w-3xl w-full mx-auto overflow-hidden bg-white border-x border-border shadow-xs relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag and Drop Overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 backdrop-blur-xs border-2 border-dashed border-primary z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
              <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                <ImageIcon className="w-10 h-10 text-primary animate-bounce" />
                <h3 className="font-bold text-sm text-gray-800">Drop images here</h3>
                <p className="text-xs text-gray-500">They will be added to your attachments.</p>
              </div>
            </div>
          )}
          
          {/* Messages view wrapper container */}
          <div className="relative flex-1 min-h-0 flex flex-col">
            {/* Scrollable messages container */}
            <div 
              className="flex-1 overflow-y-auto p-4 custom-scrollbar" 
              ref={chatContainerRef}
              onScroll={handleScroll}
            >
              <div ref={chatContentRef} className="space-y-6">
            {loadingMessages ? (
              <div className="space-y-6 animate-pulse py-2">
                <div className="flex flex-col items-start max-w-[70%] space-y-1.5">
                  <div className="h-9 w-32 bg-gray-100 rounded-2xl rounded-tl-none border border-gray-150" />
                  <div className="h-2.5 w-12 bg-gray-200 rounded-full ml-1" />
                </div>
                <div className="flex flex-col items-end max-w-[70%] ml-auto space-y-1.5">
                  <div className="h-9 w-44 bg-blue-50 rounded-2xl rounded-tr-none border border-blue-100" />
                  <div className="h-2.5 w-12 bg-gray-200 rounded-full mr-1" />
                </div>
                <div className="flex flex-col items-start max-w-[70%] space-y-1.5">
                  <div className="h-9 w-24 bg-gray-100 rounded-2xl rounded-tl-none border border-gray-150" />
                  <div className="h-2.5 w-12 bg-gray-200 rounded-full ml-1" />
                </div>
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
                                  textareaRef.current?.focus()
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
                            onTouchStart={(e) => !isDeleted && handleTouchStart(e, m)}
                            onTouchMove={(e) => !isDeleted && handleTouchMove(e, isOwn)}
                            onTouchEnd={() => !isDeleted && handleTouchEnd(m)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              if (!isDeleted) setSelectedMenuMessage(m)
                            }}
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed touch-pan-y transition-all ${
                              isDeleted
                                ? 'bg-gray-100 text-gray-400 italic border border-gray-150'
                                : (m.message_type === 'gif' || m.message_type === 'sticker' || m.message_type === 'game' || (m.message_type === 'image' && !m.content))
                                  ? 'bg-transparent p-0 shadow-none border-none'
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
                            ) : editingMessageId === m.id ? (
                              <div className="flex flex-col gap-2 min-w-[200px] text-gray-800 py-1">
                                <textarea
                                  value={editInputText}
                                  onChange={(e) => setEditInputText(e.target.value)}
                                  className="w-full p-2 text-xs bg-white text-gray-950 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                                  rows={2}
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2.5 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer min-h-[30px]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(m.id)}
                                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-primary hover:bg-blue-600 rounded-md cursor-pointer min-h-[30px]"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : m.message_type === 'game' ? (
                              <GameCard
                                message={m}
                                isOwn={isOwn}
                                activeGames={activeGames}
                                setActiveGames={setActiveGames}
                                currentUserId={user?.id || ''}
                              />
                            ) : m.message_type === 'image' ? (
                              <div className="space-y-1.5 max-w-[240px]">
                                {m.image_path ? (
                                  <SignedImage
                                    path={m.image_path}
                                    alt="Sent image"
                                    onClick={() => m.image_path && setPreviewImageSrc(m.image_path)}
                                    className="w-full max-h-48"
                                  />
                                ) : m.localImageUri ? (
                                  <img
                                    src={m.localImageUri}
                                    alt="Local preview"
                                    className="w-full max-h-48 rounded-lg object-cover cursor-pointer"
                                    onClick={() => setPreviewImageSrc(m.localImageUri || null)}
                                  />
                                ) : null}
                                {m.content && (
                                  <p className={`text-sm pt-0.5 leading-snug break-words ${isOwn ? 'text-white' : 'text-gray-800'}`}>
                                    {m.content}
                                  </p>
                                )}
                              </div>
                            ) : m.message_type === 'gif' && m.image_path ? (
                              <img
                                src={m.image_path}
                                alt="GIF sticker"
                                loading="lazy"
                                className="max-w-[200px] max-h-48 object-contain rounded-xl cursor-pointer"
                              />
                            ) : m.message_type === 'sticker' && m.image_path ? (
                              m.image_path.startsWith('vector_sticker_') ? (
                                <div className="w-20 h-20 select-none">
                                  {m.image_path === 'vector_sticker_heart' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#ff4d4f"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                  )}
                                  {m.image_path === 'vector_sticker_star' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#ffcd3c"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                  )}
                                  {m.image_path === 'vector_sticker_fire' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#ff7875"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-5.38-4.5-13.33-4.5-13.33zM12 19c-2.21 0-4-1.79-4-4 0-1.74 1.02-3.24 2.5-3.92.54-.25 1.15-.31 1.72-.1.97.36 1.78 1.17 1.78 2.02 0 .85-.79 1.7-1.5 2-.42.18-.5.7-.22 1 .28.3.7.38 1.08.2.92-.44 1.64-1.29 1.64-2.2 0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4z"/></svg>
                                  )}
                                  {m.image_path === 'vector_sticker_thumbs' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#1890ff"><path d="M1 21h4V9H1v12zm22-10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                                  )}
                                  {m.image_path === 'vector_sticker_rocket' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#9254de"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm0-4.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V8c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v4z"/></svg>
                                  )}
                                  {m.image_path === 'vector_sticker_party' && (
                                    <svg className="w-20 h-20 filter drop-shadow-md" viewBox="0 0 24 24" fill="#ff85c0"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                                  )}
                                </div>
                              ) : (
                                <img
                                  src={m.image_path}
                                  alt="Sticker"
                                  loading="lazy"
                                  className="w-20 h-20 object-contain select-none"
                                />
                              )
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                {(() => {
                                  const urlMatch = m.content?.match(/(https?:\/\/[^\s]+)/i)
                                  return urlMatch ? <LinkPreview url={urlMatch[0]} isOwn={isOwn} /> : null
                                })()}
                              </>
                            )}

                            {/* Timestamp & Read Receipts */}
                            <div className={`text-[9px] mt-1 text-right shrink-0 select-none flex items-center justify-end gap-0.5 ${
                              isOwn && !(m.message_type === 'gif' || m.message_type === 'sticker' || (m.message_type === 'image' && !m.content))
                                ? 'text-blue-200' 
                                : 'text-gray-400'
                            }`}>
                              {m.edited_at && <span className="text-[8px] opacity-75 mr-1 font-semibold">(edited)</span>}
                              <span>
                                {new Date(m.created_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </span>
                              {isOwn && !isDeleted && (
                                m.status === 'pending' ? (
                                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                                ) : m.read_at ? (
                                  <CheckCheck className={`w-3.5 h-3.5 ${(m.message_type === 'gif' || m.message_type === 'sticker' || (m.message_type === 'image' && !m.content)) ? 'text-primary' : 'text-blue-100'}`} />
                                ) : m.delivered_at ? (
                                  <CheckCheck className={`w-3.5 h-3.5 ${(m.message_type === 'gif' || m.message_type === 'sticker' || (m.message_type === 'image' && !m.content)) ? 'text-gray-400' : 'text-blue-200/50'}`} />
                                ) : (
                                  <Check className={`w-3.5 h-3.5 ${(m.message_type === 'gif' || m.message_type === 'sticker' || (m.message_type === 'image' && !m.content)) ? 'text-gray-400/70' : 'text-blue-200/40'}`} />
                                )
                              )}
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
            {/* Realtime Typing Indicator bubble */}
            {partnerIsTyping && (
              <div className="flex items-center gap-2 mr-auto ml-1 animate-pulse mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-primary font-bold flex items-center justify-center shrink-0 uppercase overflow-hidden text-[10px]">
                  {(partnerProfile || activeConversation.partner).avatar_url ? (
                    <img src={(partnerProfile || activeConversation.partner).avatar_url} alt="Partner" className="w-full h-full object-cover" />
                  ) : (
                    ((partnerProfile || activeConversation.partner).display_name || (partnerProfile || activeConversation.partner).username).substring(0, 2)
                  )}
                </div>
                <div className="bg-gray-100 text-gray-500 font-medium px-3.5 py-2 rounded-2xl rounded-tl-none border border-gray-150 text-[11px] flex items-center gap-1.5 shadow-sm">
                  <span>typing</span>
                  <span className="flex gap-0.5 items-center pt-1">
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
              <div ref={messageEndRef} />
              </div>
            </div>

            {/* Scroll-to-bottom floating button */}
            {showScrollBottomBtn && (
              <button
                type="button"
                onClick={handleScrollToBottom}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white hover:bg-gray-50 text-gray-650 hover:text-gray-900 border border-gray-200 shadow-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 animate-in fade-in zoom-in-75 duration-200 z-30"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="border-t border-border bg-white px-4 py-3 space-y-2 shrink-0">
            {/* Multi-Image Attachment Queue */}
            {attachmentImages.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pb-2 border-b border-gray-100 max-h-32 overflow-y-auto animate-in slide-in-from-bottom-2 duration-200">
                {attachmentImages.map((img) => (
                  <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex shrink-0 group">
                    <img src={img.preview} alt="Attachment" className="w-full h-full object-cover" />
                    
                    {/* Status overlay */}
                    {img.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      </div>
                    )}
                    {img.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => uploadAttachmentImage(img.id)}
                        className="absolute inset-0 bg-red-500/25 flex items-center justify-center hover:bg-red-500/40 transition-colors"
                        title="Retry upload"
                      >
                        <AlertCircle className="w-5 h-5 text-white" />
                      </button>
                    )}
                    {img.status === 'success' && (
                      <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}

                    {/* Progress indicator */}
                    {img.status === 'uploading' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${img.progress}%` }} />
                      </div>
                    )}

                    {/* Cancel button */}
                    <button
                      type="button"
                      onClick={() => handleCancelAttachment(img.id)}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-black/75 text-white rounded-full p-0.5 transition-colors cursor-pointer shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
            <form onSubmit={handleSendSubmit} className="flex items-end gap-2">
              {/* Native Android Gallery Picker Button */}
              <button
                type="button"
                onClick={() => setShowImageSourceSheet(true)}
                disabled={isUploading}
                className="p-2.5 rounded-xl border border-gray-250 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-50"
                title="Add Images"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Emoji/GIF/Sticker Panel Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker && !showGifPicker && !showStickerPicker)
                  if (showEmojiPicker || showGifPicker || showStickerPicker) {
                    setShowEmojiPicker(false)
                    setShowGifPicker(false)
                    setShowStickerPicker(false)
                  }
                }}
                className={`p-2.5 rounded-xl border border-gray-250 bg-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 ${
                  (showEmojiPicker || showGifPicker || showStickerPicker) ? 'text-primary border-primary bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'
                }`}
                title="Emojis & Stickers"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Textcomposer area */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={() => {
                  // Delayed scroll to allow mobile keyboard to open first
                  setTimeout(() => {
                    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }, 150)
                }}
                placeholder="Write a message..."
                rows={1}
                className="flex-1 px-3.5 py-2.5 border border-border bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none min-h-[44px] max-h-24 custom-scrollbar leading-snug"
              />

              {/* Send Button */}
              <button
                type="submit"
                onMouseDown={(e) => {
                  // Prevent the button from taking focus away from the input
                  e.preventDefault()
                }}
                disabled={isUploading || (!inputText.trim() && attachmentImages.length === 0 && !selectedFile)}
                className="p-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            {/* Inline Tabbed Pickers Container */}
            {(showEmojiPicker || showGifPicker || showStickerPicker) && (
              <div className="border border-gray-200 rounded-xl mt-2 overflow-hidden bg-white shadow-md animate-in slide-in-from-bottom-2 duration-150 shrink-0">
                <div className="flex border-b border-gray-150 bg-gray-50 text-xs font-bold text-gray-600">
                  <button
                    type="button"
                    onClick={() => { setShowEmojiPicker(true); setShowGifPicker(false); setShowStickerPicker(false); }}
                    className={`flex-1 py-2 text-center border-r border-gray-150 cursor-pointer ${showEmojiPicker ? 'bg-white text-primary' : 'hover:bg-gray-100'}`}
                  >
                    Emojis
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEmojiPicker(false); setShowGifPicker(true); setShowStickerPicker(false); }}
                    className={`flex-1 py-2 text-center border-r border-gray-150 cursor-pointer ${showGifPicker ? 'bg-white text-primary' : 'hover:bg-gray-100'}`}
                  >
                    GIFs
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEmojiPicker(false); setShowGifPicker(false); setShowStickerPicker(true); }}
                    className={`flex-1 py-2 text-center cursor-pointer ${showStickerPicker ? 'bg-white text-primary' : 'hover:bg-gray-100'}`}
                  >
                    Stickers
                  </button>
                </div>
                <div className="h-60 overflow-y-auto p-2 bg-gray-50/50">
                  {showEmojiPicker && <EmojiPicker onSelect={handleSelectEmoji} onClose={() => setShowEmojiPicker(false)} />}
                  {showGifPicker && <GifPicker onSelect={handleSelectGif} onClose={() => setShowGifPicker(false)} />}
                  {showStickerPicker && <StickerPicker onSelect={handleSelectSticker} onClose={() => setShowStickerPicker(false)} />}
                </div>
              </div>
            )}
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
            {previewImageSrc.startsWith('http') || previewImageSrc.startsWith('data:') || previewImageSrc.startsWith('blob:') ? (
              <img
                src={previewImageSrc}
                alt="Expanded preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            ) : (
              <SignedImage
                path={previewImageSrc}
                alt="Expanded preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* 5. MESSAGE CONTEXT MENU BOTTOM SHEET */}
      {selectedMenuMessage && (
        <MessageMenu
          message={selectedMenuMessage}
          currentUserId={user?.id || ''}
          onClose={() => setSelectedMenuMessage(null)}
          onReply={() => {
            setReplyingTo(selectedMenuMessage)
            setSelectedMenuMessage(null)
            textareaRef.current?.focus()
          }}
          onCopy={() => { if (selectedMenuMessage.content) handleCopyMessage(selectedMenuMessage.content); setSelectedMenuMessage(null); }}
          onEdit={() => {
            if (selectedMenuMessage.message_type === 'text') {
              setEditingMessageId(selectedMenuMessage.id)
              setEditInputText(selectedMenuMessage.content || '')
            } else {
              showToast('Media messages cannot be edited', 'error')
            }
            setSelectedMenuMessage(null)
          }}
          onDelete={async () => {
            if (confirm('Delete this message?')) {
              await deleteMessage(selectedMenuMessage.id)
            }
            setSelectedMenuMessage(null)
          }}
          onReact={async (emoji) => {
            await addReaction(selectedMenuMessage.id, emoji)
            setSelectedMenuMessage(null)
          }}
        />
      )}

      {/* 6. PROFILE MODAL */}
      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* 6.5 GAMES MENU MODAL */}
      {isGamesMenuOpen && activeConversation && (
        <GamesMenu
          conversationId={activeConversation.id}
          opponentId={(partnerProfile || activeConversation.partner).id}
          onClose={() => setIsGamesMenuOpen(false)}
        />
      )}

      {/* 7. IMAGE SOURCE SELECTION BOTTOM SHEET */}
      {showImageSourceSheet && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 animate-in fade-in duration-200"
          onClick={() => setShowImageSourceSheet(false)}
        >
          <div 
            className="w-full bg-white rounded-t-[2.5rem] p-6 pb-8 space-y-5 animate-in slide-in-from-bottom duration-250 z-50 shadow-2xl max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-1" />
            
            <div className="text-center">
              <h3 className="text-base font-bold text-gray-900 leading-snug">Select Image</h3>
              <p className="text-xs text-gray-500 mt-0.5">Take a new photo or browse your gallery</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {/* Option: Camera */}
              <button
                type="button"
                onClick={() => {
                  setShowImageSourceSheet(false)
                  handleCameraCapture()
                }}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-150 bg-gray-50/50 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                  <CameraIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-800">Camera</span>
              </button>

              {/* Option: Gallery */}
              <button
                type="button"
                onClick={() => {
                  setShowImageSourceSheet(false)
                  handleNativeGalleryPick()
                }}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-150 bg-gray-50/50 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-800">Gallery</span>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => setShowImageSourceSheet(false)}
              className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2 text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
