'use client'

import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

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
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function EmojiGuessBoard({ game, currentUserId, setActiveGames }: EmojiGuessBoardProps) {
  const [guessText, setGuessText] = useState('')
  const [loading, setLoading] = useState(false)
  const [optimisticGuesses, setOptimisticGuesses] = useState<string[] | null>(null)

  const isCreator = game.created_by === currentUserId
  const { emojiChallenge, guessed, result, guesses = [], correctAnswer } = game.state

  useEffect(() => {
    setOptimisticGuesses(null)
  }, [guesses])

  const activeGuesses = optimisticGuesses || guesses

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guessText.trim() || loading) return
    
    const nextGuess = guessText.trim()
    setGuessText('')

    // Optimistic Update: Add guess to list instantly
    setOptimisticGuesses([...activeGuesses, nextGuess])

    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'submit_guess',
          payload: { guess: nextGuess }
        })
      })
      const data = await res.json()
      if (res.ok && data.success && data.game) {
        if (setActiveGames) {
          setActiveGames((prev) => ({
            ...prev,
            [data.game.id]: data.game
          }))
        }
      } else {
        setOptimisticGuesses(null) // Rollback on error
        alert(data.error || 'Failed to submit guess')
      }
    } catch (e) {
      setOptimisticGuesses(null) // Rollback on error
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRevealAnswer = async () => {
    if (loading) return
    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
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
      <div className={`text-center py-4 rounded-2xl border flex flex-col items-center ${
        isCreator 
          ? 'bg-white/5 border-white/10 text-white' 
          : 'bg-black/5 dark:bg-white/5 border-gray-200 dark:border-border text-foreground'
      }`}>
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
                className="flex-1 min-w-0 px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs focus:outline-none focus:border-gray-400 placeholder:text-muted-foreground min-h-[36px]"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[36px]"
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
            <div className="text-center text-[10px] font-bold text-red-500">
              ❌ Wrong answer! Try again.
            </div>
          )}

          {/* List of guesses */}
          {activeGuesses.length > 0 && (
            <div className={`p-2.5 rounded-xl border ${
              isCreator 
                ? 'bg-black/10 border-white/5' 
                : 'bg-black/5 dark:bg-white/5 border-gray-200/50 dark:border-border'
            }`}>
              <span className={`text-[8px] font-bold uppercase tracking-wider block mb-1 ${
                isCreator ? 'opacity-60 text-white' : 'text-muted-foreground'
              }`}>Recent Guesses</span>
              <div className="flex flex-wrap gap-1">
                {activeGuesses.map((g, idx) => (
                  <span key={idx} className={`border px-2 py-0.5 rounded-md text-[9px] font-medium max-w-[100px] truncate capitalize ${
                    isCreator 
                      ? 'bg-white/5 border-white/5 text-white' 
                      : 'bg-card dark:bg-secondary border-border text-foreground'
                  }`}>
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
        <div className={`p-3 rounded-2xl text-center space-y-2 border ${
          isCreator 
            ? 'bg-black/10 border-white/5 text-white' 
            : 'bg-black/5 dark:bg-white/5 border-gray-200 dark:border-border text-foreground'
        }`}>
          <div className="text-xs">
            <span className="opacity-75 block text-[9px]">Correct Answer</span>
            <span className={`font-extrabold capitalize text-sm ${
              isCreator ? 'text-yellow-300' : 'text-blue-600 dark:text-blue-400'
            }`}>{correctAnswer}</span>
          </div>
          {result === 'revealed' && (
            <span className="text-[9px] block opacity-75 font-semibold">The answer was revealed.</span>
          )}
        </div>
      )}
    </div>
  )
}
