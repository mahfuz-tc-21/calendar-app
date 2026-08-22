'use client'

import React, { useState, useEffect } from 'react'
import { RotateCcw, Timer, RefreshCw, X } from 'lucide-react'

interface MemoryCardProps {
  onClose: () => void
}

interface Card {
  id: number
  icon: string
  isFlipped: boolean
  isMatched: boolean
}

const CARD_ICONS = ['🦁', '🦊', '🐨', '🐼', '🐯', '🐸', '🐙', '🐵']

export default function MemoryCard({ onClose }: MemoryCardProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<number[]>([]) // holds card index
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [win, setWin] = useState(false)

  // Shuffle and create card list
  const initGame = () => {
    const doubleIcons = [...CARD_ICONS, ...CARD_ICONS]
    
    // Fisher-Yates Shuffle
    for (let i = doubleIcons.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = doubleIcons[i]
      doubleIcons[i] = doubleIcons[j]
      doubleIcons[j] = temp
    }

    const initialCards: Card[] = doubleIcons.map((icon, idx) => ({
      id: idx,
      icon,
      isFlipped: false,
      isMatched: false
    }))

    setCards(initialCards)
    setSelectedCards([])
    setMoves(0)
    setSeconds(0)
    setIsTimerRunning(true)
    setWin(false)
  }

  // Init game on mount
  useEffect(() => {
    initGame()
  }, [])

  // Timer effect
  useEffect(() => {
    let timerInterval: NodeJS.Timeout
    if (isTimerRunning && !win) {
      timerInterval = setInterval(() => {
        setSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timerInterval)
  }, [isTimerRunning, win])

  // Card select click handler
  const handleCardClick = (idx: number) => {
    if (cards[idx].isFlipped || cards[idx].isMatched || selectedCards.length >= 2) return

    // Flip local card state
    const updatedCards = [...cards]
    updatedCards[idx].isFlipped = true
    setCards(updatedCards)

    const nextSelected = [...selectedCards, idx]
    setSelectedCards(nextSelected)

    if (nextSelected.length === 2) {
      setMoves((m) => m + 1)
      const [firstIdx, secondIdx] = nextSelected

      if (cards[firstIdx].icon === cards[secondIdx].icon) {
        // MATCH FOUND
        setTimeout(() => {
          const matchCards = [...cards]
          matchCards[firstIdx].isMatched = true
          matchCards[secondIdx].isMatched = true
          setCards(matchCards)
          setSelectedCards([])

          // Check Win Condition
          const allMatched = matchCards.every((c) => c.isMatched)
          if (allMatched) {
            setWin(true)
            setIsTimerRunning(false)
          }
        }, 300)
      } else {
        // MISMATCH
        setTimeout(() => {
          const flipBackCards = [...cards]
          flipBackCards[firstIdx].isFlipped = false
          flipBackCards[secondIdx].isFlipped = false
          setCards(flipBackCards)
          setSelectedCards([])
        }, 1000)
      }
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <header className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎴</span>
          <span className="font-bold text-sm text-foreground">Memory Match</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm w-full mx-auto space-y-4 select-none touch-none">
        
        {/* Score and Timer header bar */}
        <div className="flex justify-between w-full items-center">
          <div className="flex gap-2">
            <div className="px-3.5 py-1.5 bg-card border border-border rounded-xl text-center flex flex-col justify-center min-w-[70px]">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Moves</span>
              <span className="text-sm font-black text-foreground">{moves}</span>
            </div>
            <div className="px-3.5 py-1.5 bg-card border border-border rounded-xl text-center flex flex-col justify-center min-w-[70px]">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center justify-center gap-0.5"><Timer className="w-2.5 h-2.5" /> Time</span>
              <span className="text-sm font-black text-foreground">{formatTime(seconds)}</span>
            </div>
          </div>

          <button
            onClick={initGame}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground hover:text-primary transition-all cursor-pointer shadow-xs"
            title="Restart Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* 4x4 Grid Board */}
        <div className="relative w-full aspect-square bg-secondary rounded-2xl p-2.5 border border-border flex items-center justify-center max-w-[320px]">
          <div className="grid grid-cols-4 gap-2 h-full w-full">
            {cards.map((card, idx) => {
              const isRevealed = card.isFlipped || card.isMatched
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(idx)}
                  disabled={isRevealed || selectedCards.length >= 2 || win}
                  className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-300 transform perspective-1000 ${
                    isRevealed
                      ? 'bg-card border border-border shadow-xs rotate-y-180 scale-100'
                      : 'bg-primary/20 dark:bg-primary/10 border border-primary/25 hover:bg-primary/30 active:scale-95 cursor-pointer shadow-sm'
                  }`}
                >
                  <span className={`transition-opacity duration-200 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
                    {isRevealed ? card.icon : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Win Screen Overlay */}
          {win && (
            <div className="absolute inset-0 bg-green-500/90 rounded-2xl flex flex-col items-center justify-center text-white text-center p-6 space-y-4">
              <span className="text-4xl animate-bounce">🎉</span>
              <h2 className="text-xl font-black">All Matched!</h2>
              <div className="space-y-1">
                <p className="text-xs">Cleared in **{moves}** moves</p>
                <p className="text-xs">Completion time: **{formatTime(seconds)}**</p>
              </div>
              <button
                onClick={initGame}
                className="px-5 py-2.5 bg-white text-green-600 rounded-xl text-xs font-bold shadow-md hover:bg-gray-100 active:scale-95 transition-all cursor-pointer min-h-[38px]"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="text-[10px] text-muted-foreground text-center leading-normal max-w-[220px]">
          Tap cards to flip and find matching animal pairs. Match all cards in minimum moves!
        </p>
      </div>

      {/* Footer spacer */}
      <div className="shrink-0 p-4" />
    </div>
  )
}
