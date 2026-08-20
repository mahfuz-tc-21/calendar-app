import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createHash } from 'crypto'

function hashPasscode(passcode: string, salt: string) {
  return createHash('sha256').update(passcode + salt).digest('hex')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { passcode } = await request.json()
    if (!passcode || typeof passcode !== 'string' || passcode.length < 4) {
      return NextResponse.json({ error: 'Invalid passcode. Minimum 4 characters required.' }, { status: 400 })
    }

    const hash = hashPasscode(passcode, user.id)

    // Check if passcode is already set to decide update vs insert
    const { data: existing } = await supabase
      .from('privacy_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let query
    if (existing) {
      query = supabase
        .from('privacy_settings')
        .update({
          access_key_hash: hash,
          failed_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } else {
      query = supabase
        .from('privacy_settings')
        .insert({
          user_id: user.id,
          access_key_hash: hash,
          failed_attempts: 0,
        })
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error during passcode setup:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
