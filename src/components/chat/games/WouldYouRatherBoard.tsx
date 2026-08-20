'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

interface WouldYouRatherBoardProps {
  game: {
    id: string
    state: {
      optionA: string
      optionB: string
      votes: Record<string, boolean | null>
      choices?: Record<string, 'A' | 'B'>
      revealed: boolean
    }
    status: string
    created_by: string
    opponent_id: string
  }
  currentUserId: string
}

export default function WouldYouRatherBoard({ game, currentUserId }: WouldYouRatherBoardProps) {
  const [loading, setLoading] = useState<'A' | 'B' | null>(null)

  const { optionA, optionB, votes, choices, revealed } = game.state
  const myVote = votes[currentUserId]

  const handleVote = async (choice: 'A' | 'B') => {
    if (myVote !== null || loading) return
    setLoading(choice)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'vote',
          payload: { choice }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to submit vote')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const partnerId = currentUserId === game.created_by ? game.opponent_id : game.created_by
  const partnerVoted = votes[partnerId] !== null

  return (
    <div className="flex flex-col space-y-3.5 w-full">
      <div className="text-center">
        <span className="text-[10px] font-bold opacity-75 uppercase tracking-wider block mb-1">Would You Rather...</span>
      </div>

      {/* Voting panel */}
      {!revealed && (
        <div className="space-y-2.5">
          <button
            disabled={myVote !== null || !!loading}
            onClick={() => handleVote('A')}
            className={`w-full p-4 text-left border rounded-2xl transition-all cursor-pointer font-bold text-xs ${
              myVote === true // wait, votes stores true/false just to indicate if voted
                ? 'bg-white/5 border-white/5 opacity-50' 
                : 'bg-white/10 border-white/5 hover:bg-white/20 active:scale-98'
            }`}
          >
            {loading === 'A' ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block mx-auto"></span>
            ) : (
              optionA
            )}
          </button>

          <div className="text-center text-[9px] font-bold text-white/40">OR</div>

          <button
            disabled={myVote !== null || !!loading}
            onClick={() => handleVote('B')}
            className={`w-full p-4 text-left border rounded-2xl transition-all cursor-pointer font-bold text-xs ${
              myVote !== null 
                ? 'bg-white/5 border-white/5 opacity-50' 
                : 'bg-white/10 border-white/5 hover:bg-white/20 active:scale-98'
            }`}
          >
            {loading === 'B' ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block mx-auto"></span>
            ) : (
              optionB
            )}
          </button>

          <div className="text-center py-1">
            <span className="text-[9px] font-semibold opacity-75 bg-white/10 px-2.5 py-0.5 rounded-full">
              {partnerVoted ? '🤝 Opponent has voted' : '⏳ Opponent voting...'}
            </span>
          </div>
        </div>
      )}

      {/* Results panel */}
      {revealed && choices && (
        <div className="space-y-2.5 bg-black/10 p-3.5 rounded-2xl border border-white/5">
          {/* Option A Result */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="truncate pr-2">{optionA}</span>
              <span className="font-extrabold text-cyan-300">
                {Object.values(choices).filter(v => v === 'A').length} vote(s)
              </span>
            </div>
            {choices[currentUserId] === 'A' && (
              <span className="text-[8px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.25 rounded">Your Choice</span>
            )}
            {choices[partnerId] === 'A' && (
              <span className="text-[8px] bg-white/10 text-gray-300 font-bold px-1.5 py-0.25 rounded ml-1">Opponent's Choice</span>
            )}
          </div>

          <hr className="border-white/5 my-2" />

          {/* Option B Result */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="truncate pr-2">{optionB}</span>
              <span className="font-extrabold text-cyan-300">
                {Object.values(choices).filter(v => v === 'B').length} vote(s)
              </span>
            </div>
            {choices[currentUserId] === 'B' && (
              <span className="text-[8px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.25 rounded">Your Choice</span>
            )}
            {choices[partnerId] === 'B' && (
              <span className="text-[8px] bg-white/10 text-gray-300 font-bold px-1.5 py-0.25 rounded ml-1">Opponent's Choice</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
