'use client'

import React, { useState } from 'react'
import { X, Gamepad2, ArrowRight } from 'lucide-react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'
import dynamic from 'next/dynamic'

const TwoZeroFourEight = dynamic(() => import('./games/TwoZeroFourEight'), { ssr: false })
const GuessTheNumber = dynamic(() => import('./games/GuessTheNumber'), { ssr: false })
const MemoryCard = dynamic(() => import('./games/MemoryCard'), { ssr: false })

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
  const [loading] = useState<string | null>(null)
  const [activeOfflineGame, setActiveOfflineGame] = useState<'2048' | 'guessthenumber' | 'memorycard' | null>(null)
  
  // Game config overlays
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null)
  
  // Custom inputs
  const [emojiChallenge, setEmojiChallenge] = useState('')
  const [emojiAnswer, setEmojiAnswer] = useState('')
  
  const [secretWord, setSecretWord] = useState('')
  const [wordCategory, setWordCategory] = useState('')

  const handleCreateGame = async (gameType: string, options?: any) => {
    onClose()
    
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/create'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          gameType,
          opponentId,
          options
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to initialize game')
      }
    } catch (e) {
      console.error(e)
      alert('Network error initiating game')
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
        className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-12 duration-200 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-primary dark:text-blue-400 rounded-xl">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-foreground">Game Room</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {!selectedGameType ? (
            <div className="grid grid-cols-1 gap-3.5">
              {/* Connect Four */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('connectfour')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl animate-pulse">🔴</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Connect Four</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Realtime two-player board match</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Dots & Boxes */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('dotsandboxes')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">📦</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Dots & Boxes</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Realtime line connection match</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Higher or Lower */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('higherlower')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🔢</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Higher or Lower</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Predict the next card value</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Reaction Battle */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('reactionbattle')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Reaction Battle</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Fast-paced reaction tap war</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Tic-Tac-Toe */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('tictactoe')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Tic-Tac-Toe</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Realtime 3x3 grid battle</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Rock Paper Scissors */}
              <button
                disabled={!!loading}
                onClick={() => handleCreateGame('rps')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">✊</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Rock Paper Scissors</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Classic double blind match</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Emoji Guess */}
              <button
                disabled={!!loading}
                onClick={() => setSelectedGameType('emojiguess')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🤔</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Emoji Guess</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Challenge them with emojis</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>



              {/* Word Guess */}
              <button
                disabled={!!loading}
                onClick={() => setSelectedGameType('wordguess')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🧩</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Word Guess</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Set a secret word challenge</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 2048 Game (Offline) */}
              <button
                disabled={!!loading}
                onClick={() => setActiveOfflineGame('2048')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🔢</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">2048 Game</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Single-player offline tile slider</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Guess the Number (Offline) */}
              <button
                disabled={!!loading}
                onClick={() => setActiveOfflineGame('guessthenumber')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎲</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Guess the Number</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Single-player offline guessing challenge</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Memory Match (Offline) */}
              <button
                disabled={!!loading}
                onClick={() => setActiveOfflineGame('memorycard')}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-blue-500/35 hover:bg-blue-500/5 flex items-center justify-between group transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎴</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Memory Card Match</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Single-player offline pair matching</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-450 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedGameType(null)}
                className="text-xs text-primary dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← Back to Game List
              </button>

              {/* Configure Emoji Guess */}
              {selectedGameType === 'emojiguess' && (
                <div className="space-y-4">
                  {/* Curated list */}
                  <div className="space-y-2 text-left">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Curated Challenges</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {EMOJI_GUESS_CURATED.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectCuratedEmojiGuess(item)}
                          className="p-3 text-left border border-border rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-xs font-semibold text-foreground flex items-center gap-2 cursor-pointer bg-card"
                        >
                          <span className="text-xl">{item.challenge}</span>
                          <span className="truncate capitalize">{item.answer}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-center text-xs text-muted-foreground my-1">— OR CREATE CUSTOM —</div>

                  <form onSubmit={handleStartEmojiGuess} className="space-y-3 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1 pl-1">Emoji Challenge</label>
                      <input
                        type="text"
                        placeholder="e.g. 🦁👑"
                        value={emojiChallenge}
                        onChange={(e) => setEmojiChallenge(e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-card rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1 pl-1">Correct Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. lion king"
                        value={emojiAnswer}
                        onChange={(e) => setEmojiAnswer(e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-card rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-primary hover:bg-blue-600 dark:hover:bg-blue-500 text-primary-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Send Custom Challenge
                    </button>
                  </form>
                </div>
              )}

              {/* Configure Would You Rather */}
              {selectedGameType === 'wouldyourather' && (
                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Choose a Question</h4>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                      {WOULD_YOU_RATHER_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCreateGame('wouldyourather', q)}
                          className="w-full p-3 text-left border border-border rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-xs text-foreground flex flex-col cursor-pointer bg-card"
                        >
                          <span className="font-semibold text-primary dark:text-blue-400">{q.optionA}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold my-0.5">OR</span>
                          <span className="font-semibold text-foreground">{q.optionB}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={selectRandomWouldYouRather}
                    className="w-full py-2.5 bg-primary hover:bg-blue-600 dark:hover:bg-blue-500 text-primary-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    🎲 Pick Random Question
                  </button>
                </div>
              )}

              {/* Configure Word Guess */}
              {selectedGameType === 'wordguess' && (
                <form onSubmit={handleStartWordGuess} className="space-y-3 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 pl-1">Secret Word</label>
                    <input
                      type="text"
                      placeholder="e.g. elephant"
                      value={secretWord}
                      onChange={(e) => setSecretWord(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-card rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 pl-1">Hint / Category (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Animals, Movies, Country"
                      value={wordCategory}
                      onChange={(e) => setWordCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-card rounded-xl text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary hover:bg-blue-600 dark:hover:bg-blue-500 text-primary-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Start Word Guess Match
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Offline Single Player Overlays */}
      {activeOfflineGame === '2048' && (
        <TwoZeroFourEight onClose={() => setActiveOfflineGame(null)} />
      )}
      {activeOfflineGame === 'guessthenumber' && (
        <GuessTheNumber onClose={() => setActiveOfflineGame(null)} />
      )}
      {activeOfflineGame === 'memorycard' && (
        <MemoryCard onClose={() => setActiveOfflineGame(null)} />
      )}
    </div>
  )
}
