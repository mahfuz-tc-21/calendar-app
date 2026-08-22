'use client'

import React from 'react'

interface Sticker {
  id: string
  name: string
  url: string
}

const CURATED_STICKERS: Sticker[] = [
  {
    id: 'sticker_cat_love',
    name: 'Love Cat',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_dog_happy',
    name: 'Happy Dog',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_fox_wink',
    name: 'Winking Fox',
    url: 'https://images.unsplash.com/photo-1474511320721-9a536870868f?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_koala_chill',
    name: 'Chill Koala',
    url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_lion_roar',
    name: 'Roar Lion',
    url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_panda_cute',
    name: 'Cute Panda',
    url: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_rabbit_jump',
    name: 'Jump Bunny',
    url: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=150&auto=format&fit=crop&q=60'
  },
  {
    id: 'sticker_squirrel_nut',
    name: 'Nut Squirrel',
    url: 'https://images.unsplash.com/photo-1507666405895-422efe53b1c7?w=150&auto=format&fit=crop&q=60'
  }
]

const VECTOR_STICKERS = [
  {
    id: 'vector_sticker_heart',
    name: 'Heart Balloon',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FF4B4B" />
        <circle cx="9" cy="7" r="2" fill="white" opacity="0.3" />
      </svg>
    )
  },
  {
    id: 'vector_sticker_star',
    name: 'Cool Star',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#FFC107" />
        <circle cx="12" cy="11" r="2" fill="#333" />
        <circle cx="16" cy="11" r="2" fill="#333" />
        <path d="M10 14.5c1 1 3 1 4 0" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'vector_sticker_fire',
    name: 'Lit Fire',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C12 2 17 6.5 17 11.5c0 2.5-1.5 5-5 7.5 1-1.5 1.5-3.5 1-5.5s-2.5-4-2.5-4c0 0-2 2-2.5 4.5S7.5 18 12 22c-5.5-2.5-7.5-6.5-7.5-10.5C4.5 6.5 12 2 12 2z" fill="#FF6B00" />
        <path d="M12 7c0 0 3 2.5 3 5.5c0 1.5-1 3-3 4.5.5-1 1-2.5.5-4s-1.5-3-1.5-3" fill="#FFC107" />
      </svg>
    )
  },
  {
    id: 'vector_sticker_cloud',
    name: 'Cute Cloud',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#81D4FA" />
        <circle cx="8" cy="13" r="1.5" fill="#333" />
        <circle cx="14" cy="13" r="1.5" fill="#333" />
        <path d="M10 16c0.5 0.5 1.5 0.5 2 0" stroke="#333" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'vector_sticker_thumbs',
    name: 'Thumbs Up',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M1 21h4V9H1v12zm22-10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 2 7.59 8.59C7.22 8.95 7 9.45 7 10v9c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="#2979FF" />
      </svg>
    )
  },
  {
    id: 'vector_sticker_rocket',
    name: 'Sticker Rocket',
    render: () => (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2s4 4 4 9c0 3-1 5-4 7-3-2-4-4-4-7 0-5 4-9 4-9z" fill="#ECEFF1" />
        <path d="M12 2s-4 4-4 9c0 3 1 5 4 7V2z" fill="#CFD8DC" />
        <path d="M10 18v2c0 .5-.5 1-1 1H8v1h8v-1h-1c-.5 0-1-.5-1-1v-2h-4z" fill="#90A4AE" />
        <path d="M12 22s-2-2-2-4h4c0 2-2 4-2 4z" fill="#FF7043" />
        <circle cx="12" cy="8" r="2" fill="#00E676" />
      </svg>
    )
  }
]

interface StickerPickerProps {
  onSelect: (stickerId: string, customRender?: () => React.JSX.Element) => void
  onClose: () => void
}

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  return (
    <div className="flex flex-col bg-card border border-border rounded-2xl shadow-lg w-full max-w-sm h-72 overflow-hidden animate-in slide-in-from-bottom duration-200">
      
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-foreground">Curated Sticker Pack</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground bg-card border border-border px-2.5 py-1 rounded-lg cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Stickers Grid list */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-card">
        <div className="space-y-4">
          
          {/* Vector Stickers (100% Offline-friendly) */}
          <div>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Offline Vector Stickers
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {VECTOR_STICKERS.map((stk) => (
                <button
                  key={stk.id}
                  type="button"
                  onClick={() => onSelect(stk.id, stk.render)}
                  className="aspect-square flex items-center justify-center p-2 border border-border hover:border-primary active:bg-secondary rounded-xl transition-all cursor-pointer bg-card"
                  title={stk.name}
                >
                  {stk.render()}
                </button>
              ))}
            </div>
          </div>

          {/* Photo stickers */}
          <div>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Character Stickers
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {CURATED_STICKERS.map((stk) => (
                <button
                  key={stk.id}
                  type="button"
                  onClick={() => onSelect(stk.id)}
                  className="aspect-square relative overflow-hidden border border-border hover:border-primary active:opacity-80 rounded-xl transition-all cursor-pointer p-1 bg-secondary flex items-center justify-center"
                  title={stk.name}
                >
                  <img
                    src={stk.url}
                    alt={stk.name}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
