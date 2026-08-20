'use client'

import React, { useState } from 'react'
import { getApiUrl } from '@/utils/api'

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
  }
  currentUserId: string
}

export default function TicTacToeBoard({ game, currentUserId }: TicTacToeBoardProps) {
  const [loading, setLoading] = useState<number | null>(null)
  
  const { board, turn, x_player_id } = game.state
  const isMyTurn = turn === currentUserId && game.status === 'active'

  const handleCellClick = async (idx: number) => {
    if (!isMyTurn || board[idx] !== null || loading !== null) return
    setLoading(idx)
    try {
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'move',
          payload: { cellIndex: idx }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to place move')
      }
    } catch (e) {
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
          isMyTurn ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-300'
        }`}>
          {isMyTurn ? '🟢 Your Turn' : '⏳ Opponent\'s Turn'}
        </span>
      )}

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-1.5 w-44 h-44 bg-white/5 p-1.5 rounded-2xl border border-white/10">
        {board.map((cell, idx) => {
          const marker = getCellMarker(cell)
          return (
            <button
              key={idx}
              disabled={!isMyTurn || cell !== null || loading !== null}
              onClick={() => handleCellClick(idx)}
              className={`flex items-center justify-center rounded-xl font-black text-lg transition-all select-none min-h-[44px] ${
                cell === null && isMyTurn 
                  ? 'bg-white/10 hover:bg-white/20 active:scale-95 cursor-pointer' 
                  : 'bg-white/5'
              } ${
                marker === 'X' 
                  ? 'text-yellow-300' 
                  : marker === 'O' 
                    ? 'text-cyan-300' 
                    : 'text-transparent'
              }`}
            >
              {loading === idx ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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
