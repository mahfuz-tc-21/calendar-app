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

    // Only the intended opponent can decline the invitation
    if (game.opponent_id !== user.id) {
      return NextResponse.json({ error: 'Only the invited player can decline the game' }, { status: 403 })
    }

    if (game.status !== 'pending') {
      return NextResponse.json({ error: 'Game is no longer pending' }, { status: 400 })
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
