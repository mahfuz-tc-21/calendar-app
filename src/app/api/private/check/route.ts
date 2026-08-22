import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies, headers } from 'next/headers'
import { createHmac } from 'crypto'

const HMAC_SECRET = process.env.NEXTAUTH_SECRET || 'aura_fallback_secret_for_signing_private_sessions'

function verifySessionToken(token: string, userId: string) {
  try {
    const [payloadB64, signature] = token.split('.')
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8')
    const payload = JSON.parse(payloadStr)
    if (payload.userId !== userId) return false
    if (payload.exp < Date.now()) return false
    const expectedSig = createHmac('sha256', HMAC_SECRET).update(payloadStr).digest('hex')
    return expectedSig === signature
  } catch {
    return false
  }
}

import fs from 'fs'

function logDebug(message: string) {
  try {
    const logPath = 'd:/Mahfuz/Project/calendar app/debug.log'
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Check] ${message}\n`)
  } catch (e) {
    console.error('Failed to write debug log:', e)
  }
}

export async function GET() {
  try {
    logDebug('GET /api/private/check called')
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

    const { data, error } = await supabase
      .from('privacy_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      logDebug(`Database error: ${error.message}`)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const exists = !!data
    let unlocked = false

    logDebug(`Privacy settings exists: ${exists}, data=${JSON.stringify(data)}`)

    if (exists) {
      const cookieStore = await cookies()
      const headersList = await headers()
      const token = cookieStore.get('private_space_token')?.value || headersList.get('x-private-space-token')
      
      logDebug(`Token found: ${token ? 'yes' : 'no'}`)
      if (token) {
        unlocked = verifySessionToken(token, user.id)
        logDebug(`verifySessionToken result: ${unlocked}`)
      }
    }

    return NextResponse.json({ exists, unlocked })
  } catch (err: any) {
    logDebug(`Unhandled error: ${err?.message || err}`)
    console.error('Error checking passcode setup:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
