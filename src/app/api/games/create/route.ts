import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId, gameType, opponentId, options } = body

    if (!conversationId || !gameType || !opponentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify conversation membership
    const { data: membership, error: memberErr } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberErr || !membership) {
      return NextResponse.json({ error: 'Unauthorized conversation member' }, { status: 403 })
    }

    // Initialize state based on game type
    let initialState: any = {}
    let initialPrivateState: any = null

    if (gameType === 'tictactoe') {
      initialState = {
        board: Array(9).fill(null),
        turn: user.id,
        x_player_id: user.id,
        o_player_id: opponentId,
      }
    } else if (gameType === 'rps') {
      initialState = {
        moves: {
          [user.id]: false,
          [opponentId]: false,
        },
        revealed: false,
      }
    } else if (gameType === 'emojiguess') {
      const { emojiChallenge, correctAnswer } = options || {}
      if (!emojiChallenge || !correctAnswer) {
        return NextResponse.json({ error: 'Emoji guess requires a challenge and correct answer' }, { status: 400 })
      }
      initialState = {
        emojiChallenge,
        guessed: false,
        result: null,
      }
      initialPrivateState = {
        correctAnswer: correctAnswer.toLowerCase().trim(),
      }
    } else if (gameType === 'wouldyourather') {
      const { optionA, optionB } = options || {}
      if (!optionA || !optionB) {
        return NextResponse.json({ error: 'Would You Rather requires two options' }, { status: 400 })
      }
      initialState = {
        optionA,
        optionB,
        votes: {
          [user.id]: null,
          [opponentId]: null,
        },
        revealed: false,
      }
    } else if (gameType === 'battleship') {
      initialState = {
        status: 'setup', // setup -> active -> completed
        turn: user.id,
        ready: {
          [user.id]: false,
          [opponentId]: false,
        },
        hits: {
          [user.id]: [],
          [opponentId]: [],
        },
      }
    } else if (gameType === 'wordguess') {
      const { secretWord, category } = options || {}
      if (!secretWord) {
        return NextResponse.json({ error: 'Word guess requires a secret word' }, { status: 400 })
      }
      const cleanedWord = secretWord.toUpperCase().trim()
      initialState = {
        category: category || 'General',
        wordLength: cleanedWord.length,
        guesses: [],
        maxAttempts: 6,
        attemptsLeft: 6,
        status: 'active',
      }
      initialPrivateState = {
        secretWord: cleanedWord,
      }
    }

    // Insert game
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({
        conversation_id: conversationId,
        game_type: gameType,
        created_by: user.id,
        opponent_id: opponentId,
        status: 'pending',
        state: initialState,
      })
      .select()
      .single()

    if (gameErr) {
      console.error('Failed to create game:', gameErr)
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }

    // Insert private state if present
    if (initialPrivateState) {
      const { error: privErr } = await supabase
        .from('game_private_states')
        .insert({
          game_id: game.id,
          user_id: user.id,
          private_state: initialPrivateState,
        })

      if (privErr) {
        console.error('Failed to save private state:', privErr)
        // Cleanup game
        await supabase.from('games').delete().eq('id', game.id)
        return NextResponse.json({ error: 'Failed to configure game state' }, { status: 500 })
      }
    }

    // Insert message of type 'game' in chat
    const { error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_type: 'game',
        game_id: game.id,
        content: `Invited you to play ${
          gameType === 'tictactoe'
            ? 'Tic-Tac-Toe'
            : gameType === 'rps'
            ? 'Rock Paper Scissors'
            : gameType === 'emojiguess'
            ? 'Emoji Guess'
            : gameType === 'wouldyourather'
            ? 'Would You Rather'
            : gameType === 'battleship'
            ? 'Battleship'
            : 'Word Guess'
        }`,
      })

    if (msgErr) {
      console.error('Failed to insert game message:', msgErr)
      // Cleanup game and private state
      await supabase.from('games').delete().eq('id', game.id)
      return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
    }

    return NextResponse.json({ success: true, game })
  } catch (err: any) {
    console.error('Error in create game route:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
