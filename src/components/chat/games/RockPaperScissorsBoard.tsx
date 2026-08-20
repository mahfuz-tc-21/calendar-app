'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

interface RockPaperScissorsBoardProps {
  game: {
    id: string
    state: {
      moves: Record<string, boolean>
      choices?: Record<string, string>
      revealed: boolean
    }
    status: string
    created_by: string
    opponent_id: string
  }
  currentUserId: string
}

export default function RockPaperScissorsBoard({ game, currentUserId }: RockPaperScissorsBoardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  
  const { moves, choices, revealed } = game.state
  const hasMoved = moves[currentUserId]

  const handleSelection = async (choice: 'rock' | 'paper' | 'scissors') => {
    if (hasMoved || loading) return
    setLoading(choice)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'select',
          payload: { choice }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to submit move')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const getEmoji = (choice: string) => {
    if (choice === 'rock') return '✊'
    if (choice === 'paper') return '✋'
    if (choice === 'scissors') return '✌️'
    return '❓'
  }

  const partnerId = currentUserId === game.created_by ? game.opponent_id : game.created_by
  const partnerMoved = moves[partnerId]

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Pending choice stage */}
      {!revealed && (
        <div className="space-y-3 w-full flex flex-col items-center">
          <span className="text-[10px] font-semibold opacity-75 bg-white/10 px-2 py-0.5 rounded-full">
            {partnerMoved ? '🤝 Opponent has chosen' : '⏳ Opponent choosing...'}
          </span>
          
          {!hasMoved ? (
            <div className="flex gap-2 justify-center w-full">
              {(['rock', 'paper', 'scissors'] as const).map((choice) => (
                <button
                  key={choice}
                  disabled={!!loading}
                  onClick={() => handleSelection(choice)}
                  className="flex flex-col items-center justify-center p-2.5 bg-white/10 hover:bg-white/20 rounded-xl flex-1 text-center transition-all cursor-pointer active:scale-95 border border-white/5 font-extrabold text-sm"
                >
                  <span className="text-xl mb-1">{getEmoji(choice)}</span>
                  <span className="text-[9px] capitalize">{choice}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] font-semibold text-center py-2 text-cyan-200">
              Locked in! Waiting for opponent...
            </div>
          )}
        </div>
      )}

      {/* Revealed stage */}
      {revealed && choices && (
        <div className="flex justify-around items-center w-full py-2 bg-white/5 rounded-2xl border border-white/10">
          <div className="text-center">
            <span className="block text-[9px] opacity-75">You</span>
            <span className="text-3xl block my-1">{getEmoji(choices[currentUserId])}</span>
            <span className="text-[9px] capitalize font-bold">{choices[currentUserId]}</span>
          </div>
          <span className="text-xs font-black text-white/30">VS</span>
          <div className="text-center">
            <span className="block text-[9px] opacity-75">Opponent</span>
            <span className="text-3xl block my-1">{getEmoji(choices[partnerId])}</span>
            <span className="text-[9px] capitalize font-bold">{choices[partnerId]}</span>
          </div>
        </div>
      )}
    </div>
  )
}
