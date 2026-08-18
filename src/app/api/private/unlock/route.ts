import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createHash, createHmac } from 'crypto'
import { cookies } from 'next/headers'

const HMAC_SECRET = process.env.NEXTAUTH_SECRET || 'aura_fallback_secret_for_signing_private_sessions'

function hashPasscode(passcode: string, salt: string) {
  return createHash('sha256').update(passcode + salt).digest('hex')
}

function signSessionToken(userId: string) {
  const payload = JSON.stringify({ userId, exp: Date.now() + 30 * 60 * 1000 }) // 30 minutes
  const signature = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64')}.${signature}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { passcode } = await request.json()
    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json({ error: 'Unable to unlock private space.' }, { status: 400 })
    }

    // Fetch privacy settings
    const { data: settings, error: fetchError } = await supabase
      .from('privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !settings) {
      return NextResponse.json({ error: 'Unable to unlock private space.' }, { status: 400 })
    }

    // Check rate limit lock
    if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(settings.locked_until).getTime() - Date.now()) / 60000
      )
      return NextResponse.json({
        error: `Account locked. Try again in ${remainingMinutes} minutes.`,
      }, { status: 423 })
    }

    const hash = hashPasscode(passcode, user.id)

    if (settings.access_key_hash === hash) {
      // Success: Reset rate limit variables
      await supabase
        .from('privacy_settings')
        .update({
          failed_attempts: 0,
          locked_until: null,
        })
        .eq('user_id', user.id)

      // Sign session cookie
      const token = signSessionToken(user.id)
      const cookieStore = await cookies()
      cookieStore.set('private_space_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60, // 30 mins
        path: '/',
      })

      return NextResponse.json({ success: true })
    } else {
      // Failure: Increment rate limits
      const nextFailed = settings.failed_attempts + 1
      let lockedUntil = null

      if (nextFailed >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins lock
      }

      await supabase
        .from('privacy_settings')
        .update({
          failed_attempts: nextFailed,
          locked_until: lockedUntil,
        })
        .eq('user_id', user.id)

      if (nextFailed >= 5) {
        return NextResponse.json({
          error: 'Too many failed attempts. Locked for 15 minutes.',
        }, { status: 423 })
      }

      return NextResponse.json({ error: 'Unable to unlock private space.' }, { status: 400 })
    }
  } catch (err) {
    console.error('Error during passcode verification:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
