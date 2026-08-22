'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Images, Loader2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import SignedImage from './SignedImage'

interface MediaGalleryProps {
  conversationId: string
  onClose: () => void
}

interface MediaItem {
  id: string
  message_type: 'image' | 'gif'
  image_path: string
  created_at: string
}

const ITEMS_PER_PAGE = 18

export default function MediaGallery({ conversationId, onClose }: MediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  
  const supabase = createClient()

  const fetchMedia = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(false)

      let query = supabase
        .from('messages')
        .select('id, message_type, image_path, created_at')
        .eq('conversation_id', conversationId)
        .in('message_type', ['image', 'gif'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE + 1)

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
      console.error('Error fetching media:', err)
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchMedia()
  }, [conversationId])

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
      <header className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">Chat Media Gallery</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Failed to load media</h3>
            <p className="text-xs max-w-xs leading-relaxed">Check your network connection and try again.</p>
            <button onClick={() => fetchMedia()} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/95 transition-all cursor-pointer">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-1">
            <Images className="w-10 h-10 text-muted-foreground/45" />
            <h3 className="text-sm font-semibold text-foreground">No media shared</h3>
            <p className="text-xs max-w-xs leading-relaxed">Shared images and GIFs will show up here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grid */}
            <div className="grid grid-cols-3 gap-2">
              {items.map((item, index) => (
                <div 
                  key={item.id}
                  onClick={() => setActiveIndex(index)}
                  className="aspect-square relative rounded-xl overflow-hidden bg-secondary border border-border cursor-pointer hover:opacity-90 active:scale-98 transition-all"
                >
                  {item.message_type === 'image' ? (
                    <SignedImage path={item.image_path} alt="Media" className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.image_path} alt="GIF" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  disabled={loadingMore}
                  onClick={() => fetchMedia(true)}
                  className="px-6 py-2.5 bg-secondary text-foreground text-xs font-bold rounded-xl border border-border hover:bg-secondary/80 active:scale-95 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[38px]"
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
      {activeIndex !== null && (
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
              {items[activeIndex].message_type === 'image' ? (
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
