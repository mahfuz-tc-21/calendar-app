'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, ImageOff } from 'lucide-react'
import { getApiUrl } from '@/utils/api'
import { createClient } from '@/utils/supabase/client'

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
      try {
        setLoading(true)
        setError(false)

        const headers: Record<string, string> = {}
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        if (session?.refresh_token) {
          headers['x-refresh-token'] = session.refresh_token
        }

        const res = await fetch(getApiUrl(`/api/private/sign-url?path=${encodeURIComponent(path)}`), {
          headers,
        })
        if (!res.ok) throw new Error('Failed to sign URL')
        const data = await res.json()
        if (active) {
          setUrl(data.url)
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
      className={`object-cover cursor-pointer hover:opacity-95 transition-opacity ${className}`}
    />
  )
}
