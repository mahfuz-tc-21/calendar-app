'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'

interface Gif {
  id: string
  title: string
  url: string
  preview: string
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void
  onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<Gif[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchGifs = async (searchQuery: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(searchQuery)}&limit=16`)
      const data = await res.json()
      if (data.success) {
        setGifs(data.gifs)
      }
    } catch (err) {
      console.error('Error loading GIFs:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load trending on mount
  useEffect(() => {
    fetchGifs('')
  }, [])

  // Debounced search on query change
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      fetchGifs(val)
    }, 500)
  }

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-sm h-80 overflow-hidden animate-in slide-in-from-bottom duration-200">
      
      {/* Header and Search */}
      <div className="p-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">GIF Search (Giphy)</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
        
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search GIFs..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* GIFs List */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white">
        {loading ? (
          <div className="h-full flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-12 italic">
            No GIFs found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.url)}
                className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 hover:border-primary active:opacity-80 transition-all cursor-pointer group bg-gray-50"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GIPHY Attribution Footer */}
      <div className="p-1 text-center bg-gray-50 border-t border-gray-100 shrink-0 flex items-center justify-center gap-1 select-none">
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Powered by</span>
        <span className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-400 to-green-400 tracking-tighter">GIPHY</span>
      </div>

    </div>
  )
}
