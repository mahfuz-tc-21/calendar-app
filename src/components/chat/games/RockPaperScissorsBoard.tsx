import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

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
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function RockPaperScissorsBoard({ game, currentUserId, setActiveGames }: RockPaperScissorsBoardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [optimisticHasMoved, setOptimisticHasMoved] = useState<boolean | null>(null)
  
  const { moves, choices, revealed } = game.state
  const hasMoved = moves[currentUserId]
  const isOwn = game.created_by === currentUserId

  useEffect(() => {
    setOptimisticHasMoved(null)
  }, [hasMoved])

  const activeHasMoved = optimisticHasMoved !== null ? optimisticHasMoved : hasMoved

  const handleSelection = async (choice: 'rock' | 'paper' | 'scissors') => {
    if (activeHasMoved || loading) return
    
    // Optimistic Update: Instantly lock choice in UI
    setOptimisticHasMoved(true)

    setLoading(choice)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'select',
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
        setOptimisticHasMoved(null) // Rollback on error
        alert(data.error || 'Failed to submit move')
      }
    } catch (e) {
      setOptimisticHasMoved(null) // Rollback on error
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
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isOwn ? 'bg-white/10 text-white' : 'bg-black/5 text-gray-500'
          }`}>
            {partnerMoved ? '🤝 Opponent has chosen' : '⏳ Opponent choosing...'}
          </span>
          
          {!hasMoved ? (
            <div className="flex gap-2 justify-center w-full">
              {(['rock', 'paper', 'scissors'] as const).map((choice) => (
                <button
                  key={choice}
                  disabled={!!loading}
                  onClick={() => handleSelection(choice)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl flex-1 text-center transition-all cursor-pointer active:scale-95 border font-extrabold text-sm ${
                    isOwn 
                      ? 'bg-white/10 hover:bg-white/20 border-white/5 text-white' 
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="text-xl mb-1">{getEmoji(choice)}</span>
                  <span className="text-[9px] capitalize">{choice}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`text-[10px] font-semibold text-center py-2 ${
              isOwn ? 'text-cyan-200' : 'text-blue-600'
            }`}>
              Locked in! Waiting for opponent...
            </div>
          )}
        </div>
      )}

      {/* Revealed stage */}
      {revealed && choices && (
        <div className={`flex justify-around items-center w-full py-2 rounded-2xl border ${
          isOwn 
            ? 'bg-white/5 border-white/10 text-white' 
            : 'bg-black/5 border-gray-200 text-gray-800'
        }`}>
          <div className="text-center">
            <span className="block text-[9px] opacity-75">You</span>
            <span className="text-3xl block my-1">{getEmoji(choices[currentUserId])}</span>
            <span className="text-[9px] capitalize font-bold">{choices[currentUserId]}</span>
          </div>
          <span className={`text-xs font-black ${isOwn ? 'text-white/30' : 'text-gray-300'}`}>VS</span>
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
