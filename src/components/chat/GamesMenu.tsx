'use client'

import React, { useState } from 'react'
import { X, Gamepad2, ArrowRight } from 'lucide-react'
import { getApiUrl } from '@/utils/api'

interface GamesMenuProps {
  conversationId: string
  opponentId: string
  onClose: () => void
}

const WOULD_YOU_RATHER_QUESTIONS = [
  { optionA: "Live beside the ocean", optionB: "Live in the mountains" },
  { optionA: "Be able to fly", optionB: "Be invisible" },
  { optionA: "Always be 15 minutes late", optionB: "Always be 20 minutes early" },
  { optionA: "Travel 100 years into the past", optionB: "Travel 100 years into the future" },
  { optionA: "Speak all languages fluently", optionB: "Be able to speak to animals" },
  { optionA: "Win $1,000,000 today", optionB: "Win $10,000,000 in 10 years" },
  { optionA: "Only eat sweet foods for life", optionB: "Only eat spicy foods for life" },
  { optionA: "Have unlimited free flights", optionB: "Have unlimited free lodging" }
]

const EMOJI_GUESS_CURATED = [
  { challenge: "🦁👑", answer: "lion king" },
  { challenge: "🦇👨", answer: "batman" },
  { challenge: "🚀🌌", answer: "star wars" },
  { challenge: "🥚🍳🏃", answer: "breakfast run" },
  { challenge: "🍎📱", answer: "iphone" },
  { challenge: "🕸️🕷️👨", answer: "spiderman" }
]

export default function GamesMenu({ conversationId, opponentId, onClose }: GamesMenuProps) {
  const [loading, setLoading] = useState<string | null>(null)
  
  // Game config overlays
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null)
  
  // Custom inputs
  const [emojiChallenge, setEmojiChallenge] = useState('')
  const [emojiAnswer, setEmojiAnswer] = useState('')
  
  const [secretWord, setSecretWord] = useState('')
  const [wordCategory, setWordCategory] = useState('')

  const handleCreateGame = async (gameType: string, options?: any) => {
    setLoading(gameType)
    try {
      const res = await fetch(getApiUrl('/api/games/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          gameType,
          opponentId,
          options
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onClose()
      } else {
        alert(data.error || 'Failed to initialize game')
      }
    } catch (e) {
      console.error(e)
      alert('Network error initiating game')
    } finally {
      setLoading(null)
    }
  }

  const handleStartEmojiGuess = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emojiChallenge.trim() || !emojiAnswer.trim()) return
    handleCreateGame('emojiguess', {
      emojiChallenge: emojiChallenge.trim(),
      correctAnswer: emojiAnswer.trim()
    })
  }

  const handleStartWordGuess = (e: React.FormEvent) => {
    e.preventDefault()
    if (!secretWord.trim()) return
    handleCreateGame('wordguess', {
      secretWord: secretWord.trim(),
      category: wordCategory.trim() || 'General'
    })
  }

  const selectRandomWouldYouRather = () => {
    const idx = Math.floor(Math.random() * WOULD_YOU_RATHER_QUESTIONS.length)
    handleCreateGame('wouldyourather', WOULD_YOU_RATHER_QUESTIONS[idx])
  }

  const selectCuratedEmojiGuess = (item: typeof EMOJI_GUESS_CURATED[0]) => {
    handleCreateGame('emojiguess', {
      emojiChallenge: item.challenge,
      correctAnswer: item.answer
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-12 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-primary rounded-xl">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-gray-900">Game Room</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!selectedGameType ? (
            <div className="grid grid-cols-1 gap-3.5">
              {/* Tic-Tac-Toe */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('tictactoe')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Tic-Tac-Toe</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Realtime 3x3 grid battle</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Rock Paper Scissors */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('rps')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">✊</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Rock Paper Scissors</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Classic double blind match</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Emoji Guess */}
              <button
                disabled={!!loading}
                onClick={() => setSelectedGameType('emojiguess')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🤔</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Emoji Guess</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Challenge them with emojis</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Would You Rather */}
              <button
                disabled={!!loading}
                onClick={() => setSelectedGameType('wouldyourather')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🗳️</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Would You Rather</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Compare your choice of options</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Battleship */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('battleship')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🟦</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Battleship</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Strategize and sink their fleet</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Word Guess */}
              <button
                disabled={!!loading}
                onClick={() => setSelectedGameType('wordguess')}
                className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🧩</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Word Guess</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Set a secret word challenge</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedGameType(null)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← Back to Game List
              </button>

              {/* Configure Emoji Guess */}
              {selectedGameType === 'emojiguess' && (
                <div className="space-y-4">
                  {/* Curated list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Curated Challenges</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {EMOJI_GUESS_CURATED.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectCuratedEmojiGuess(item)}
                          className="p-3 text-left border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/30 transition-all text-xs font-semibold text-gray-700 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="text-xl">{item.challenge}</span>
                          <span className="truncate capitalize">{item.answer}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-center text-xs text-gray-400 my-1">— OR CREATE CUSTOM —</div>

                  <form onSubmit={handleStartEmojiGuess} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Emoji Challenge</label>
                      <input
                        type="text"
                        placeholder="e.g. 🦁👑"
                        value={emojiChallenge}
                        onChange={(e) => setEmojiChallenge(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Correct Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. lion king"
                        value={emojiAnswer}
                        onChange={(e) => setEmojiAnswer(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Send Custom Challenge
                    </button>
                  </form>
                </div>
              )}

              {/* Configure Would You Rather */}
              {selectedGameType === 'wouldyourather' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Choose a Question</h4>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {WOULD_YOU_RATHER_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCreateGame('wouldyourather', q)}
                          className="w-full p-3 text-left border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/30 transition-all text-xs text-gray-700 flex flex-col cursor-pointer"
                        >
                          <span className="font-semibold text-primary">{q.optionA}</span>
                          <span className="text-[10px] text-gray-400 font-medium">OR</span>
                          <span className="font-semibold text-gray-700">{q.optionB}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={selectRandomWouldYouRather}
                    className="w-full py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    🎲 Pick Random Question
                  </button>
                </div>
              )}

              {/* Configure Word Guess */}
              {selectedGameType === 'wordguess' && (
                <form onSubmit={handleStartWordGuess} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Secret Word</label>
                    <input
                      type="text"
                      placeholder="e.g. elephant"
                      value={secretWord}
                      onChange={(e) => setSecretWord(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Category (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Animals"
                      value={wordCategory}
                      onChange={(e) => setWordCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Start Word Guess Match
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
