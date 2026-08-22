'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Game } from '@/hooks/useChat'
import { ShieldAlert, Award, RefreshCw } from 'lucide-react'
import { getApiUrl, getAuthHeaders } from '@/utils/api'

// Lazy-load the game boards
const TicTacToeBoard = dynamic(() => import('./games/TicTacToeBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Tic-Tac-Toe...</div>,
  ssr: false
})
const RockPaperScissorsBoard = dynamic(() => import('./games/RockPaperScissorsBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading RPS...</div>,
  ssr: false
})
const EmojiGuessBoard = dynamic(() => import('./games/EmojiGuessBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Emoji Guess...</div>,
  ssr: false
})
const WouldYouRatherBoard = dynamic(() => import('./games/WouldYouRatherBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Would You Rather...</div>,
  ssr: false
})
const BattleshipBoard = dynamic(() => import('./games/BattleshipBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Battleship...</div>,
  ssr: false
})
const WordGuessBoard = dynamic(() => import('./games/WordGuessBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Word Guess...</div>,
  ssr: false
})
const ConnectFourBoard = dynamic(() => import('./games/ConnectFourBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Connect Four...</div>,
  ssr: false
})
const DotsAndBoxesBoard = dynamic(() => import('./games/DotsAndBoxesBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Dots & Boxes...</div>,
  ssr: false
})
const HigherLowerBoard = dynamic(() => import('./games/HigherLowerBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Higher or Lower...</div>,
  ssr: false
})
const ReactionBattleBoard = dynamic(() => import('./games/ReactionBattleBoard'), {
  loading: () => <div className="p-4 text-center text-xs text-gray-500">Loading Reaction Battle...</div>,
  ssr: false
})

interface GameCardProps {
  message: {
    id: string
    sender_id: string
    game_id?: string | null
    created_at: string
  }
  isOwn: boolean
  activeGames: Record<string, Game>
  setActiveGames: React.Dispatch<React.SetStateAction<Record<string, Game>>>
  currentUserId: string
}

