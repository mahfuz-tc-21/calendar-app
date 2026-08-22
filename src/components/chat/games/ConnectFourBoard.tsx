'use client'

import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

interface ConnectFourBoardProps {
  game: {
    id: string
    state: {
      board: (string | null)[][]
      turn: string
      red_player_id: string
      yellow_player_id: string
    }
    status: string
    created_by: string
  }
  currentUserId: string
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export default function ConnectFourBoard({ game, currentUserId, setActiveGames }: ConnectFourBoardProps) {
  const [loading, setLoading] = useState<number | null>(null) // holds col index being dropped
  const [optimisticBoard, setOptimisticBoard] = useState<(string | null)[][] | null>(null)

  const { board, turn, red_player_id, yellow_player_id } = game.state
  const isMyTurn = turn === currentUserId && game.status === 'active'
  const isOwn = game.created_by === currentUserId

  useEffect(() => {
    setOptimisticBoard(null)
  }, [board])

  const activeBoard = optimisticBoard || board

  const handleColumnClick = async (colIdx: number) => {
    if (!isMyTurn || loading !== null) return

    // Find lowest available row in this column
    let targetRow = -1
    for (let r = 5; r >= 0; r--) {
      if (activeBoard[r][colIdx] === null) {
        targetRow = r
        break
      }
    }

    if (targetRow === -1) return // Column is full

    // Optimistic Update
    const nextBoard = activeBoard.map((row) => [...row])
    nextBoard[targetRow][colIdx] = currentUserId
    setOptimisticBoard(nextBoard)

    setLoading(colIdx)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'move',
          payload: { colIndex: colIdx }
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
        setOptimisticBoard(null) // Rollback
        alert(data.error || 'Failed to drop coin')
      }
    } catch (e) {
      setOptimisticBoard(null) // Rollback
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  // Get cell color classes
  const getCellColorClass = (cell: string | null) => {
    if (!cell) return 'bg-card border border-border/40'
    return cell === red_player_id 
      ? 'bg-red-500 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]' 
      : 'bg-yellow-400 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]'
  }

  return (
    <div className="flex flex-col items-center space-y-3 select-none">
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

      {/* Connect Four Board Wrapper */}
      <div className={`p-3 rounded-2xl border flex flex-col items-center max-w-[280px] w-full ${
        isOwn 
          ? 'bg-blue-800/40 border-blue-700/50' 
          : 'bg-blue-600/10 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
      }`}>
        
        {/* Column Drop Buttons Header */}
        <div className="grid grid-cols-7 gap-1 w-full mb-1">
          {Array(7).fill(null).map((_, colIdx) => {
            const isColFull = activeBoard[0][colIdx] !== null
            const isColLoading = loading === colIdx
            return (
              <button
                key={colIdx}
                disabled={!isMyTurn || isColFull || loading !== null}
                onClick={() => handleColumnClick(colIdx)}
                className={`flex items-center justify-center rounded-lg text-[10px] font-black transition-all aspect-square min-h-[30px] ${
                  isMyTurn && !isColFull
                    ? (isOwn ? 'bg-white/10 hover:bg-white/20 active:scale-90 text-white cursor-pointer' : 'bg-primary/10 dark:bg-primary/20 hover:bg-primary/25 active:scale-90 text-primary cursor-pointer')
                    : 'bg-transparent text-transparent pointer-events-none'
                }`}
                title={`Drop in column ${colIdx + 1}`}
              >
                {isColLoading ? (
                  <span className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${isOwn ? 'border-white' : 'border-blue-500'}`} />
                ) : (
                  '▼'
                )}
              </button>
            )
          })}
        </div>

        {/* 6 Rows x 7 Columns grid slots */}
        <div className="grid grid-rows-6 gap-1 w-full">
          {activeBoard.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-7 gap-1">
              {row.map((cell, cIdx) => (
                <div 
                  key={cIdx} 
                  onClick={() => !isColFull(activeBoard, cIdx) && handleColumnClick(cIdx)}
                  className={`aspect-square rounded-full transition-all duration-250 cursor-pointer ${getCellColorClass(cell)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex gap-4 text-[9px] font-semibold text-muted-foreground uppercase opacity-75">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Red</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Yellow</span>
      </div>
    </div>
  )
}

// Helper to check if column is full
function isColFull(board: (string | null)[][], colIdx: number): boolean {
  return board[0][colIdx] !== null
}
