'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

interface WordGuessBoardProps {
  game: {
    id: string
    state: {
      category: string
      wordLength: number
      guesses: string[]
      attemptsLeft: number
      maxAttempts: number
      status: string
      secretWord?: string
    }
    status: string
    created_by: string
  }
  currentUserId: string
}

export default function WordGuessBoard({ game, currentUserId }: WordGuessBoardProps) {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)

  const isCreator = game.created_by === currentUserId
  const { category, wordLength, guesses = [], attemptsLeft, maxAttempts, secretWord } = game.state

  const handleGuessSubmit = async (e: React.FormEvent, isFullWord = false) => {
    e.preventDefault()
    const cleanInput = inputText.trim().toUpperCase()
    if (!cleanInput || loading) return

    setLoading(true)
    try {
      const actionType = isFullWord ? 'guess_word' : 'guess_letter'
      const payloadVal = isFullWord ? { word: cleanInput } : { letter: cleanInput[0] }

      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: actionType,
          payload: payloadVal
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setInputText('')
      } else {
        alert(data.error || 'Failed to submit guess')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Generate word placeholder
  const renderPlaceholder = () => {
    if (game.status === 'completed' && secretWord) {
      return secretWord.split('').map((char, idx) => (
        <span key={idx} className="border-b-2 border-yellow-300 font-black text-sm uppercase px-1 text-yellow-300">
          {char}
        </span>
      ))
    }

    // Hide secret word, only show correctly guessed letters
    if (secretWord) {
      return secretWord.split('').map((char, idx) => {
        const isGuessed = guesses.includes(char.toUpperCase())
        return (
          <span key={idx} className="border-b-2 border-white/30 font-black text-sm uppercase px-1 min-w-[12px] text-center">
            {char === ' ' ? '\u00A0' : isGuessed ? char : '_'}
          </span>
        )
      })
    }

    // Fallback if secretWord is hidden from client
    return Array.from({ length: wordLength }).map((_, idx) => (
      <span key={idx} className="border-b-2 border-white/30 font-black text-sm uppercase px-1 min-w-[12px] text-center">
        {guesses.includes(String(idx)) ? '?' : '_'}
      </span>
    ))
  }

  // Split guesses into letters and words
  const guessedLetters = guesses.filter(g => g.length === 1)
  const guessedWords = guesses.filter(g => g.startsWith('GUESS: ')).map(g => g.replace('GUESS: ', ''))

  return (
    <div className="flex flex-col space-y-3.5 w-full">
      {/* Category banner */}
      <div className="text-center py-2.5 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
        <span className="text-[9px] font-bold opacity-75 uppercase tracking-wider">Category</span>
        <span className="text-xs font-black capitalize text-cyan-300">{category}</span>
      </div>

      {/* Word Placeholder display */}
      <div className="flex justify-center gap-1 py-3 bg-black/15 rounded-xl border border-white/5 flex-wrap">
        {renderPlaceholder()}
      </div>

      {/* Active gameplay guess inputs */}
      {game.status === 'active' && (
        <div className="space-y-3">
          {!isCreator ? (
            <div className="space-y-2.5">
              {/* Guess letter form */}
              <form onSubmit={(e) => handleGuessSubmit(e, false)} className="flex gap-2">
                <input
                  type="text"
                  maxLength={1}
                  placeholder="Guess letter..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-xs focus:outline-none focus:border-white/30 placeholder-white/30 min-h-[36px]"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-white text-blue-600 font-bold rounded-xl text-xs hover:bg-gray-100 transition-colors cursor-pointer min-h-[36px]"
                >
                  Guess
                </button>
              </form>

              {/* Guess full word form */}
              <form onSubmit={(e) => handleGuessSubmit(e, true)} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Guess full word..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 border border-white/10 bg-white/5 text-white rounded-xl text-xs focus:outline-none focus:border-white/30 placeholder-white/30 min-h-[36px]"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/5 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[36px]"
                >
                  Solve
                </button>
              </form>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[10px] font-semibold opacity-75 text-cyan-200">
                You set this word. Waiting for guesser...
              </span>
            </div>
          )}

          {/* Attempts counter */}
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] opacity-75 font-semibold">Attempts left:</span>
            <span className={`text-xs font-black ${
              attemptsLeft <= 2 ? 'text-red-300' : 'text-green-300'
            }`}>
              {attemptsLeft}/{maxAttempts}
            </span>
          </div>

          {/* Guesses log */}
          {(guessedLetters.length > 0 || guessedWords.length > 0) && (
            <div className="bg-black/10 p-2.5 rounded-xl border border-white/5 space-y-1.5">
              {guessedLetters.length > 0 && (
                <div>
                  <span className="text-[8px] font-bold opacity-60 uppercase tracking-wider block mb-0.5">Guessed Letters</span>
                  <div className="flex flex-wrap gap-1">
                    {guessedLetters.map((l, idx) => (
                      <span key={idx} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-[9px] font-bold text-gray-300">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {guessedWords.length > 0 && (
                <div>
                  <span className="text-[8px] font-bold opacity-60 uppercase tracking-wider block mb-0.5">Guessed Words</span>
                  <div className="flex flex-col gap-1">
                    {guessedWords.map((w, idx) => (
                      <span key={idx} className="text-[9px] font-medium text-red-300 line-through">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed state */}
      {game.status === 'completed' && secretWord && (
        <div className="bg-black/10 p-3 rounded-2xl text-center space-y-1 border border-white/5">
          <span className="opacity-75 block text-[9px]">Secret Word</span>
          <span className="font-extrabold capitalize text-sm text-yellow-300">{secretWord}</span>
        </div>
      )}
    </div>
  )
}