export default function GameCard({ message, isOwn, activeGames, setActiveGames, currentUserId }: GameCardProps) {
  const gameId = message.game_id
  const game = gameId ? activeGames[gameId] : null
  const [loading, setLoading] = useState(false)
  const [rematchLoading, setRematchLoading] = useState(false)

  if (!gameId) {
    return (
      <div className="p-3 text-xs bg-red-50 text-red-600 rounded-2xl flex items-center gap-2 border border-red-100">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>Corrupted game invitation data.</span>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-2xl animate-pulse">
        🎮 Loading Game invitation...
      </div>
    )
  }

  const handleAccept = async () => {
    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/accept'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })
      const data = await res.json()
      if (res.ok && data.success && data.game) {
        setActiveGames((prev) => ({
          ...prev,
          [gameId]: data.game
        }))
      } else {
        alert(data.error || 'Failed to accept invitation')
      }
    } catch (e) {
      console.error(e)
      alert('Network error accepting game')
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/decline'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })
      const data = await res.json()
      if (res.ok && data.success && data.game) {
        setActiveGames((prev) => ({
          ...prev,
          [gameId]: data.game
        }))
      } else {
        alert(data.error || 'Failed to decline or cancel game')
      }
    } catch (e) {
      console.error(e)
      alert('Network error declining game')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAgain = async () => {
    setRematchLoading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(getApiUrl('/api/games/create'), {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: game.conversation_id,
          gameType: game.game_type,
          opponentId: game.created_by === currentUserId ? game.opponent_id : game.created_by,
          isRematch: true,
          // Extract initial configurations if Emoji Guess, Word Guess or Would You Rather
          options: game.game_type === 'emojiguess' ? {
            emojiChallenge: game.state.emojiChallenge,
            correctAnswer: game.state.correctAnswer || ''
          } : game.game_type === 'wouldyourather' ? {
            optionA: game.state.optionA,
            optionB: game.state.optionB
          } : game.game_type === 'wordguess' ? {
            secretWord: game.state.secretWord || '',
            category: game.state.category
          } : undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success && data.game) {
        setActiveGames((prev) => ({
          ...prev,
          [data.game.id]: data.game
        }))
      } else {
        alert(data.error || 'Failed to start play again match')
      }
    } catch (e) {
      console.error(e)
      alert('Network error requesting play again')
    } finally {
      setRematchLoading(false)
    }
  }

  const getGameEmoji = () => {
    switch (game.game_type) {
      case 'connectfour': return '🔴'
      case 'dotsandboxes': return '📦'
      case 'higherlower': return '🔢'
      case 'reactionbattle': return '⚡'
      case 'tictactoe': return '🎯'
      case 'rps': return '✊'
      case 'emojiguess': return '🤔'
      case 'wouldyourather': return '🗳️'
      case 'battleship': return '🟦'
      case 'wordguess': return '🧩'
      default: return '🎮'
    }
  }

  const getGameName = () => {
    switch (game.game_type) {
      case 'connectfour': return 'Connect Four'
      case 'dotsandboxes': return 'Dots & Boxes'
      case 'higherlower': return 'Higher or Lower'
      case 'reactionbattle': return 'Reaction Battle'
      case 'tictactoe': return 'Tic-Tac-Toe'
      case 'rps': return 'Rock Paper Scissors'
      case 'emojiguess': return 'Emoji Guess'
      case 'wouldyourather': return 'Would You Rather'
      case 'battleship': return 'Battleship'
      case 'wordguess': return 'Word Guess'
      default: return 'Game'
    }
  }

  const isCreator = game.created_by === currentUserId

  return (
    <div className={`p-4 rounded-3xl max-w-[270px] shadow-sm border ${
      isOwn 
        ? 'bg-blue-600 border-blue-500 text-white' 
        : 'bg-gray-50 border-gray-100 text-gray-800'
    }`}>
      {/* Game Header */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-white/10 mb-3">
        <span className="text-2xl">{getGameEmoji()}</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider opacity-75">Private Match</span>
          <span className="text-sm font-extrabold">{getGameName()}</span>
        </div>
      </div>

      {/* Pending status screen */}
      {game.status === 'pending' && (
        <div className="space-y-3.5 text-center">
          <p className="text-xs leading-normal">
            {isCreator 
              ? 'You invited opponent to play this game.' 
              : 'Invited you to play this game.'}
          </p>
          {!isCreator ? (
            <div className="flex gap-2 justify-center">
              <button
                disabled={loading}
                onClick={handleAccept}
                className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-100 active:scale-95 transition-all cursor-pointer min-h-[36px]"
              >
                Accept
              </button>
              <button
                disabled={loading}
                onClick={handleDecline}
                className="px-4 py-2 bg-black/20 text-white rounded-xl text-xs font-bold hover:bg-black/30 active:scale-95 transition-all cursor-pointer min-h-[36px]"
              >
                Decline
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="inline-block text-[10px] font-semibold bg-white/10 px-2.5 py-1 rounded-full animate-pulse">
                Waiting for opponent...
              </span>
              <button
                disabled={loading}
                onClick={handleDecline}
                className={`text-[9px] font-bold opacity-60 hover:opacity-100 transition-all cursor-pointer ${
                  isOwn ? 'text-white/80 hover:text-white underline' : 'text-gray-600 hover:text-gray-800 underline'
                }`}
              >
                Cancel Invitation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cancelled screen */}
      {game.status === 'cancelled' && (
        <div className="text-center py-1">
          <p className="text-xs opacity-75">Match cancelled or declined</p>
        </div>
      )}

      {/* Active gameplay screen */}
      {game.status === 'active' && (
        <div className="space-y-2">
          {game.game_type === 'connectfour' && <ConnectFourBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'dotsandboxes' && <DotsAndBoxesBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'higherlower' && <HigherLowerBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'reactionbattle' && <ReactionBattleBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'tictactoe' && <TicTacToeBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'rps' && <RockPaperScissorsBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'emojiguess' && <EmojiGuessBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'wouldyourather' && <WouldYouRatherBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'battleship' && <BattleshipBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          {game.game_type === 'wordguess' && <WordGuessBoard game={game} currentUserId={currentUserId} setActiveGames={setActiveGames} />}
          
          <div className={`flex justify-center pt-2 border-t mt-2 ${
            isOwn ? 'border-white/10' : 'border-gray-200'
          }`}>
            <button
              disabled={loading}
              onClick={handleDecline}
              className={`text-[10px] font-bold opacity-60 hover:opacity-100 transition-all flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer ${
                isOwn 
                  ? 'text-white bg-black/10 hover:bg-black/25' 
                  : 'text-gray-700 bg-gray-200/50 hover:bg-gray-200'
              }`}
            >
              Quit Game
            </button>
          </div>
        </div>
      )}

      {/* Completed results screen */}
      {game.status === 'completed' && (
        <div className="space-y-4">
          {/* Render static completed boards or reveals */}
          {game.game_type === 'connectfour' && <ConnectFourBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'dotsandboxes' && <DotsAndBoxesBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'higherlower' && <HigherLowerBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'reactionbattle' && <ReactionBattleBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'tictactoe' && <TicTacToeBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'rps' && <RockPaperScissorsBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'emojiguess' && <EmojiGuessBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'wouldyourather' && <WouldYouRatherBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'battleship' && <BattleshipBoard game={game} currentUserId={currentUserId} />}
          {game.game_type === 'wordguess' && <WordGuessBoard game={game} currentUserId={currentUserId} />}

          <div className="flex flex-col items-center justify-center p-3.5 bg-black/10 rounded-2xl text-center space-y-1.5 border border-white/5">
            <Award className="w-5 h-5 text-yellow-300" />
            <span className="text-xs font-bold">
              {game.winner_id === null 
                ? '🤝 Draw Match!' 
                : game.winner_id === currentUserId 
                  ? '🎉 You Won!' 
                  : '🏆 Opponent Won!'}
            </span>
          </div>

          <button
            disabled={rematchLoading}
            onClick={handlePlayAgain}
            className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 min-h-[36px] ${
              isOwn 
                ? 'bg-white text-blue-600 hover:bg-gray-50' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rematchLoading ? 'animate-spin' : ''}`} />
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
