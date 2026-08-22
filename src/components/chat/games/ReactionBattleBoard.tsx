'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'
import { Zap, Timer, CheckCircle, AlertCircle } from 'lucide-react'

interface ReactionBattleBoardProps {
  game: {
    id: string
    state: {
      round: number
      ready: Record<string, boolean>
      targetTime: number | null
      reactions: Record<string, number | null>
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

export default function ReactionBattleBoard({ game, currentUserId, setActiveGames }: ReactionBattleBoardProps) {
  const [loading, setLoading] = useState(false)
  const [localTime, setLocalTime] = useState(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const { round, ready, targetTime, reactions, scores, player_one_id, player_two_id } = game.state
  const opponentId = currentUserId === player_one_id ? player_two_id : player_one_id
  
  const isMeReady = ready[currentUserId] === true
  const isOpponentReady = ready[opponentId] === true
  const bothReady = isMeReady && isOpponentReady
  const isGameOver = game.status === 'completed'

  // Update clock when countdown is active
  useEffect(() => {
    if (targetTime && bothReady) {
      timerRef.current = setInterval(() => {
        setLocalTime(Date.now())
      }, 30) // fast interval for smooth trigger
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [targetTime, bothReady])

  const handleReady = async () => {
    if (isMeReady || loading || isGameOver) return

    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'ready'
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
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleTap = async () => {
    if (reactions[currentUserId] !== null || loading || !targetTime || isGameOver) return

    const tapTime = Date.now()
    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'tap',
          payload: { tapTime }
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
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Calculate current stage
  let showTarget = false
  let countdownText = ''
  if (targetTime && bothReady) {
    const diff = targetTime - localTime
    if (diff > 0) {
      if (diff > 2000) {
        countdownText = '3'
      } else if (diff > 1000) {
        countdownText = '2'
      } else {
        countdownText = '1'
      }
    } else {
      showTarget = true
    }
  }

  return (
    <div className="flex flex-col items-center space-y-5 p-4 select-none max-w-sm w-full mx-auto">
      {/* Round & Game Status */}
      <div className="text-center space-y-1">
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
          {isGameOver ? 'Game Completed' : `Round ${Math.min(round, 5)} / 5`}
        </span>
        <h3 className="text-xs text-muted-foreground">Tap as fast as possible when the target changes to ⚡</h3>
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

      {/* Battleground Area */}
      <div className="w-full aspect-square max-w-[280px] rounded-3xl border border-border bg-secondary/25 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {isGameOver ? (
          <div className="text-center space-y-2 animate-in zoom-in-50 duration-200">
            <CheckCircle className="w-12 h-12 text-primary mx-auto animate-bounce" />
            <h2 className="text-base font-extrabold text-foreground">
              {scores[currentUserId] === scores[opponentId]
                ? '🤝 Match is a Draw!'
                : scores[currentUserId] > scores[opponentId]
                  ? '🏆 You Won!'
                  : '💀 Opponent Won!'
              }
            </h2>
          </div>
        ) : !bothReady ? (
          /* Ready Stage */
          <div className="text-center space-y-4 w-full">
            <div className="flex flex-col gap-2.5 max-w-[200px] mx-auto">
              <span className={`text-[10px] font-bold py-1 px-3.5 rounded-full border transition-all ${
                isMeReady 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : 'bg-secondary border-border text-muted-foreground'
              }`}>
                {isMeReady ? '✓ You are Ready' : '⏳ Waiting for your ready...'}
              </span>
              <span className={`text-[10px] font-bold py-1 px-3.5 rounded-full border transition-all ${
                isOpponentReady 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : 'bg-secondary border-border text-muted-foreground'
              }`}>
                {isOpponentReady ? '✓ Opponent is Ready' : '⏳ Waiting for opponent ready...'}
              </span>
            </div>

            {!isMeReady && (
              <button
                disabled={loading}
                onClick={handleReady}
                className="w-full max-w-[160px] mx-auto py-2.5 bg-primary hover:bg-blue-600 text-white font-black rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-xs min-h-[38px] flex items-center justify-center"
              >
                I am Ready!
              </button>
            )}
          </div>
        ) : !showTarget ? (
          /* Countdown Stage */
          <div className="text-center space-y-2 animate-in zoom-in duration-150">
            <span className="text-6xl font-black text-primary/80 animate-ping">
              {countdownText}
            </span>
          </div>
        ) : (
          /* Tapping Target Stage */
          <div className="w-full h-full flex flex-col items-center justify-center">
            {reactions[currentUserId] === null ? (
              <button
                onClick={handleTap}
                className="w-full h-full rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-white flex flex-col items-center justify-center gap-3 animate-pulse cursor-pointer shadow-lg active:scale-98 transition-all"
              >
                <Zap className="w-14 h-14 text-white fill-white animate-bounce" />
                <span className="text-xl font-black uppercase tracking-wider">Tap Now!</span>
              </button>
            ) : (
              <div className="text-center space-y-1 animate-in zoom-in-50 duration-200">
                {reactions[currentUserId] === 999999 ? (
                  <>
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <span className="block text-sm font-black text-red-500">False Start!</span>
                    <span className="text-[10px] text-muted-foreground">Tapped before trigger</span>
                  </>
                ) : (
                  <>
                    <Timer className="w-12 h-12 text-green-500 mx-auto" />
                    <span className="block text-sm font-black text-foreground">
                      {reactions[currentUserId]} ms
                    </span>
                    <span className="text-[10px] text-muted-foreground">Reaction recorded</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Opponent reaction display */}
      {!isGameOver && bothReady && reactions[opponentId] !== null && (
        <span className="text-[10px] font-bold text-muted-foreground">
          Opponent has tapped!
        </span>
      )}
    </div>
  )
}
