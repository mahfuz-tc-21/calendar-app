import React, { useState, useEffect } from 'react'
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
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function WordGuessBoard({ game, currentUserId, setActiveGames }: WordGuessBoardProps) {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [optimisticGuesses, setOptimisticGuesses] = useState<string[] | null>(null)

  const isCreator = game.created_by === currentUserId
  const { category, wordLength, guesses = [], attemptsLeft, maxAttempts, secretWord } = game.state

  useEffect(() => {
    setOptimisticGuesses(null)
  }, [guesses])

  const activeGuesses = optimisticGuesses || guesses

  const handleGuessSubmit = async (e: React.FormEvent, isFullWord = false) => {
    e.preventDefault()
    const cleanInput = inputText.trim().toUpperCase()
    if (!cleanInput || loading) return

    // Optimistic Update: Append guess to list and clear input instantly
    const cleanGuess = isFullWord ? `GUESS: ${cleanInput}` : cleanInput[0]
    setOptimisticGuesses([...activeGuesses, cleanGuess])
    setInputText('')

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

  // Generate word placeholder
  const renderPlaceholder = () => {
    const textClass = isCreator ? 'text-white' : 'text-gray-800'
    const borderClass = isCreator ? 'border-white/30' : 'border-gray-400'

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
        const isGuessed = activeGuesses.includes(char.toUpperCase())
        return (
          <span key={idx} className={`border-b-2 font-black text-sm uppercase px-1 min-w-[12px] text-center ${borderClass} ${textClass}`}>
            {char === ' ' ? '\u00A0' : isGuessed ? char : '_'}
          </span>
        )
      })
    }

    // Fallback if secretWord is hidden from client
    return Array.from({ length: wordLength }).map((_, idx) => (
      <span key={idx} className={`border-b-2 font-black text-sm uppercase px-1 min-w-[12px] text-center ${borderClass} ${textClass}`}>
        {activeGuesses.includes(String(idx)) ? '?' : '_'}
      </span>
    ))
  }

  // Split guesses into letters and words
  const guessedLetters = activeGuesses.filter(g => g.length === 1)
  const guessedWords = activeGuesses.filter(g => g.startsWith('GUESS: ')).map(g => g.replace('GUESS: ', ''))

  return (
    <div className="flex flex-col space-y-3.5 w-full">
      {/* Category/Hint banner */}
      <div className={`text-center py-2.5 rounded-xl border flex flex-col items-center ${
        isCreator 
          ? 'bg-white/5 border-white/10 text-white' 
          : 'bg-black/5 border-gray-200 text-gray-800'
      }`}>
        <span className="text-[9px] font-bold opacity-75 uppercase tracking-wider">Hint</span>
        <span className={`text-xs font-black capitalize ${
          isCreator ? 'text-cyan-300' : 'text-blue-600'
        }`}>{category}</span>
      </div>

      {/* Word Placeholder display */}
      <div className={`flex justify-center gap-1 py-3 rounded-xl border flex-wrap ${
        isCreator 
          ? 'bg-black/15 border-white/5' 
          : 'bg-black/5 border-gray-200'
      }`}>
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
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-200 bg-white text-gray-800 rounded-xl text-xs focus:outline-none focus:border-gray-300 placeholder-gray-400 min-h-[36px]"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[36px]"
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
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-200 bg-white text-gray-800 rounded-xl text-xs focus:outline-none focus:border-gray-300 placeholder-gray-400 min-h-[36px]"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[36px]"
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
            <span className={`text-[9px] font-semibold ${isCreator ? 'opacity-75' : 'text-gray-500'}`}>Attempts left:</span>
            <span className={`text-xs font-black ${
              attemptsLeft <= 2 
                ? (isCreator ? 'text-red-300' : 'text-red-600') 
                : (isCreator ? 'text-green-300' : 'text-green-600')
            }`}>
              {attemptsLeft}/{maxAttempts}
            </span>
          </div>

          {/* Guesses log */}
          {(guessedLetters.length > 0 || guessedWords.length > 0) && (
            <div className={`p-2.5 rounded-xl border ${
              isCreator 
                ? 'bg-black/10 border-white/5' 
                : 'bg-black/5 border-gray-200/55'
            } space-y-1.5`}>
              {guessedLetters.length > 0 && (
                <div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider block mb-0.5 ${isCreator ? 'opacity-60 text-white' : 'text-gray-500'}`}>Guessed Letters</span>
                  <div className="flex flex-wrap gap-1">
                    {guessedLetters.map((l, idx) => (
                      <span key={idx} className={`border px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        isCreator 
                          ? 'bg-white/5 border-white/5 text-gray-300' 
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {guessedWords.length > 0 && (
                <div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider block mb-0.5 ${isCreator ? 'opacity-60 text-white' : 'text-gray-500'}`}>Guessed Words</span>
                  <div className="flex flex-col gap-1">
                    {guessedWords.map((w, idx) => (
                      <span key={idx} className={`text-[9px] font-medium line-through ${
                        isCreator ? 'text-red-300' : 'text-red-600'
                      }`}>
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
        <div className={`p-3 rounded-2xl text-center space-y-1 border ${
          isCreator 
            ? 'bg-black/10 border-white/5 text-white' 
            : 'bg-black/5 border-gray-200 text-gray-800'
        }`}>
          <span className="opacity-75 block text-[9px]">Secret Word</span>
          <span className={`font-extrabold capitalize text-sm ${
            isCreator ? 'text-yellow-300' : 'text-blue-600'
          }`}>{secretWord}</span>
        </div>
      )}
    </div>
  )
}
