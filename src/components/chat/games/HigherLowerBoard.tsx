'use client'

import React, { useState } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface HigherLowerBoardProps {
  game: {
    id: string
    state: {
      numbers: number[]
      round: number
      predictions: Record<string, 'higher' | 'lower' | null>
      scores: Record<string, number>
      player_one_id: string
      player_two_id: string
    }
    status: string
    created_by: string
  }
  currentUserId: string
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function HigherLowerBoard({ game, currentUserId, setActiveGames }: HigherLowerBoardProps) {
  const [loading, setLoading] = useState(false)

  const { numbers, round, predictions, scores, player_one_id, player_two_id } = game.state
  const currentNum = numbers[Math.min(round, 5)]
  const myPrediction = predictions[currentUserId]
  const opponentId = currentUserId === player_one_id ? player_two_id : player_one_id
  const opponentPrediction = predictions[opponentId]
  
  const hasPredicted = myPrediction !== null
  const isGameOver = game.status === 'completed'

  const handlePredict = async (prediction: 'higher' | 'lower') => {
    if (hasPredicted || loading || isGameOver) return

    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'predict',
          payload: { prediction }
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
        alert(data.error || 'Failed to submit guess')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-5 p-4 select-none max-w-sm w-full mx-auto">
      {/* Round & Game Status */}
      <div className="text-center space-y-1">
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
          {isGameOver ? 'Game Completed' : `Round ${Math.min(round + 1, 5)} / 5`}
        </span>
        <h3 className="text-xs text-muted-foreground">Predict if the next number will be higher or lower</h3>
      </div>

      {/* Scores Scorecard */}
      <div className="flex gap-4 w-full">
        <div className="flex-1 p-3 rounded-2xl bg-card border border-border text-center">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground">You</span>
          <span className="text-lg font-black text-foreground">{scores[currentUserId] || 0}</span>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-card border border-border text-center">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground">Opponent</span>
          <span className="text-lg font-black text-foreground">{scores[opponentId] || 0}</span>
        </div>
      </div>

      {/* Card Arena */}
      <div className="w-48 aspect-2/3 rounded-3xl border border-border bg-secondary/20 flex flex-col items-center justify-center p-6 relative shadow-xs overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-primary/10 to-transparent pointer-events-none" />
        
        {/* Large Main Number */}
        <span className="text-6xl font-black tracking-tight text-foreground select-none animate-in zoom-in-50 duration-200">
          {currentNum}
        </span>
        
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground mt-4">
          Current Number
        </span>
      </div>

      {/* Prediction actions */}
      {!isGameOver && (
        <div className="w-full space-y-3">
          {!hasPredicted ? (
            <div className="flex gap-3">
              <button
                disabled={loading}
                onClick={() => handlePredict('higher')}
                className="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 text-white font-extrabold rounded-2xl text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
              >
                <ArrowUp className="w-4 h-4" />
                Higher
              </button>
              <button
                disabled={loading}
                onClick={() => handlePredict('lower')}
                className="flex-1 py-3 px-4 bg-secondary text-foreground border border-border hover:bg-secondary/80 font-extrabold rounded-2xl text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
              >
                <ArrowDown className="w-4 h-4" />
                Lower
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-secondary/40 border border-border/70 text-center space-y-1">
              <span className="block text-xs font-bold text-foreground">
                Your prediction: <span className="uppercase text-primary">{myPrediction}</span>
              </span>
              <span className="block text-[10px] text-muted-foreground font-semibold">
                {opponentPrediction !== null 
                  ? 'Processing round outcome...' 
                  : "Waiting for opponent's choice..."
                }
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Game results log */}
      {isGameOver && (
        <div className="text-center font-black text-sm text-foreground animate-bounce mt-2">
          {scores[currentUserId] === scores[opponentId]
            ? '🤝 Match is a Draw!'
            : scores[currentUserId] > scores[opponentId]
              ? '🏆 You Won the Match!'
              : '💀 Opponent Won the Match!'
          }
        </div>
      )}
    </div>
  )
}
