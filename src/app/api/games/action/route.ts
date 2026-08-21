import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

// Tic-Tac-Toe winner helper
function checkTicTacToeWinner(board: (string | null)[]) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]            // diagonals
  ]
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] // returns user_id
    }
  }
  if (board.every(cell => cell !== null)) {
    return 'draw'
  }
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { gameId, action, payload } = body

    if (!gameId || !action) {
      return NextResponse.json({ error: 'Missing gameId or action' }, { status: 400 })
    }

    // Fetch the game (using service_role query to bypass RLS for secure validation or standard user client)
    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle()

    if (fetchErr || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Validate that game is not completed or cancelled
    if (game.status === 'completed' || game.status === 'cancelled') {
      return NextResponse.json({ error: 'Game has already ended' }, { status: 400 })
    }

    const { game_type, created_by, opponent_id } = game
    let nextState = { ...game.state }
    let nextStatus = game.status
    let winnerId = game.winner_id

    // =========================================================================
    // GAME LOGIC: TIC-TAC-TOE
    // =========================================================================
    if (game_type === 'tictactoe') {
      if (action !== 'move') {
        return NextResponse.json({ error: 'Invalid action for Tic-Tac-Toe' }, { status: 400 })
      }
      const { cellIndex } = payload || {}
      if (cellIndex === undefined || cellIndex < 0 || cellIndex > 8) {
        return NextResponse.json({ error: 'Invalid cell index' }, { status: 400 })
      }

      // Verify turn
      if (nextState.turn !== user.id) {
        return NextResponse.json({ error: 'Not your turn' }, { status: 400 })
      }

      // Check if cell is occupied
      if (nextState.board[cellIndex] !== null) {
        return NextResponse.json({ error: 'Cell already occupied' }, { status: 400 })
      }

      // Make move
      nextState.board[cellIndex] = user.id

      // Calculate result
      const result = checkTicTacToeWinner(nextState.board)
      if (result === 'draw') {
        nextStatus = 'completed'
        winnerId = null
      } else if (result) {
        nextStatus = 'completed'
        winnerId = result
      } else {
        // Toggle turn
        nextState.turn = user.id === created_by ? opponent_id : created_by
      }
    }

    // =========================================================================
    // GAME LOGIC: ROCK PAPER SCISSORS
    // =========================================================================
    else if (game_type === 'rps') {
      if (action !== 'select') {
        return NextResponse.json({ error: 'Invalid action for RPS' }, { status: 400 })
      }
      const { choice } = payload || {}
      if (!['rock', 'paper', 'scissors'].includes(choice)) {
        return NextResponse.json({ error: 'Choice must be rock, paper, or scissors' }, { status: 400 })
      }

      // Write private state choice
      const { error: privErr } = await adminSupabase
        .from('game_private_states')
        .upsert({
          game_id: gameId,
          user_id: user.id,
          private_state: { choice },
        })

      if (privErr) {
        return NextResponse.json({ error: 'Failed to record choice' }, { status: 500 })
      }

      // Mark move as submitted in public state
      nextState.moves[user.id] = true

      // Check if both players have submitted
      if (nextState.moves[created_by] && nextState.moves[opponent_id]) {
        // Retrieve both private choices using admin client to bypass RLS
        const { data: privStates, error: privFetchErr } = await adminSupabase
          .from('game_private_states')
          .select('*')
          .eq('game_id', gameId)

        if (privFetchErr || !privStates || privStates.length < 2) {
          return NextResponse.json({ error: 'Failed to evaluate choices' }, { status: 500 })
        }

        const choiceA = privStates.find((p: any) => p.user_id === created_by)?.private_state.choice
        const choiceB = privStates.find((p: any) => p.user_id === opponent_id)?.private_state.choice

        nextState.choices = {
          [created_by]: choiceA,
          [opponent_id]: choiceB,
        }
        nextState.revealed = true
        nextStatus = 'completed'

        if (choiceA === choiceB) {
          winnerId = null // Draw
        } else if (
          (choiceA === 'rock' && choiceB === 'scissors') ||
          (choiceA === 'scissors' && choiceB === 'paper') ||
          (choiceA === 'paper' && choiceB === 'rock')
        ) {
          winnerId = created_by
        } else {
          winnerId = opponent_id
        }
      }
    }

    // =========================================================================
    // GAME LOGIC: EMOJI GUESS
    // =========================================================================
    else if (game_type === 'emojiguess') {
      if (action === 'submit_guess') {
        if (user.id === created_by) {
          return NextResponse.json({ error: 'Challenge creator cannot guess' }, { status: 400 })
        }
        const { guess } = payload || {}
        if (!guess) {
          return NextResponse.json({ error: 'Guess cannot be empty' }, { status: 400 })
        }

        // Fetch answer from creator's private state (admin bypass — creator may not be the current user)
        const { data: privState } = await adminSupabase
          .from('game_private_states')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', created_by)
          .maybeSingle()

        if (!privState) {
          return NextResponse.json({ error: 'Challenge configuration error' }, { status: 500 })
        }

        const correctAns = privState.private_state.correctAnswer
        const normalizedGuess = guess.toLowerCase().trim()

        if (normalizedGuess === correctAns) {
          nextStatus = 'completed'
          winnerId = user.id
          nextState.guessed = true
          nextState.result = 'correct'
          nextState.guess = guess
          nextState.correctAnswer = correctAns // Reveal answer
        } else {
          nextState.guesses = [...(nextState.guesses || []), guess]
          nextState.result = 'incorrect'
        }
      } else if (action === 'reveal_answer') {
        // Admin bypass to read creator's private answer
        const { data: privState } = await adminSupabase
          .from('game_private_states')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', created_by)
          .maybeSingle()

        if (!privState) {
          return NextResponse.json({ error: 'Challenge configuration error' }, { status: 500 })
        }

        nextStatus = 'completed'
        winnerId = null
        nextState.guessed = false
        nextState.result = 'revealed'
        nextState.correctAnswer = privState.private_state.correctAnswer
      } else {
        return NextResponse.json({ error: 'Invalid action for Emoji Guess' }, { status: 400 })
      }
    }

    // =========================================================================
    // GAME LOGIC: WOULD YOU RATHER
    // =========================================================================
    else if (game_type === 'wouldyourather') {
      if (action !== 'vote') {
        return NextResponse.json({ error: 'Invalid action for Would You Rather' }, { status: 400 })
      }
      const { choice } = payload || {} // 'A' or 'B'
      if (choice !== 'A' && choice !== 'B') {
        return NextResponse.json({ error: 'Choice must be A or B' }, { status: 400 })
      }

      // Check if already voted
      if (nextState.votes[user.id] !== null) {
        return NextResponse.json({ error: 'You have already voted' }, { status: 400 })
      }

      // Save choice in private state
      const { error: privErr } = await supabase
        .from('game_private_states')
        .upsert({
          game_id: gameId,
          user_id: user.id,
          private_state: { choice },
        })

      if (privErr) {
        return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
      }

      // Mark user as voted in public state
      nextState.votes[user.id] = true

      // If both voted, reveal results
      if (nextState.votes[created_by] && nextState.votes[opponent_id]) {
        // Admin bypass to read both players' votes
        const { data: privStates, error: privFetchErr } = await adminSupabase
          .from('game_private_states')
          .select('*')
          .eq('game_id', gameId)

        if (privFetchErr || !privStates || privStates.length < 2) {
          return NextResponse.json({ error: 'Failed to evaluate votes' }, { status: 500 })
        }

        const voteA = privStates.find((p: any) => p.user_id === created_by)?.private_state.choice
        const voteB = privStates.find((p: any) => p.user_id === opponent_id)?.private_state.choice

        nextState.choices = {
          [created_by]: voteA,
          [opponent_id]: voteB,
        }
        nextState.revealed = true
        nextStatus = 'completed'
      }
    }

    // =========================================================================
    // GAME LOGIC: BATTLESHIP
    // =========================================================================
    else if (game_type === 'battleship') {
      if (action === 'submit_layout') {
        const { ships } = payload || {} // array of coordinates or 10x10 placement array
        if (!ships || !Array.isArray(ships)) {
          return NextResponse.json({ error: 'Invalid ship layouts' }, { status: 400 })
        }

        // Enforce phase status
        if (nextState.status !== 'setup') {
          return NextResponse.json({ error: 'Game is not in ship setup phase' }, { status: 400 })
        }

        // Save layout in user's private state
        const { error: privErr } = await supabase
          .from('game_private_states')
          .upsert({
            game_id: gameId,
            user_id: user.id,
            private_state: { ships },
          })

        if (privErr) {
          return NextResponse.json({ error: 'Failed to save ship placement' }, { status: 500 })
        }

        nextState.ready[user.id] = true

        // If both are ready, switch status to active and assign random first turn
        if (nextState.ready[created_by] && nextState.ready[opponent_id]) {
          nextState.status = 'active';
          nextStatus = 'active';
          nextState.turn = Math.random() > 0.5 ? created_by : opponent_id
        }
      } else if (action === 'attack') {
        const { x, y } = payload || {}
        if (x === undefined || y === undefined || x < 0 || x > 9 || y < 0 || y > 9) {
          return NextResponse.json({ error: 'Invalid coordinate' }, { status: 400 })
        }

        if (nextState.status !== 'active') {
          return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
        }

        // Verify turn
        if (nextState.turn !== user.id) {
          return NextResponse.json({ error: 'Not your turn' }, { status: 400 })
        }

        // Check duplicate attack
        const myHits = nextState.hits[user.id] || []
        if (myHits.some((h: any) => h.x === x && h.y === y)) {
          return NextResponse.json({ error: 'You already attacked this cell' }, { status: 400 })
        }

        const opponentId = user.id === created_by ? opponent_id : created_by

        // Load opponent's ships layout (admin bypass — reading opponent's private state)
        const { data: privState } = await adminSupabase
          .from('game_private_states')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', opponentId)
          .maybeSingle()

        if (!privState) {
          return NextResponse.json({ error: 'Opponent ships not found' }, { status: 500 })
        }

        const opponentShips = privState.private_state.ships as { x: number; y: number }[]
        const isHit = opponentShips.some((s: any) => s.x === x && s.y === y)

        const newHitResult = { x, y, hit: isHit }
        nextState.hits[user.id] = [...myHits, newHitResult]

        // Check if all opponent ships are hit
        const hitCoordsCount = nextState.hits[user.id].filter((h: any) => h.hit).length
        if (hitCoordsCount >= opponentShips.length) {
          nextStatus = 'completed'
          nextState.status = 'completed'
          winnerId = user.id
        } else {
          // Rule: hit keeps turn, miss toggles turn
          if (!isHit) {
            nextState.turn = opponentId
          }
        }
      } else {
        return NextResponse.json({ error: 'Invalid action for Battleship' }, { status: 400 })
      }
    }

    // =========================================================================
    // GAME LOGIC: WORD GUESS
    // =========================================================================
    else if (game_type === 'wordguess') {
      if (user.id === created_by) {
        return NextResponse.json({ error: 'Word creator cannot guess letters' }, { status: 400 })
      }

      // Fetch word from creator private state (admin bypass — guesser is not the creator)
      const { data: privState } = await adminSupabase
        .from('game_private_states')
        .select('*')
        .eq('game_id', gameId)
        .eq('user_id', created_by)
        .maybeSingle()

      if (!privState) {
        return NextResponse.json({ error: 'Secret word configuration error' }, { status: 500 })
      }

      const secretWord = privState.private_state.secretWord.toUpperCase().trim()

      if (action === 'guess_letter') {
        const { letter } = payload || {}
        if (!letter || letter.length !== 1) {
          return NextResponse.json({ error: 'Invalid letter' }, { status: 400 })
        }
        const upperLetter = letter.toUpperCase()

        if (nextState.guesses.includes(upperLetter)) {
          return NextResponse.json({ error: 'You already guessed this letter' }, { status: 400 })
        }

        nextState.guesses = [...nextState.guesses, upperLetter]

        // Check hit
        if (!secretWord.includes(upperLetter)) {
          nextState.attemptsLeft -= 1
        }

        // Check win condition (all letters guessed)
        const wordLetters = Array.from(new Set(secretWord.split('')))
        const allGuessed = wordLetters.every((char: any) => 
          char === ' ' || nextState.guesses.includes(char)
        )

        if (allGuessed) {
          nextStatus = 'completed'
          winnerId = user.id
          nextState.status = 'completed'
          nextState.secretWord = secretWord // Reveal word
        } else if (nextState.attemptsLeft <= 0) {
          nextStatus = 'completed'
          winnerId = null
          nextState.status = 'completed'
          nextState.secretWord = secretWord // Reveal word
        }
      } else if (action === 'guess_word') {
        const { word } = payload || {}
        if (!word) {
          return NextResponse.json({ error: 'Word guess cannot be empty' }, { status: 400 })
        }
        const upperWord = word.toUpperCase().trim()

        if (upperWord === secretWord) {
          nextStatus = 'completed'
          winnerId = user.id
          nextState.status = 'completed'
          nextState.secretWord = secretWord // Reveal word
        } else {
          nextState.attemptsLeft -= 1
          nextState.guesses = [...nextState.guesses, `GUESS: ${upperWord}`]

          if (nextState.attemptsLeft <= 0) {
            nextStatus = 'completed'
            winnerId = null
            nextState.status = 'completed'
            nextState.secretWord = secretWord // Reveal word
          }
        }
      } else {
        return NextResponse.json({ error: 'Invalid action for Word Guess' }, { status: 400 })
      }
    }

    // Save state back to DB
    const { data: updatedGame, error: updateErr } = await supabase
      .from('games')
      .update({
        state: nextState,
        status: nextStatus,
        winner_id: winnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select()
      .single()

    if (updateErr) {
      console.error('Failed to update game state:', updateErr)
      return NextResponse.json({ error: 'Failed to update game action' }, { status: 500 })
    }

    // Cleanup private states if game is completed
    if (nextStatus === 'completed') {
      await supabase
        .from('game_private_states')
        .delete()
        .eq('game_id', gameId)
    }

    return NextResponse.json({ success: true, game: updatedGame })
  } catch (err: any) {
    console.error('Error in game action route:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
