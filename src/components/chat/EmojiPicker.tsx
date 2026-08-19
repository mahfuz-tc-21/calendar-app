'use client'

import React from 'react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫', '🫠', '✍️', '🙋', '🙋‍♂️', '🙋‍♀️']
  },
  {
    name: 'Gestures & Hearts',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🐦‍⬛', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈']
  },
  {
    name: 'Food',
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫓', '🥙', '🧆', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫']
  },
  {
    name: 'Activities & Travel',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🔮', '🎮', '🕹️', '🎰', '🎲', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🚲', '🛴', '🛹', '🛼', '🚨', '⛵', '🛥️', '🚢', '✈️', '🚀', '🛸', '🗺️', '🧭', '🏔️', '🌋', '⛺', '🏕️', '🏜️', '🏝️', '🏞️']
  }
]

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = React.useState(0)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const handleCategoryClick = (idx: number) => {
    setActiveCategory(idx)
    const categoryEl = document.getElementById(`emoji-cat-${idx}`)
    if (categoryEl && scrollContainerRef.current) {
      const topPos = categoryEl.offsetTop - scrollContainerRef.current.offsetTop
      scrollContainerRef.current.scrollTo({
        top: topPos,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-sm h-72 overflow-hidden animate-in slide-in-from-bottom duration-200">
      {/* Category selector */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[80%]">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => handleCategoryClick(idx)}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                activeCategory === idx
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Emoji scroll list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-white"
      >
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <div key={cat.name} id={`emoji-cat-${idx}`} className="space-y-1.5">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              {cat.name}
            </h4>
            <div className="grid grid-cols-8 gap-1.5">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="aspect-square text-2xl flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-all cursor-pointer select-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
