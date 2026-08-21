import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

interface HitCoord {
  x: number
  y: number
  hit: boolean
}

interface BattleshipBoardProps {
  game: {
    id: string
    state: {
      status: 'setup' | 'active' | 'completed'
      turn: string
      ready: Record<string, boolean>
      hits: Record<string, HitCoord[]>
    }
    status: string
    created_by: string
    opponent_id: string
  }
  currentUserId: string
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function BattleshipBoard({ game, currentUserId, setActiveGames }: BattleshipBoardProps) {
  const [selectedShips, setSelectedShips] = useState<{ x: number; y: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [privateState, setPrivateState] = useState<{ ships?: { x: number; y: number }[] } | null>(null)
  const [optimisticAttack, setOptimisticAttack] = useState<{ x: number; y: number } | null>(null)

  const { status: stage, turn, ready, hits } = game.state
  const myReady = ready[currentUserId]
  const opponentId = currentUserId === game.created_by ? game.opponent_id : game.created_by
  const opponentReady = ready[opponentId]
  const isMyTurn = turn === currentUserId && stage === 'active'

  const myHits = hits[currentUserId] || []
  const opponentHits = hits[opponentId] || []
  const isOwn = game.created_by === currentUserId

  useEffect(() => {
    setOptimisticAttack(null)
  }, [myHits])

  useEffect(() => {
    const fetchPrivateState = async () => {
      try {
        const { createClient } = require('@/utils/supabase/client')
        const supabase = createClient()
        const { data, error } = await supabase
          .from('game_private_states')
          .select('private_state')
          .eq('game_id', game.id)
          .eq('user_id', currentUserId)
          .maybeSingle()

        if (data && !error) {
          setPrivateState(data.private_state)
        }
      } catch (e) {
        console.error(e)
      }
    }
    if (myReady) {
      fetchPrivateState()
    }
  }, [game.id, myReady, currentUserId])

  const handleCellSetupSelect = (x: number, y: number) => {
    if (myReady || loading) return
    const exists = selectedShips.some((s) => s.x === x && s.y === y)
    if (exists) {
      setSelectedShips(selectedShips.filter((s) => !(s.x === x && s.y === y)))
    } else {
      if (selectedShips.length >= 5) return // max 5 ships
      setSelectedShips([...selectedShips, { x, y }])
    }
  }

  const handleSubmitLayout = async () => {
    if (selectedShips.length !== 5 || loading) return
    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'submit_layout',
          payload: { ships: selectedShips }
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
        alert(data.error || 'Failed to submit fleet layout')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAttack = async (x: number, y: number) => {
    if (!isMyTurn || loading || optimisticAttack) return
    if (myHits.some((h) => h.x === x && h.y === y)) return

    setOptimisticAttack({ x, y })

    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'attack',
          payload: { x, y }
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
        setOptimisticAttack(null) // Rollback on error
        alert(data.error || 'Attack failed')
      }
    } catch (e) {
      setOptimisticAttack(null) // Rollback on error
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Helpers to get cell status
  const getOpponentCellStatus = (x: number, y: number) => {
    const attack = myHits.find((h) => h.x === x && h.y === y)
    if (!attack) return ''
    return attack.hit ? '💥' : '🌊'
  }

  const getMyCellStatus = (x: number, y: number) => {
    const isShip = selectedShips.some((s) => s.x === x && s.y === y)
    const attack = opponentHits.find((h) => h.x === x && h.y === y)
    if (attack) {
      return attack.hit ? '💥' : '🌊'
    }
    return isShip ? '🚢' : ''
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* Setup phase */}
      {status === 'setup' && (
        <div className="flex flex-col items-center space-y-3 w-full">
          <span className="text-[10px] font-bold opacity-85 text-center">
            {myReady 
              ? 'Fleet deployed! Waiting for opponent...' 
              : `Deploy your Fleet. Select 5 cells (${selectedShips.length}/5)`}
          </span>

          {/* Grid for setup */}
          <div className={`grid grid-cols-10 gap-0.5 p-1 rounded-xl border select-none ${
            isOwn 
              ? 'bg-white/5 border-white/10' 
              : 'bg-black/5 border-gray-250'
          }`}>
            {Array.from({ length: 10 }).map((_, y) => (
              <React.Fragment key={y}>
                {Array.from({ length: 10 }).map((_, x) => {
                  const isSelected = selectedShips.some((s) => s.x === x && s.y === y)
                  return (
                    <button
                      key={`${x}-${y}`}
                      disabled={myReady || loading}
                      onClick={() => handleCellSetupSelect(x, y)}
                      className={`w-[18px] h-[18px] rounded-[3px] text-[8px] transition-all flex items-center justify-center font-bold ${
                        isSelected 
                          ? 'bg-yellow-400 border border-yellow-300' 
                          : (isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-gray-200 hover:bg-gray-100')
                      }`}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>

          {!myReady && (
            <button
              onClick={handleSubmitLayout}
              disabled={selectedShips.length !== 5 || loading}
              className={`w-full py-2 rounded-xl text-xs font-bold shadow disabled:opacity-50 transition-all cursor-pointer min-h-[36px] ${
                isOwn 
                  ? 'bg-white text-blue-600 hover:bg-gray-50' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Deploying...' : 'Deploy Fleet'}
            </button>
          )}
        </div>
      )}

      {/* Active gameplay phase */}
      {(status === 'active' || status === 'completed') && (
        <div className="flex flex-col items-center space-y-4 w-full">
          {status === 'active' && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              isMyTurn 
                ? 'bg-green-500/20 text-green-500' 
                : (isOwn ? 'bg-white/10 text-gray-300' : 'bg-black/5 text-gray-500')
            }`}>
              {isMyTurn ? '🟢 Your Turn to Attack' : '⏳ Opponent\'s Turn'}
            </span>
          )}

          {/* Opponent's Grid (Targeting Grid) */}
          <div className="flex flex-col items-center space-y-1">
            <span className="text-[9px] font-bold opacity-75">Target Grid</span>
            <div className={`grid grid-cols-10 gap-0.5 p-1.5 rounded-xl border select-none ${
              isOwn 
                ? 'bg-red-950/20 border-red-500/20' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {Array.from({ length: 10 }).map((_, y) => (
                <React.Fragment key={y}>
                  {Array.from({ length: 10 }).map((_, x) => {
                    const statusVal = getOpponentCellStatus(x, y)
                    const isTargeting = optimisticAttack && optimisticAttack.x === x && optimisticAttack.y === y
                    const canAttack = isMyTurn && statusVal === '' && !loading && !optimisticAttack
                    return (
                      <button
                        key={`${x}-${y}`}
                        disabled={!canAttack && !isTargeting}
                        onClick={() => handleAttack(x, y)}
                        className={`w-[18px] h-[18px] rounded-[3px] text-[10px] flex items-center justify-center transition-all ${
                          isTargeting
                            ? 'bg-yellow-500 text-white animate-pulse'
                            : statusVal === '💥' 
                              ? 'bg-red-500 text-white' 
                              : statusVal === '🌊' 
                                ? (isOwn ? 'bg-blue-900/50 text-white' : 'bg-blue-100 text-blue-700') 
                                : canAttack 
                                  ? (isOwn ? 'bg-white/10 hover:bg-red-500/20 cursor-crosshair' : 'bg-white border border-gray-200 hover:bg-red-500/10 cursor-crosshair') 
                                  : (isOwn ? 'bg-white/5' : 'bg-white/50 border border-gray-100')
                        }`}
                      >
                        {isTargeting ? '🎯' : statusVal}
                      </button>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Your Grid (My Fleet View) */}
          <div className="flex flex-col items-center space-y-1">
            <span className="text-[9px] font-bold opacity-75">Your Fleet</span>
            <div className={`grid grid-cols-10 gap-0.5 p-1.5 rounded-xl border select-none ${
              isOwn 
                ? 'bg-blue-950/20 border-blue-500/20' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              {Array.from({ length: 10 }).map((_, y) => (
                <React.Fragment key={y}>
                  {Array.from({ length: 10 }).map((_, x) => {
                    const statusVal = getMyCellStatus(x, y)
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`w-[18px] h-[18px] rounded-[3px] text-[10px] flex items-center justify-center ${
                          statusVal === '💥' 
                            ? 'bg-red-500 text-white font-bold' 
                            : statusVal === '🌊' 
                              ? (isOwn ? 'bg-blue-900/50 text-white font-bold' : 'bg-blue-100 text-blue-700 font-bold') 
                              : statusVal === '🚢' 
                                ? 'bg-yellow-400 border border-yellow-300' 
                                : (isOwn ? 'bg-white/5' : 'bg-white border border-gray-100')
                        }`}
                      >
                        {statusVal === '🚢' ? '' : statusVal}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
