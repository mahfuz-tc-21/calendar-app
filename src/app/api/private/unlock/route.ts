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

import fs from 'fs'

function logDebug(message: string) {
  try {
    const logPath = 'd:/Mahfuz/Project/calendar app/debug.log'
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Unlock] ${message}\n`)
  } catch (e) {
    console.error('Failed to write debug log:', e)
  }
}

export async function POST(request: Request) {
  try {
    logDebug('POST /api/private/unlock called')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      logDebug(`authError: ${authError.message}`)
    }

    if (!user) {
      logDebug('Unauthorized: No user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logDebug(`User authenticated: id=${user.id}, email=${user.email}`)

    const { passcode } = await request.json()
    logDebug(`Passcode parameter received: ${passcode}`)
    if (!passcode || typeof passcode !== 'string') {
      logDebug('Invalid passcode parameter')
      return NextResponse.json({ error: 'Unable to unlock private space.' }, { status: 400 })
    }

    // Fetch privacy settings
    const { data: settings, error: fetchError } = await supabase
      .from('privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      logDebug(`Fetch error: ${fetchError.message}`)
    }

    if (!settings) {
      logDebug('No privacy settings found for user in DB')
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
    logDebug(`Computed hash: ${hash}`)
    logDebug(`Stored hash: ${settings.access_key_hash}`)

    if (settings.access_key_hash === hash) {
      logDebug('Passcode MATCH! Resetting rate limits and setting token...')
      
      // OPTIMIZATION: Avoid database write if it's already 0/null.
      // If it is not, run the update in the background (fire-and-forget) to eliminate blocking latency!
      if (settings.failed_attempts > 0 || settings.locked_until !== null) {
        supabase
          .from('privacy_settings')
          .update({
            failed_attempts: 0,
            locked_until: null,
          })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) logDebug(`Background rate limit reset error: ${error.message}`)
            else logDebug('Background rate limit reset success')
          })
      }

      // Sign session cookie
      const token = signSessionToken(user.id)
      logDebug(`Generated token: ${token}`)
      const cookieStore = await cookies()
      cookieStore.set('private_space_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60, // 30 mins
        path: '/',
      })

      return NextResponse.json({ success: true, token })
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
  } catch (err: any) {
    logDebug(`Unhandled error inside unlock: ${err?.message || err}`)
    console.error('Error during passcode verification:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
