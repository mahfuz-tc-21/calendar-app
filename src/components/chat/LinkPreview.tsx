'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Loader2, Globe } from 'lucide-react'
import { getApiUrl } from '@/utils/api'

interface LinkPreviewProps {
  url: string
  isOwn: boolean
}

interface PreviewData {
  title: string
  description?: string
  image?: string
  siteName?: string
  url: string
  error?: boolean
}

const previewCache = new Map<string, PreviewData>()

export default function LinkPreview({ url, isOwn }: LinkPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!url) return

    const cleanUrl = url.trim()
    
    if (previewCache.has(cleanUrl)) {
      setData(previewCache.get(cleanUrl) || null)
      return
    }

    let isMounted = true
    setLoading(true)

    const fetchPreview = async () => {
      try {
        let hostname = 'link'
        try {
          hostname = new URL(cleanUrl).hostname
        } catch {}

        const response = await fetch(getApiUrl(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`))
        if (!response.ok) {
          if (isMounted) {
            const errorData = { 
              title: hostname, 
              description: 'Open website link',
              url: cleanUrl, 
              siteName: hostname.replace('www.', ''),
              error: true 
            }
            previewCache.set(cleanUrl, errorData)
            setData(errorData)
          }
          return
        }
        const preview = await response.json()
        
        if (isMounted) {
          if (preview.error) {
            const errorData = { 
              title: hostname, 
              description: 'Open website link',
              url: cleanUrl, 
              siteName: hostname.replace('www.', ''),
              error: true 
            }
            previewCache.set(cleanUrl, errorData)
            setData(errorData)
          } else {
            previewCache.set(cleanUrl, preview)
            setData(preview)
          }
        }
      } catch (err) {
        console.error('Error fetching link preview:', err)
        if (isMounted) {
          let hostname = 'link'
          try {
            hostname = new URL(cleanUrl).hostname
          } catch {}
          
          const fallbackData = { 
            title: hostname, 
            description: 'Open website link',
            url: cleanUrl, 
            siteName: hostname.replace('www.', ''),
            error: true 
          }
          previewCache.set(cleanUrl, fallbackData)
          setData(fallbackData)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchPreview()

    return () => {
      isMounted = false
    }
  }, [url])

  if (loading) {
    return (
      <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 text-xs border ${
        isOwn 
          ? 'bg-white/10 border-white/10 text-blue-100' 
          : 'bg-secondary/40 border-border text-muted-foreground'
      }`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-[10px]">Loading preview...</span>
      </div>
    )
  }

  if (!data) {
    return null
  }

  let domain = data.siteName || ''
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace('www.', '')
    } catch {
      domain = ''
    }
  }

  let displayTitle = data.title
  if (!displayTitle || displayTitle === domain || displayTitle === new URL(url).hostname) {
    try {
      const urlObj = new URL(url)
      displayTitle = urlObj.pathname !== '/' && urlObj.pathname.length > 2
        ? urlObj.hostname + urlObj.pathname 
        : urlObj.hostname
    } catch {
      displayTitle = url
    }
  }

  const displayDescription = data.description || 'Click to open link in browser'

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex rounded-lg overflow-hidden border transition-all text-left shadow-2xs max-w-xs sm:max-w-sm hover:no-underline select-text ${
        isOwn
          ? 'bg-blue-600/30 border-blue-500/20 text-white hover:bg-blue-600/40'
          : 'bg-card border-border text-foreground hover:bg-secondary/80'
      }`}
    >
      {/* Icon / Web Image */}
      <div className="w-16 sm:w-20 relative shrink-0 bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden border-r border-inherit">
        {data.image ? (
          <img
            src={data.image}
            alt={displayTitle}
            className="w-full h-full object-cover absolute inset-0"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                const fallback = parent.querySelector('.fallback-icon')
                if (fallback) fallback.classList.remove('hidden')
              }
            }}
          />
        ) : null}
        <div className={`fallback-icon flex items-center justify-center w-full h-full ${data.image ? 'hidden' : ''} ${
          isOwn ? 'text-blue-200' : 'text-muted-foreground'
        }`}>
          <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      {/* Link Info */}
      <div className="p-2.5 flex flex-col justify-between overflow-hidden min-w-0 flex-1">
        <div className="flex flex-col gap-0.5">
          {domain && (
            <span className={`text-[9px] uppercase font-bold tracking-wider ${
              isOwn ? 'text-blue-200' : 'text-primary dark:text-blue-400'
            }`}>
              {domain}
            </span>
          )}
          <h4 className="font-semibold text-[11px] line-clamp-2 leading-snug break-all text-foreground">
            {displayTitle}
          </h4>
          <p className={`text-[10px] line-clamp-2 leading-normal mt-0.5 ${
            isOwn ? 'text-blue-100/90' : 'text-muted-foreground'
          }`}>
            {displayDescription}
          </p>
        </div>
        
        <div className="flex items-center gap-1 mt-1.5 text-[9px] font-medium opacity-80">
          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{url}</span>
        </div>
      </div>
    </a>
  )
}
