import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

interface TicTacToeBoardProps {
  game: {
    id: string
    state: {
      board: (string | null)[]
      turn: string
      x_player_id: string
      o_player_id: string
    }
    status: string
    created_by: string
  }
  currentUserId: string
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function TicTacToeBoard({ game, currentUserId, setActiveGames }: TicTacToeBoardProps) {
  const [loading, setLoading] = useState<number | null>(null)
  const [optimisticBoard, setOptimisticBoard] = useState<(string | null)[] | null>(null)
  
  const { board, turn, x_player_id } = game.state
  const isMyTurn = turn === currentUserId && game.status === 'active'
  const isOwn = game.created_by === currentUserId

  useEffect(() => {
    setOptimisticBoard(null)
  }, [board])

  const activeBoard = optimisticBoard || board

  const handleCellClick = async (idx: number) => {
    if (!isMyTurn || activeBoard[idx] !== null || loading !== null) return
    
    // Optimistic Update: Set the cell instantly in the local view
    const nextBoard = [...activeBoard]
    nextBoard[idx] = currentUserId
    setOptimisticBoard(nextBoard)

    setLoading(idx)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'move',
          payload: { cellIndex: idx }
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
        setOptimisticBoard(null) // Rollback on error
        alert(data.error || 'Failed to place move')
      }
    } catch (e) {
      setOptimisticBoard(null) // Rollback on error
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const getCellMarker = (cell: string | null) => {
    if (!cell) return ''
    return cell === x_player_id ? 'X' : 'O'
  }

  return (
    <div className="flex flex-col items-center space-y-2.5">
      {/* Turn indicator */}
      {game.status === 'active' && (
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
          isMyTurn 
            ? 'bg-green-500/20 text-green-500' 
            : (isOwn ? 'bg-white/10 text-gray-300' : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-muted-foreground')
        }`}>
          {isMyTurn ? '🟢 Your Turn' : '⏳ Opponent\'s Turn'}
        </span>
      )}

      {/* 3x3 Grid */}
      <div className={`grid grid-cols-3 gap-1.5 w-44 h-44 p-1.5 rounded-2xl border ${
        isOwn 
          ? 'bg-white/5 border-white/10' 
          : 'bg-black/5 dark:bg-white/5 border-gray-200 dark:border-border'
      }`}>
        {activeBoard.map((cell, idx) => {
          const marker = getCellMarker(cell)
          return (
            <button
              key={idx}
              disabled={!isMyTurn || cell !== null || (loading !== null && loading !== idx)}
              onClick={() => handleCellClick(idx)}
              className={`flex items-center justify-center rounded-xl font-black text-lg transition-all select-none min-h-[44px] ${
                cell === null && isMyTurn 
                  ? (isOwn ? 'bg-white/10 hover:bg-white/20 active:scale-95 cursor-pointer' : 'bg-card dark:bg-secondary border border-border hover:bg-secondary/80 active:scale-95 cursor-pointer') 
                  : (isOwn ? 'bg-white/5' : 'bg-secondary/40')
              } ${
                marker === 'X' 
                  ? (isOwn ? 'text-yellow-300' : 'text-amber-600 dark:text-amber-400') 
                  : marker === 'O' 
                    ? (isOwn ? 'text-cyan-300' : 'text-blue-600 dark:text-blue-400') 
                    : 'text-transparent'
              }`}
            >
              {loading === idx && cell === null ? (
                <span className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${isOwn ? 'border-white' : 'border-blue-600'}`}></span>
              ) : (
                marker
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
