import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

// Connect Four winner helper
function checkConnectFourWinner(board: (string | null)[][]) {
  const ROWS = 6
  const COLS = 7

  // Check horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const val = board[r][c]
      if (val && val === board[r][c+1] && val === board[r][c+2] && val === board[r][c+3]) {
        return val
      }
    }
  }

  // Check vertical
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = board[r][c]
      if (val && val === board[r+1][c] && val === board[r+2][c] && val === board[r+3][c]) {
        return val
      }
    }
  }

  // Check diagonal down-right (\)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const val = board[r][c]
      if (val && val === board[r+1][c+1] && val === board[r+2][c+2] && val === board[r+3][c+3]) {
        return val
      }
    }
  }

  // Check diagonal up-right (/)
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const val = board[r][c]
      if (val && val === board[r-1][c+1] && val === board[r-2][c+2] && val === board[r-3][c+3]) {
        return val
      }
    }
  }

  // Check draw
  let isFull = true
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === null) {
        isFull = false
        break
      }
    }
    if (!isFull) break
  }

  if (isFull) {
    return 'draw'
  }

  return null
}

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
    
    // =========================================================================
    // GAME LOGIC: CONNECT FOUR
    // =========================================================================
    else if (game_type === 'connectfour') {
      if (action !== 'move') {
        return NextResponse.json({ error: 'Invalid action for Connect Four' }, { status: 400 })
      }
      const { colIndex } = payload || {}
      if (colIndex === undefined || colIndex < 0 || colIndex > 6) {
        return NextResponse.json({ error: 'Invalid column index' }, { status: 400 })
      }

      // Verify turn
      if (nextState.turn !== user.id) {
        return NextResponse.json({ error: 'Not your turn' }, { status: 400 })
      }

      // Drop the piece in the column: find lowest available row (from row 5 up to 0)
      let targetRow = -1
      for (let r = 5; r >= 0; r--) {
        if (nextState.board[r][colIndex] === null) {
          targetRow = r
          break
        }
      }

      if (targetRow === -1) {
        return NextResponse.json({ error: 'Column is full' }, { status: 400 })
      }

      // Place move
      nextState.board[targetRow][colIndex] = user.id

      // Calculate result
      const result = checkConnectFourWinner(nextState.board)
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
    // GAME LOGIC: DOTS & BOXES
    // =========================================================================
    else if (game_type === 'dotsandboxes') {
      if (action !== 'move') {
        return NextResponse.json({ error: 'Invalid action for Dots & Boxes' }, { status: 400 })
      }
      const { lineType, row, col } = payload || {}
      if (lineType !== 'h' && lineType !== 'v') {
        return NextResponse.json({ error: 'Invalid line type' }, { status: 400 })
      }
      
      if (lineType === 'h') {
        if (row === undefined || row < 0 || row > 4 || col === undefined || col < 0 || col > 3) {
          return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
        }
        if (nextState.hLines[row][col] === true) {
          return NextResponse.json({ error: 'Line already placed' }, { status: 400 })
        }
      } else {
        if (row === undefined || row < 0 || row > 3 || col === undefined || col < 0 || col > 4) {
          return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
        }
        if (nextState.vLines[row][col] === true) {
          return NextResponse.json({ error: 'Line already placed' }, { status: 400 })
        }
      }

      // Verify turn
      if (nextState.turn !== user.id) {
        return NextResponse.json({ error: 'Not your turn' }, { status: 400 })
      }

      // Place the line
      if (lineType === 'h') {
        nextState.hLines[row][col] = true
      } else {
        nextState.vLines[row][col] = true
      }

      // Check box completion
      let completedBox = false
      const hLines = nextState.hLines
      const vLines = nextState.vLines
      const boxes = nextState.boxes

      if (lineType === 'h') {
        // Check box above
        if (row > 0) {
          const rAbove = row - 1
          if (hLines[rAbove][col] && vLines[rAbove][col] && vLines[rAbove][col + 1]) {
            if (boxes[rAbove][col] === null) {
              boxes[rAbove][col] = user.id
              nextState.scores[user.id] = (nextState.scores[user.id] || 0) + 1
              completedBox = true
            }
          }
        }
        // Check box below
        if (row < 4) {
          if (hLines[row + 1][col] && vLines[row][col] && vLines[row][col + 1]) {
            if (boxes[row][col] === null) {
              boxes[row][col] = user.id
              nextState.scores[user.id] = (nextState.scores[user.id] || 0) + 1
              completedBox = true
            }
          }
        }
      } else {
        // Check box left
        if (col > 0) {
          const cLeft = col - 1
          if (vLines[row][cLeft] && hLines[row][cLeft] && hLines[row + 1][cLeft]) {
            if (boxes[row][cLeft] === null) {
              boxes[row][cLeft] = user.id
              nextState.scores[user.id] = (nextState.scores[user.id] || 0) + 1
              completedBox = true
            }
          }
        }
        // Check box right
        if (col < 4) {
          if (vLines[row][col + 1] && hLines[row][col] && hLines[row + 1][col]) {
            if (boxes[row][col] === null) {
              boxes[row][col] = user.id
              nextState.scores[user.id] = (nextState.scores[user.id] || 0) + 1
              completedBox = true
            }
          }
        }
      }

      // If no box completed, toggle turn
      if (!completedBox) {
        nextState.turn = user.id === created_by ? opponent_id : created_by
      }

      // Check win condition (sum of box scores equals 16)
      const score1 = nextState.scores[created_by] || 0
      const score2 = nextState.scores[opponent_id] || 0
      if (score1 + score2 === 16) {
        nextStatus = 'completed'
        if (score1 === score2) {
          winnerId = null
        } else {
          winnerId = score1 > score2 ? created_by : opponent_id
        }
      }
    }

    // =========================================================================
    // GAME LOGIC: HIGHER OR LOWER
    // =========================================================================
    else if (game_type === 'higherlower') {
      if (action !== 'predict') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
      const { prediction } = payload || {}
      if (prediction !== 'higher' && prediction !== 'lower') {
        return NextResponse.json({ error: 'Invalid prediction' }, { status: 400 })
      }

      if (nextState.predictions[user.id] !== null) {
        return NextResponse.json({ error: 'Already predicted' }, { status: 400 })
      }

      // Set prediction
      nextState.predictions[user.id] = prediction

      // If both players have predicted, resolve round
      const pred1 = nextState.predictions[created_by]
      const pred2 = nextState.predictions[opponent_id]

      if (pred1 !== null && pred2 !== null) {
        const round = nextState.round
        const currentNum = nextState.numbers[round]
        const nextNum = nextState.numbers[round + 1]
        
        const correctPrediction = nextNum > currentNum ? 'higher' : 'lower'

        if (pred1 === correctPrediction) {
          nextState.scores[created_by] = (nextState.scores[created_by] || 0) + 1
        }
        if (pred2 === correctPrediction) {
          nextState.scores[opponent_id] = (nextState.scores[opponent_id] || 0) + 1
        }

        // Advance round
        nextState.round += 1
        nextState.predictions[created_by] = null
        nextState.predictions[opponent_id] = null

        // Check if finished (5 rounds)
        if (nextState.round === 5) {
          nextStatus = 'completed'
          const score1 = nextState.scores[created_by] || 0
          const score2 = nextState.scores[opponent_id] || 0
          if (score1 === score2) {
            winnerId = null
          } else {
            winnerId = score1 > score2 ? created_by : opponent_id
          }
        }
      }
    }

    // =========================================================================
    // GAME LOGIC: REACTION BATTLE
    // =========================================================================
    else if (game_type === 'reactionbattle') {
      if (action === 'ready') {
        nextState.ready[user.id] = true

        // If both ready, start random delay countdown
        if (nextState.ready[created_by] && nextState.ready[opponent_id]) {
          const delay = Math.floor(Math.random() * 3000) + 2000 // 2s - 5s
          nextState.targetTime = Date.now() + delay
          nextState.reactions = {
            [created_by]: null,
            [opponent_id]: null,
          }
        }
      } else if (action === 'tap') {
        const { tapTime } = payload || {}
        if (!tapTime) {
          return NextResponse.json({ error: 'tapTime is required' }, { status: 400 })
        }

        if (!nextState.targetTime) {
          return NextResponse.json({ error: 'Countdown not started' }, { status: 400 })
        }

        if (nextState.reactions[user.id] !== null) {
          return NextResponse.json({ error: 'Already tapped' }, { status: 400 })
        }

        // Calculate reaction time
        let reaction = tapTime - nextState.targetTime
        if (tapTime < nextState.targetTime) {
          // False start penalty
          reaction = 999999
        }
        nextState.reactions[user.id] = reaction

        // If both players have reacted, determine round outcome
        const r1 = nextState.reactions[created_by]
        const r2 = nextState.reactions[opponent_id]

        if (r1 !== null && r2 !== null) {
          if (r1 === 999999 && r2 === 999999) {
            // Both false started
          } else {
            // Round winner
            const winner = r1 < r2 ? created_by : opponent_id
            nextState.scores[winner] = (nextState.scores[winner] || 0) + 1
          }

          // Advance round
          nextState.round += 1
          nextState.ready[created_by] = false
          nextState.ready[opponent_id] = false
          nextState.targetTime = null
          nextState.reactions[created_by] = null
          nextState.reactions[opponent_id] = null

          // Check if game complete
          const s1 = nextState.scores[created_by] || 0
          const s2 = nextState.scores[opponent_id] || 0
          if (s1 >= 3 || s2 >= 3 || nextState.round > 5) {
            nextStatus = 'completed'
            if (s1 === s2) {
              winnerId = null
            } else {
              winnerId = s1 > s2 ? created_by : opponent_id
            }
          }
        }
      } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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
