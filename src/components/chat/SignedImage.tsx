'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, ImageOff } from 'lucide-react'
import { getApiUrl } from '@/utils/api'
import { createClient } from '@/utils/supabase/client'

// Session-level memory cache for signed URLs to prevent concurrent or duplicate signing API requests
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const CACHE_DURATION_MS = 15 * 60 * 1000 // Cache URL for 15 minutes

interface SignedImageProps {
  path: string
  alt: string
  onClick?: () => void
  className?: string
}

export default function SignedImage({ path, alt, onClick, className = '' }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    const fetchSignedUrl = async () => {
      // Check cache first before querying database/signing API
      const cached = signedUrlCache.get(path)
      if (cached && cached.expiresAt > Date.now()) {
        if (active) {
          setUrl(cached.url)
          setLoading(false)
        }
        return
      }

      try {
        setLoading(true)
        setError(false)

        const supabase = createClient()
        // Generate signed URL directly from browser client using Supabase Storage RLS
        const { data, error: signErr } = await supabase.storage
          .from('chat_images')
          .createSignedUrl(path, Math.floor(CACHE_DURATION_MS / 1000))

        if (signErr || !data?.signedUrl) throw new Error('Failed to sign URL')

        // Cache the newly fetched signed URL
        signedUrlCache.set(path, {
          url: data.signedUrl,
          expiresAt: Date.now() + CACHE_DURATION_MS
        })

        if (active) {
          setUrl(data.signedUrl)
        }
      } catch (err) {
        if (active) {
          setError(true)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchSignedUrl()

    return () => {
      active = false
    }
  }, [path])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}>
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (error || !url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl text-gray-400 p-4 gap-1.5 ${className}`}>
        <ImageOff className="w-6 h-6 text-gray-300" />
        <span className="text-[10px] font-medium">Image unavailable</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      onClick={onClick}
      loading="lazy"
      className={`object-cover cursor-pointer hover:opacity-95 transition-opacity ${className}`}
    />
  )
}
