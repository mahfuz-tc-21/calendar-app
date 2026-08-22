'use client'

import React, { useState, useEffect } from 'react'
import { RotateCcw, HelpCircle, Check, X } from 'lucide-react'

interface GuessTheNumberProps {
  onClose: () => void
}

export default function GuessTheNumber({ onClose }: GuessTheNumberProps) {
  const [targetNumber, setTargetNumber] = useState(0)
  const [guess, setGuess] = useState('')
  const [attempts, setAttempts] = useState<number[]>([])
  const [feedback, setFeedback] = useState<'too_high' | 'too_low' | 'correct' | null>(null)
  const [gameOver, setGameOver] = useState(false)

  // Generate a random target number between 1 and 100
  const initGame = () => {
    setTargetNumber(Math.floor(Math.random() * 100) + 1)
    setGuess('')
    setAttempts([])
    setFeedback(null)
    setGameOver(false)
  }

  useEffect(() => {
    initGame()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (gameOver) return

    const numGuess = parseInt(guess, 10)
    if (isNaN(numGuess) || numGuess < 1 || numGuess > 100) {
      alert('Please enter a valid number between 1 and 100.')
      return
    }

    const nextAttempts = [numGuess, ...attempts]
    setAttempts(nextAttempts)
    setGuess('')

    if (numGuess === targetNumber) {
      setFeedback('correct')
      setGameOver(true)
    } else if (numGuess > targetNumber) {
      setFeedback('too_high')
    } else {
      setFeedback('too_low')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <header className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤔</span>
          <span className="font-bold text-sm text-foreground">Guess the Number</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-sm w-full mx-auto space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <HelpCircle className="w-12 h-12 text-primary animate-bounce duration-1000" />
          <h2 className="text-base font-extrabold text-foreground">I am thinking of a number...</h2>
          <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
            Can you guess the correct secret number between **1** and **100**?
          </p>
        </div>

        {/* Input / Feedback Area */}
        <div className="w-full bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
          {feedback && (
            <div className={`p-3.5 rounded-2xl text-center text-xs font-bold border transition-all ${
              feedback === 'correct' 
                ? 'bg-green-500/10 border-green-500/25 text-green-500' 
                : 'bg-primary/5 border-primary/10 text-primary dark:text-blue-400'
            }`}>
              {feedback === 'too_high' && '📈 Too high! Try guessing lower.'}
              {feedback === 'too_low' && '📉 Too low! Try guessing higher.'}
              {feedback === 'correct' && `🎉 Correct! The number was ${targetNumber}.`}
            </div>
          )}

          {!gameOver ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Enter 1 - 100"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                required
                disabled={gameOver}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-primary hover:bg-blue-600 text-primary-foreground font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shrink-0 min-h-[40px]"
              >
                Guess
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-xs text-muted-foreground font-semibold">
                Cleared in **{attempts.length}** attempts!
              </div>
              <button
                onClick={initGame}
                className="w-full py-2.5 bg-primary hover:bg-blue-600 text-primary-foreground font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Attempt Log Grid */}
        {attempts.length > 0 && (
          <div className="w-full space-y-2 text-left">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
              Guess History ({attempts.length})
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
              {attempts.map((g, idx) => (
                <span 
                  key={idx}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 shrink-0 ${
                    g === targetNumber
                      ? 'bg-green-500/10 border-green-500/25 text-green-500'
                      : g > targetNumber
                        ? 'bg-secondary border-border text-muted-foreground'
                        : 'bg-secondary border-border text-muted-foreground'
                  }`}
                >
                  {g}
                  <span className="text-[8px] opacity-75 font-normal">
                    {g === targetNumber ? '✅' : g > targetNumber ? '📈' : '📉'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer spacer */}
      <div className="shrink-0 p-4" />
    </div>
  )
}
