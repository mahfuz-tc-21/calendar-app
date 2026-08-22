'use client'

import React, { useState, useEffect } from 'react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'
import { Loader2 } from 'lucide-react'

interface DotsAndBoxesBoardProps {
  game: {
    id: string
    state: {
      hLines: boolean[][]
      vLines: boolean[][]
      boxes: (string | null)[][]
      turn: string
      player_one_id: string
      player_two_id: string
      scores: Record<string, number>
    }
    status: string
    created_by: string
  }
  currentUserId: string
  setActiveGames?: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

const CELL_SIZE = 60 // pixels per grid spacing

export default function DotsAndBoxesBoard({ game, currentUserId, setActiveGames }: DotsAndBoxesBoardProps) {
  const [loading, setLoading] = useState<string | null>(null) // e.g. "h-r-c" or "v-r-c"
  const [optimisticState, setOptimisticState] = useState<any>(null)

  const state = optimisticState || game.state
  const { hLines, vLines, boxes, turn, player_one_id, player_two_id, scores } = state
  
  const isMyTurn = turn === currentUserId && game.status === 'active'
  const isPlayerOne = currentUserId === player_one_id

  useEffect(() => {
    setOptimisticState(null)
  }, [game.state])

  const handleLineClick = async (lineType: 'h' | 'v', r: number, c: number) => {
    if (!isMyTurn || loading !== null) return

    const key = `${lineType}-${r}-${c}`
    
    // Check if already placed
    if (lineType === 'h' && hLines[r][c]) return
    if (lineType === 'v' && vLines[r][c]) return

    // Optimistic Update
    const nextHLines = hLines.map((row: boolean[]) => [...row])
    const nextVLines = vLines.map((row: boolean[]) => [...row])
    const nextBoxes = boxes.map((row: (string | null)[]) => [...row])
    const nextScores = { ...scores }

    if (lineType === 'h') {
      nextHLines[r][c] = true
    } else {
      nextVLines[r][c] = true
    }

    // Check box completions locally for immediate responsive UI feedback
    let completedAny = false
    if (lineType === 'h') {
      if (r > 0) {
        const rAbove = r - 1
        if (nextHLines[rAbove][c] && nextVLines[rAbove][c] && nextVLines[rAbove][c + 1]) {
          if (nextBoxes[rAbove][c] === null) {
            nextBoxes[rAbove][c] = currentUserId
            nextScores[currentUserId] = (nextScores[currentUserId] || 0) + 1
            completedAny = true
          }
        }
      }
      if (r < 4) {
        if (nextHLines[r + 1][c] && nextVLines[r][c] && nextVLines[r][c + 1]) {
          if (nextBoxes[r][c] === null) {
            nextBoxes[r][c] = currentUserId
            nextScores[currentUserId] = (nextScores[currentUserId] || 0) + 1
            completedAny = true
          }
        }
      }
    } else {
      if (c > 0) {
        const cLeft = c - 1
        if (nextVLines[r][cLeft] && nextHLines[r][cLeft] && nextHLines[r + 1][cLeft]) {
          if (nextBoxes[r][cLeft] === null) {
            nextBoxes[r][cLeft] = currentUserId
            nextScores[currentUserId] = (nextScores[currentUserId] || 0) + 1
            completedAny = true
          }
        }
      }
      if (c < 4) {
        if (nextVLines[r][c + 1] && nextHLines[r][c] && nextHLines[r + 1][c]) {
          if (nextBoxes[r][c] === null) {
            nextBoxes[r][c] = currentUserId
            nextScores[currentUserId] = (nextScores[currentUserId] || 0) + 1
            completedAny = true
          }
        }
      }
    }

    let nextTurn = turn
    if (!completedAny) {
      nextTurn = currentUserId === player_one_id ? player_two_id : player_one_id
    }

    setOptimisticState({
      hLines: nextHLines,
      vLines: nextVLines,
      boxes: nextBoxes,
      turn: nextTurn,
      player_one_id,
      player_two_id,
      scores: nextScores
    })

    setLoading(key)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/action'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          action: 'move',
          payload: { lineType, row: r, col: c }
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
        setOptimisticState(null) // rollback
        alert(data.error || 'Failed to place line')
      }
    } catch (e) {
      setOptimisticState(null) // rollback
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  // Get color indicators
  const getPlayerColorClass = (userId: string | null, opacity = 1) => {
    if (!userId) return ''
    if (userId === player_one_id) {
      return opacity === 1 ? 'bg-blue-500' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    } else {
      return opacity === 1 ? 'bg-yellow-500' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    }
  }

  return (
    <div className="flex flex-col items-center space-y-4 select-none">
      {/* Turn indicator */}
      {game.status === 'active' && (
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
          isMyTurn 
            ? 'bg-green-500/20 text-green-500' 
            : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'
        }`}>
          {isMyTurn ? '🟢 Your Turn' : '⏳ Opponent\'s Turn'}
        </span>
      )}

      {/* Scores indicator */}
      <div className="flex gap-4 text-xs font-bold text-foreground">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/15">
          <span>Blue (P1):</span>
          <span>{scores[player_one_id] || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/15">
          <span>Yellow (P2):</span>
          <span>{scores[player_two_id] || 0}</span>
        </div>
      </div>

      {/* Board Container */}
      <div 
        className="relative bg-secondary/30 border border-border/80 rounded-2xl p-6"
        style={{
          width: `${CELL_SIZE * 4 + 48}px`,
          height: `${CELL_SIZE * 4 + 48}px`,
        }}
      >
        <div className="relative w-full h-full">
          {/* Completed Boxes */}
          {boxes.map((row: (string | null)[], rIdx: number) =>
            row.map((boxOwner, cIdx) => {
              if (!boxOwner) return null
              return (
                <div
                  key={`box-${rIdx}-${cIdx}`}
                  className={`absolute rounded-lg flex items-center justify-center font-black text-sm border animate-in zoom-in-50 duration-200 ${getPlayerColorClass(boxOwner, 0.1)}`}
                  style={{
                    top: `${rIdx * CELL_SIZE + 4}px`,
                    left: `${cIdx * CELL_SIZE + 4}px`,
                    width: `${CELL_SIZE - 8}px`,
                    height: `${CELL_SIZE - 8}px`,
                  }}
                >
                  {boxOwner === player_one_id ? 'B' : 'Y'}
                </div>
              )
            })
          )}

          {/* Horizontal lines */}
          {hLines.map((row: boolean[], rIdx: number) =>
            row.map((placed, cIdx) => {
              const isColLoading = loading === `h-${rIdx}-${cIdx}`
              return (
                <div
                  key={`h-${rIdx}-${cIdx}`}
                  className="absolute"
                  style={{
                    top: `${rIdx * CELL_SIZE - 12}px`, // offset touch target centering
                    left: `${cIdx * CELL_SIZE + 4}px`,
                    width: `${CELL_SIZE - 8}px`,
                    height: '24px', // Touch target height
                  }}
                >
                  {/* Visual Line */}
                  <button
                    disabled={!isMyTurn || placed || loading !== null}
                    onClick={() => handleLineClick('h', rIdx, cIdx)}
                    className={`w-full h-1.5 rounded-full absolute top-[9px] left-0 transition-all duration-200 cursor-pointer ${
                      placed 
                        ? 'bg-foreground/80 dark:bg-foreground' 
                        : isMyTurn 
                          ? 'bg-border/80 hover:bg-primary/50' 
                          : 'bg-border/30'
                    } ${isColLoading ? 'animate-pulse' : ''}`}
                  />
                </div>
              )
            })
          )}

          {/* Vertical lines */}
          {vLines.map((row: boolean[], rIdx: number) =>
            row.map((placed, cIdx) => {
              const isColLoading = loading === `v-${rIdx}-${cIdx}`
              return (
                <div
                  key={`v-${rIdx}-${cIdx}`}
                  className="absolute"
                  style={{
                    top: `${rIdx * CELL_SIZE + 4}px`,
                    left: `${cIdx * CELL_SIZE - 12}px`, // offset touch target centering
                    width: '24px', // Touch target width
                    height: `${CELL_SIZE - 8}px`,
                  }}
                >
                  {/* Visual Line */}
                  <button
                    disabled={!isMyTurn || placed || loading !== null}
                    onClick={() => handleLineClick('v', rIdx, cIdx)}
                    className={`w-1.5 h-full rounded-full absolute top-0 left-[9px] transition-all duration-200 cursor-pointer ${
                      placed 
                        ? 'bg-foreground/80 dark:bg-foreground' 
                        : isMyTurn 
                          ? 'bg-border/80 hover:bg-primary/50' 
                          : 'bg-border/30'
                    } ${isColLoading ? 'animate-pulse' : ''}`}
                  />
                </div>
              )
            })
          )}

          {/* Grid of Dots */}
          {Array(5).fill(null).map((_, rIdx) =>
            Array(5).fill(null).map((_, cIdx) => (
              <div
                key={`dot-${rIdx}-${cIdx}`}
                className="absolute w-2 h-2 rounded-full bg-foreground/60 dark:bg-foreground/80 shadow-xs"
                style={{
                  top: `${rIdx * CELL_SIZE - 4}px`,
                  left: `${cIdx * CELL_SIZE - 4}px`,
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
