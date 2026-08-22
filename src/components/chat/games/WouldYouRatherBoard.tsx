'use client'

import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

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
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function WouldYouRatherBoard({ game, currentUserId, setActiveGames }: WouldYouRatherBoardProps) {
  const [loading, setLoading] = useState<'A' | 'B' | null>(null)
  const [optimisticVote, setOptimisticVote] = useState<string | null>(null)

  const { optionA, optionB, votes, choices, revealed } = game.state
  const myVote = votes[currentUserId]
  const isOwn = game.created_by === currentUserId

  useEffect(() => {
    setOptimisticVote(null)
  }, [myVote])

  const activeVote = optimisticVote !== null ? optimisticVote : myVote

  const handleVote = async (choice: 'A' | 'B') => {
    if (activeVote !== null || loading) return
    
    // Optimistic Update: Set choice instantly in local view
    setOptimisticVote(choice)

    setLoading(choice)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'vote',
          payload: { choice }
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
        setOptimisticVote(null) // Rollback on error
        alert(data.error || 'Failed to submit vote')
      }
    } catch (e) {
      setOptimisticVote(null) // Rollback on error
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
            disabled={activeVote !== null || !!loading}
            onClick={() => handleVote('A')}
            className={`w-full p-4 text-left border rounded-2xl transition-all cursor-pointer font-bold text-xs ${
              activeVote !== null
                ? (isOwn ? 'bg-white/5 border-white/5 opacity-50 text-white' : 'bg-black/5 dark:bg-white/5 border-gray-250 dark:border-border opacity-50 text-gray-400')
                : (isOwn 
                    ? 'bg-white/10 border-white/5 hover:bg-white/20 active:scale-98 text-white' 
                    : 'bg-card dark:bg-secondary border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-secondary/85 active:scale-98 text-foreground')
            }`}
          >
            {loading === 'A' ? (
              <span className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin block mx-auto ${isOwn ? 'border-white' : 'border-blue-600'}`}></span>
            ) : (
              optionA
            )}
          </button>

          <div className={`text-center text-[9px] font-bold ${
            isOwn ? 'text-white/40' : 'text-muted-foreground'
          }`}>OR</div>

          <button
            disabled={activeVote !== null || !!loading}
            onClick={() => handleVote('B')}
            className={`w-full p-4 text-left border rounded-2xl transition-all cursor-pointer font-bold text-xs ${
              activeVote !== null 
                ? (isOwn ? 'bg-white/5 border-white/5 opacity-50 text-white' : 'bg-black/5 dark:bg-white/5 border-gray-250 dark:border-border opacity-50 text-gray-400')
                : (isOwn 
                    ? 'bg-white/10 border-white/5 hover:bg-white/20 active:scale-98 text-white' 
                    : 'bg-card dark:bg-secondary border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-secondary/85 active:scale-98 text-foreground')
            }`}
          >
            {loading === 'B' ? (
              <span className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin block mx-auto ${isOwn ? 'border-white' : 'border-blue-600'}`}></span>
            ) : (
              optionB
            )}
          </button>

          <div className="text-center py-1">
            <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full ${
              isOwn ? 'bg-white/10 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'
            }`}>
              {partnerVoted ? '🤝 Opponent has voted' : '⏳ Opponent voting...'}
            </span>
          </div>
        </div>
      )}

      {/* Results panel */}
      {revealed && choices && (
        <div className={`space-y-2.5 p-3.5 rounded-2xl border ${
          isOwn 
            ? 'bg-black/10 border-white/5 text-white' 
            : 'bg-black/5 dark:bg-white/5 border-gray-200 dark:border-border text-foreground'
        }`}>
          {/* Option A Result */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="truncate pr-2">{optionA}</span>
              <span className={`font-extrabold ${isOwn ? 'text-cyan-300' : 'text-blue-600 dark:text-blue-400'}`}>
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

          <hr className={isOwn ? 'border-white/5 my-2' : 'border-gray-200 dark:border-border my-2'} />

          {/* Option B Result */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="truncate pr-2">{optionB}</span>
              <span className={`font-extrabold ${isOwn ? 'text-cyan-300' : 'text-blue-600 dark:text-blue-400'}`}>
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
