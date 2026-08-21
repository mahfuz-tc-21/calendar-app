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
    const { gameId } = body

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    // Fetch the game
    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle()

    if (fetchErr || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Verify conversation membership
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', game.conversation_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized conversation member' }, { status: 403 })
    }

    // Allow either the creator or opponent to cancel/decline/quit
    const isCreator = game.created_by === user.id
    const isOpponent = game.opponent_id === user.id

    if (!isCreator && !isOpponent) {
      return NextResponse.json({ error: 'Unauthorized to cancel this game' }, { status: 403 })
    }

    if (game.status !== 'pending' && game.status !== 'active') {
      return NextResponse.json({ error: 'Game is not active or pending' }, { status: 400 })
    }

    // Update game status to cancelled
    const { data: updatedGame, error: updateErr } = await supabase
      .from('games')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select()
      .single()

    if (updateErr) {
      console.error('Failed to decline game:', updateErr)
      return NextResponse.json({ error: 'Failed to decline game' }, { status: 500 })
    }

    return NextResponse.json({ success: true, game: updatedGame })
  } catch (err: any) {
    console.error('Error in decline game route:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
