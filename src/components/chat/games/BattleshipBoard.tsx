'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

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
}

export default function BattleshipBoard({ game, currentUserId }: BattleshipBoardProps) {
  const [selectedShips, setSelectedShips] = useState<{ x: number; y: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [targetCell, setTargetCell] = useState<{ x: number; y: number } | null>(null)

  const { status, turn, ready, hits } = game.state
  const partnerId = currentUserId === game.created_by ? game.opponent_id : game.created_by

  const myReady = ready[currentUserId]
  const partnerReady = ready[partnerId]

  const myHits = hits[currentUserId] || []
  const opponentHits = hits[partnerId] || [] // hits Opponent made on ME

  const isMyTurn = turn === currentUserId && status === 'active'

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
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'submit_layout',
          payload: { ships: selectedShips }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to submit fleet layout')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAttack = async (x: number, y: number) => {
    if (!isMyTurn || loading) return
    // Check if already attacked
    if (myHits.some((h) => h.x === x && h.y === y)) return
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'attack',
          payload: { x, y }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Attack failed')
      }
    } catch (e) {
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
          <div className="grid grid-cols-10 gap-0.5 bg-white/5 p-1 rounded-xl border border-white/10 select-none">
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
                          : 'bg-white/10 hover:bg-white/20'
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
              className="w-full py-2 bg-white text-blue-600 rounded-xl text-xs font-bold shadow hover:bg-gray-50 disabled:opacity-50 transition-all cursor-pointer min-h-[36px]"
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
              isMyTurn ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-300'
            }`}>
              {isMyTurn ? '🟢 Your Turn to Attack' : '⏳ Opponent\'s Turn'}
            </span>
          )}

          {/* Opponent's Grid (Targeting Grid) */}
          <div className="flex flex-col items-center space-y-1">
            <span className="text-[9px] font-bold opacity-75">Target Grid</span>
            <div className="grid grid-cols-10 gap-0.5 bg-red-950/20 p-1.5 rounded-xl border border-red-500/20 select-none">
              {Array.from({ length: 10 }).map((_, y) => (
                <React.Fragment key={y}>
                  {Array.from({ length: 10 }).map((_, x) => {
                    const statusVal = getOpponentCellStatus(x, y)
                    const canAttack = isMyTurn && statusVal === '' && !loading
                    return (
                      <button
                        key={`${x}-${y}`}
                        disabled={!canAttack}
                        onClick={() => handleAttack(x, y)}
                        className={`w-[18px] h-[18px] rounded-[3px] text-[10px] flex items-center justify-center transition-all ${
                          statusVal === '💥' 
                            ? 'bg-red-500' 
                            : statusVal === '🌊' 
                              ? 'bg-blue-900/50' 
                              : canAttack 
                                ? 'bg-white/10 hover:bg-red-500/20 cursor-crosshair' 
                                : 'bg-white/5'
                        }`}
                      >
                        {statusVal}
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
            <div className="grid grid-cols-10 gap-0.5 bg-blue-950/20 p-1.5 rounded-xl border border-blue-500/20 select-none">
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
                              ? 'bg-blue-900/50 text-white font-bold' 
                              : statusVal === '🚢' 
                                ? 'bg-yellow-400 border border-yellow-300' 
                                : 'bg-white/5'
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
