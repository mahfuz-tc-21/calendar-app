'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RotateCcw, Award, Star, X } from 'lucide-react'

interface TwoZeroFourEightProps {
  onClose: () => void
}

type Grid = number[][]

const createEmptyGrid = (): Grid => Array(4).fill(null).map(() => Array(4).fill(0))

export default function TwoZeroFourEight({ onClose }: TwoZeroFourEightProps) {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid())
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [win, setWin] = useState(false)
  const [keepPlaying, setKeepPlaying] = useState(false)

  // Touch controls ref
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Load best score on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('best_score_2048')
      if (stored) {
        setBestScore(parseInt(stored, 10))
      }
    }
  }, [])

  // Initialize a new game
  const initGame = useCallback(() => {
    let newGrid = createEmptyGrid()
    newGrid = addRandomTile(newGrid)
    newGrid = addRandomTile(newGrid)
    setGrid(newGrid)
    setScore(0)
    setGameOver(false)
    setWin(false)
    setKeepPlaying(false)
  }, [])

  // Start initial game
  useEffect(() => {
    initGame()
  }, [initGame])

  // Save best score
  const updateBestScore = useCallback((newScore: number) => {
    if (newScore > bestScore) {
      setBestScore(newScore)
      if (typeof window !== 'undefined') {
        localStorage.setItem('best_score_2048', newScore.toString())
      }
    }
  }, [bestScore])

  // Add random tile (2 or 4) to empty spaces
  const addRandomTile = (currentGrid: Grid): Grid => {
    const emptyCells: { r: number; c: number }[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === 0) {
          emptyCells.push({ r, c })
        }
      }
    }

    if (emptyCells.length === 0) return currentGrid

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    const newGrid = currentGrid.map((row) => [...row])
    newGrid[r][c] = Math.random() < 0.9 ? 2 : 4
    return newGrid
  }

  // Slide left helper
  const slideLeft = (currentGrid: Grid): { grid: Grid; scoreAdded: number; moved: boolean } => {
    let scoreAdded = 0
    let moved = false

    const newGrid = currentGrid.map((row) => {
      // 1. Filter out zeros
      const filtered = row.filter((val) => val !== 0)
      const newRow: number[] = []

      // 2. Merge identical adjacent values
      let i = 0
      while (i < filtered.length) {
        if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
          const mergedValue = filtered[i] * 2
          newRow.push(mergedValue)
          scoreAdded += mergedValue
          i += 2
        } else {
          newRow.push(filtered[i])
          i++
        }
      }

      // 3. Pad with zeros
      while (newRow.length < 4) {
        newRow.push(0)
      }

      // Check if row changed
      if (JSON.stringify(row) !== JSON.stringify(newRow)) {
        moved = true
      }

      return newRow
    })

    return { grid: newGrid, scoreAdded, moved }
  }

  // Rotate grid 90 degrees counter-clockwise (helper to reuse slideLeft logic)
  const rotateGridCounterClockwise = (currentGrid: Grid): Grid => {
    const rotated = createEmptyGrid()
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        rotated[3 - c][r] = currentGrid[r][c]
      }
    }
    return rotated
  }

  // Slide operations in different directions
  const move = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver || (win && !keepPlaying)) return

    let currentGrid = grid
    let rotatedCount = 0

    // Rotate matrix to transform all moves to a slideLeft action
    if (direction === 'up') {
      currentGrid = rotateGridCounterClockwise(currentGrid)
      rotatedCount = 1
    } else if (direction === 'right') {
      currentGrid = rotateGridCounterClockwise(rotateGridCounterClockwise(currentGrid))
      rotatedCount = 2
    } else if (direction === 'down') {
      currentGrid = rotateGridCounterClockwise(rotateGridCounterClockwise(rotateGridCounterClockwise(currentGrid)))
      rotatedCount = 3
    }

    // Process slide left
    const { grid: slid, scoreAdded, moved } = slideLeft(currentGrid)

    // Revert rotation to original direction
    let finalGrid = slid
    const remainingRotates = (4 - rotatedCount) % 4
    for (let k = 0; k < remainingRotates; k++) {
      finalGrid = rotateGridCounterClockwise(finalGrid)
    }

    if (moved) {
      const gridWithNewTile = addRandomTile(finalGrid)
      setGrid(gridWithNewTile)
      
      const nextScore = score + scoreAdded
      setScore(nextScore)
      updateBestScore(nextScore)

      // Check win condition
      let has2048 = false
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (gridWithNewTile[r][c] === 2048) {
            has2048 = true
          }
        }
      }
      if (has2048 && !win && !keepPlaying) {
        setWin(true)
      }

      // Check game over condition
      if (!canMove(gridWithNewTile)) {
        setGameOver(true)
      }
    }
  }, [grid, score, win, keepPlaying, gameOver, updateBestScore])

  // Check if grid has any possible moves
  const canMove = (currentGrid: Grid): boolean => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === 0) return true
        if (c + 1 < 4 && currentGrid[r][c] === currentGrid[r][c + 1]) return true
        if (r + 1 < 4 && currentGrid[r][c] === currentGrid[r + 1][c]) return true
      }
    }
    return false
  }

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault()
        move('up')
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault()
        move('down')
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        move('left')
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        move('right')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [move])

  // Touch Swipe handlers for mobile WebView
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const diffX = touch.clientX - touchStartRef.current.x
    const diffY = touch.clientY - touchStartRef.current.y
    const absDiffX = Math.abs(diffX)
    const absDiffY = Math.abs(diffY)

    // Threshold of swipe detection: 30 pixels
    if (Math.max(absDiffX, absDiffY) > 30) {
      if (absDiffX > absDiffY) {
        move(diffX > 0 ? 'right' : 'left')
      } else {
        move(diffY > 0 ? 'down' : 'up')
      }
    }
    touchStartRef.current = null
  }

  // Color mappings for different tiles in Light / Dark mode
  const getTileStyles = (val: number): string => {
    switch (val) {
      case 2: return 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-100'
      case 4: return 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-50'
      case 8: return 'bg-orange-200 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200'
      case 16: return 'bg-orange-300 dark:bg-orange-850 text-orange-950 dark:text-orange-100'
      case 32: return 'bg-orange-400 dark:bg-orange-800 text-white font-bold'
      case 64: return 'bg-orange-500 dark:bg-orange-750 text-white font-extrabold'
      case 128: return 'bg-yellow-300 dark:bg-yellow-950/70 text-yellow-900 dark:text-yellow-100 shadow-sm'
      case 256: return 'bg-yellow-400 dark:bg-yellow-900 text-yellow-950 dark:text-yellow-100'
      case 512: return 'bg-yellow-500 dark:bg-yellow-800 text-white'
      case 1024: return 'bg-amber-500 dark:bg-amber-800 text-white shadow-md'
      case 2048: return 'bg-yellow-500 dark:bg-yellow-600 text-white font-black shadow-lg animate-bounce'
      default: return 'bg-amber-600 text-white'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <header className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧩</span>
          <span className="font-bold text-sm text-foreground">2048 Offline</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Body */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm w-full mx-auto space-y-4 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Score & Header Info */}
        <div className="flex justify-between w-full items-center gap-4">
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-card border border-border rounded-xl text-center flex flex-col justify-center min-w-[70px]">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Score</span>
              <span className="text-sm font-black text-foreground">{score}</span>
            </div>
            <div className="px-3 py-1.5 bg-card border border-border rounded-xl text-center flex flex-col justify-center min-w-[70px]">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center justify-center gap-0.5"><Award className="w-2.5 h-2.5 text-yellow-500" /> Best</span>
              <span className="text-sm font-black text-foreground">{bestScore}</span>
            </div>
          </div>

          <button 
            onClick={initGame}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground hover:text-primary transition-all cursor-pointer shadow-xs"
            title="Restart Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Board Container */}
        <div className="relative w-full aspect-square bg-secondary rounded-2xl p-2.5 border border-border flex flex-col justify-between max-w-[320px]">
          {/* Grid Layout */}
          <div className="grid grid-cols-4 gap-2 h-full w-full">
            {grid.map((row, rIdx) => 
              row.map((val, cIdx) => (
                <div 
                  key={`${rIdx}-${cIdx}`}
                  className={`aspect-square flex items-center justify-center rounded-xl text-lg font-bold transition-all duration-100 ${
                    val === 0 
                      ? 'bg-card border border-border/40' 
                      : getTileStyles(val)
                  }`}
                >
                  {val > 0 ? val : ''}
                </div>
              ))
            )}
          </div>

          {/* Win State Overlay */}
          {win && !keepPlaying && (
            <div className="absolute inset-0 bg-yellow-500/90 rounded-2xl flex flex-col items-center justify-center text-white text-center p-6 space-y-4">
              <span className="text-4xl animate-bounce">🏆</span>
              <h2 className="text-xl font-black">You Reached 2048!</h2>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setKeepPlaying(true)}
                  className="px-4 py-2 bg-white text-yellow-600 rounded-xl text-xs font-bold shadow-md hover:bg-gray-100 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  Keep Playing
                </button>
                <button 
                  onClick={initGame}
                  className="px-4 py-2 bg-yellow-750 text-white rounded-xl text-xs font-bold shadow-md hover:bg-yellow-800 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Game Over State Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/80 rounded-2xl flex flex-col items-center justify-center text-white text-center p-6 space-y-3">
              <span className="text-4xl">💀</span>
              <h2 className="text-xl font-bold">Game Over</h2>
              <p className="text-xs text-gray-300">No possible moves remaining.</p>
              <button 
                onClick={initGame}
                className="px-5 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[38px]"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="text-[10px] text-muted-foreground text-center leading-normal max-w-[200px]">
          Swipe screen or use W/A/S/D keys to slide matching tiles together and reach 2048!
        </p>
      </div>

      {/* Spacer to push instructions to the center */}
      <div className="shrink-0 p-4" />
    </div>
  )
}
