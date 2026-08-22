'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Images, Loader2, ChevronLeft, ChevronRight, AlertCircle, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import SignedImage from './SignedImage'

interface MediaGalleryProps {
  conversationId: string
  onClose: () => void
}

interface MediaItem {
  id: string
  message_type: 'image' | 'gif' | 'text'
  image_path?: string
  content?: string
  created_at: string
  sender_id: string
  profiles?: {
    username: string
    display_name: string | null
  }
}

const ITEMS_PER_PAGE = 18

function extractUrlDetails(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const match = content.match(urlRegex)
  if (!match) return null
  const url = match[0]
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace('www.', '')
    // Clean capitalized title fallback
    const titlePart = domain.split('.')[0]
    const title = titlePart.charAt(0).toUpperCase() + titlePart.slice(1)
    return { url, domain, title }
  } catch {
    return { url, domain: 'Link', title: 'External Website' }
  }
}

export default function MediaGallery({ conversationId, onClose }: MediaGalleryProps) {
  const [activeTab, setActiveTab] = useState<'photos' | 'gifs' | 'links'>('photos')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  
  const supabase = createClient()

  const fetchMedia = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(false)

      let query = supabase
        .from('messages')
        .select('id, message_type, image_path, content, created_at, sender_id, profiles(username, display_name)')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE + 1)

      // Apply target filtering per tab
      if (activeTab === 'photos') {
        query = query.eq('message_type', 'image')
      } else if (activeTab === 'gifs') {
        query = query.eq('message_type', 'gif')
      } else {
        // Links
        query = query.eq('message_type', 'text').ilike('content', '%http%')
      }

      if (isLoadMore && items.length > 0) {
        const lastItem = items[items.length - 1]
        query = query.lt('created_at', lastItem.created_at)
      }

      const { data, error: fetchErr } = await query

      if (fetchErr) throw fetchErr

      const fetchedItems = (data || []) as MediaItem[]
      const hasMoreItems = fetchedItems.length > ITEMS_PER_PAGE
      const pageItems = hasMoreItems ? fetchedItems.slice(0, ITEMS_PER_PAGE) : fetchedItems

      if (isLoadMore) {
        setItems((prev) => [...prev, ...pageItems])
      } else {
        setItems(pageItems)
      }
      setHasMore(hasMoreItems)
    } catch (err) {
      console.error('Error fetching media gallery:', err)
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [conversationId, activeTab, items, supabase])

  useEffect(() => {
    setItems([])
    setHasMore(false)
    fetchMedia(false)
  }, [activeTab])

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeIndex !== null && activeIndex > 0) {
      setActiveIndex(activeIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeIndex !== null && activeIndex < items.length - 1) {
      setActiveIndex(activeIndex + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <header className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card select-none">
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">Media Gallery</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Selector Tabs Toggle */}
      <div className="flex gap-2 p-1 bg-secondary/60 rounded-xl mx-4 my-2.5 shrink-0 select-none">
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'photos' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Photos
        </button>
        <button
          onClick={() => setActiveTab('gifs')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'gifs' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          GIFs
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'links' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Links
        </button>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Failed to load</h3>
            <p className="text-xs max-w-xs leading-relaxed">Check your network connection and try again.</p>
            <button onClick={() => fetchMedia(false)} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/95 transition-all cursor-pointer">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-1">
            <Images className="w-10 h-10 text-muted-foreground/45" />
            <h3 className="text-sm font-semibold text-foreground">Empty gallery</h3>
            <p className="text-xs max-w-xs leading-relaxed">
              {activeTab === 'photos' && 'No shared photos found.'}
              {activeTab === 'gifs' && 'No shared GIFs found.'}
              {activeTab === 'links' && 'No shared links found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Photos & GIFs Grid view */}
            {(activeTab === 'photos' || activeTab === 'gifs') && (
              <div className="grid grid-cols-3 gap-2">
                {items.map((item, index) => (
                  <div 
                    key={item.id}
                    onClick={() => setActiveIndex(index)}
                    className="aspect-square relative rounded-xl overflow-hidden bg-secondary border border-border cursor-pointer hover:opacity-90 active:scale-98 transition-all"
                  >
                    {item.message_type === 'image' && item.image_path ? (
                      <SignedImage path={item.image_path} alt="Media" className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.image_path} alt="GIF" loading="lazy" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Links List View */}
            {activeTab === 'links' && (
              <div className="space-y-3">
                {items.map((item) => {
                  const details = extractUrlDetails(item.content || '')
                  if (!details) return null
                  const senderName = item.profiles?.display_name || item.profiles?.username || 'User'
                  return (
                    <a
                      key={item.id}
                      href={details.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 bg-card border border-border hover:border-primary/45 rounded-2xl flex items-start justify-between gap-3 text-left transition-all cursor-pointer select-none"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-blue-500/10 px-2 py-0.5 rounded-md w-max">
                          <LinkIcon className="w-3 h-3" />
                          <span>{details.domain}</span>
                        </div>
                        <h4 className="font-semibold text-sm text-foreground leading-tight truncate">
                          {details.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {details.url}
                        </span>
                        <div className="text-[10px] text-muted-foreground font-semibold flex gap-2 pt-1 border-t border-border/40 mt-2">
                          <span>By @{item.profiles?.username || senderName}</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleDateString(undefined, { dateStyle: 'short' })}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </a>
                  )
                })}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  disabled={loadingMore}
                  onClick={() => fetchMedia(true)}
                  className="px-6 py-2.5 bg-secondary text-foreground text-xs font-bold rounded-xl border border-border hover:bg-secondary/80 active:scale-95 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[38px] select-none"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Viewer */}
      {activeIndex !== null && (activeTab === 'photos' || activeTab === 'gifs') && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 select-none animate-in fade-in duration-200"
          onClick={() => setActiveIndex(null)}
        >
          {/* Lightbox Header */}
          <div className="flex justify-between items-center text-white z-10">
            <span className="text-xs font-semibold">
              {activeIndex + 1} / {items.length}
            </span>
            <button 
              onClick={() => setActiveIndex(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Center Image Wrapper */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {/* Left Button */}
            {activeIndex > 0 && (
              <button
                onClick={handlePrev}
                className="absolute left-2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main Item */}
            <div className="max-w-full max-h-full p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {items[activeIndex].message_type === 'image' && items[activeIndex].image_path ? (
                <SignedImage 
                  path={items[activeIndex].image_path} 
                  alt="Media full size" 
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                />
              ) : (
                <img 
                  src={items[activeIndex].image_path} 
                  alt="GIF full size" 
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                />
              )}
            </div>

            {/* Right Button */}
            {activeIndex < items.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Footer */}
          <div className="text-center text-[10px] text-gray-400 z-10 pb-2">
            Shared on {new Date(items[activeIndex].created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </div>
        </div>
      )}
    </div>
  )
}
