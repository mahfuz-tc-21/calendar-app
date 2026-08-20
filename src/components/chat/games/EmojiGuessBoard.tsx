'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

interface EmojiGuessBoardProps {
  game: {
    id: string
    state: {
      emojiChallenge: string
      guessed: boolean
      result: 'correct' | 'incorrect' | 'revealed' | null
      guess?: string
      guesses?: string[]
      correctAnswer?: string
    }
    status: string
    created_by: string
  }
  currentUserId: string
}

export default function EmojiGuessBoard({ game, currentUserId }: EmojiGuessBoardProps) {
  const [guessText, setGuessText] = useState('')
  const [loading, setLoading] = useState(false)

  const isCreator = game.created_by === currentUserId
  const { emojiChallenge, guessed, result, guesses = [], correctAnswer } = game.state

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guessText.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'submit_guess',
          payload: { guess: guessText }
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setGuessText('')
      } else {
        alert(data.error || 'Failed to submit guess')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRevealAnswer = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'reveal_answer'
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to reveal answer')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col space-y-3.5 w-full">
      {/* Big Challenge Emoji */}
      <div className="text-center py-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center">
        <span className="text-[10px] font-bold opacity-75 uppercase tracking-wider mb-1">Guess the Emojis</span>
        <span className="text-4xl animate-bounce duration-1000">{emojiChallenge}</span>
      </div>

      {/* Gameplay inputs */}
      {game.status === 'active' && (
        <div className="space-y-3.5">
          {!isCreator ? (
            <form onSubmit={handleGuessSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Type your guess..."
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-xs focus:outline-none focus:border-white/30 placeholder-white/30 min-h-[36px]"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-white text-blue-600 font-bold rounded-xl text-xs hover:bg-gray-100 transition-colors cursor-pointer min-h-[36px]"
              >
                Send
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-semibold opacity-75 text-cyan-200">
                You created this challenge.
              </span>
              <button
                onClick={handleRevealAnswer}
                disabled={loading}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold border border-white/5 transition-colors cursor-pointer"
              >
                Reveal Answer & Concede
              </button>
            </div>
          )}

          {/* Result feedback */}
          {result === 'incorrect' && (
            <div className="text-center text-[10px] font-bold text-red-300">
              ❌ Wrong answer! Try again.
            </div>
          )}

          {/* List of guesses */}
          {guesses.length > 0 && (
            <div className="bg-black/10 p-2.5 rounded-xl border border-white/5">
              <span className="text-[8px] font-bold opacity-60 uppercase tracking-wider block mb-1">Recent Guesses</span>
              <div className="flex flex-wrap gap-1">
                {guesses.map((g, idx) => (
                  <span key={idx} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-[9px] font-medium max-w-[100px] truncate capitalize">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed state */}
      {game.status === 'completed' && (
        <div className="bg-black/10 p-3 rounded-2xl text-center space-y-2 border border-white/5">
          <div className="text-xs">
            <span className="opacity-75 block text-[9px]">Correct Answer</span>
            <span className="font-extrabold capitalize text-sm text-yellow-300">{correctAnswer}</span>
          </div>
          {result === 'revealed' && (
            <span className="text-[9px] block opacity-75 font-semibold">The answer was revealed.</span>
          )}
        </div>
      )}
    </div>
  )
}
