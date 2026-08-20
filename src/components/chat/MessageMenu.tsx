'use client'

import React, { useEffect } from 'react'
import { Reply, Copy, Edit2, Trash2, X } from 'lucide-react'

interface MessageMenuProps {
  message: {
    id: string
    sender_id: string
    content: string | null
    message_type: 'text' | 'image' | 'gif' | 'sticker' | 'game'
  }
  currentUserId: string
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onReact: (emoji: string) => void
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡']

export default function MessageMenu({
  message,
  currentUserId,
  onClose,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReact,
}: MessageMenuProps) {
  const isOwn = message.sender_id === currentUserId
  const isText = message.message_type === 'text'

  // Handle Escape key or Android Back key emulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-in fade-in duration-200" onClick={onClose}>
      
      {/* Container holding sheet (prevent event bubble) */}
      <div
        className="bg-white rounded-t-3xl max-w-md w-full mx-auto p-5 pb-8 space-y-5 animate-in slide-in-from-bottom duration-200 border-t border-gray-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Swipe bar indicator */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto cursor-pointer" onClick={onClose} />

        {/* Reaction quick-bar */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
            React
          </span>
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(emoji)
                  onClose()
                }}
                className="text-3xl hover:scale-125 active:scale-95 transition-transform duration-100 cursor-pointer select-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Actions List */}
        <div className="space-y-1.5">
          {/* Reply Option (All messages) */}
          <button
            type="button"
            onClick={() => {
              onReply()
              onClose()
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-left rounded-xl hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Reply className="w-4.5 h-4.5 text-gray-500" />
            <span>Reply</span>
          </button>

          {/* Copy Option (Only own/other Text messages) */}
          {isText && (
            <button
              type="button"
              onClick={() => {
                onCopy()
                onClose()
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 text-left rounded-xl hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Copy className="w-4.5 h-4.5 text-gray-500" />
              <span>Copy Text</span>
            </button>
          )}

          {/* Edit Option (Only own Text messages) */}
          {isOwn && isText && (
            <button
              type="button"
              onClick={() => {
                onEdit()
                onClose()
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 text-left rounded-xl hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Edit2 className="w-4.5 h-4.5 text-gray-500" />
              <span>Edit Message</span>
            </button>
          )}

          {/* Delete Option (Only own messages) */}
          {isOwn && (
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 text-left rounded-xl hover:bg-red-50 active:bg-red-100 text-red-600 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-4.5 h-4.5 text-red-500" />
              <span>Delete Message</span>
            </button>
          )}
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 active:bg-gray-100 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>

      </div>
      
    </div>
  )
}
