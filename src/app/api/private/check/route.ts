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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('privacy_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const exists = !!data
    let unlocked = false

    if (exists) {
      const cookieStore = await cookies()
      const headersList = await headers()
      const token = cookieStore.get('private_space_token')?.value || headersList.get('x-private-space-token')
      
      unlocked = !!(token && verifySessionToken(token, user.id))
    }

    return NextResponse.json({ exists, unlocked })
  } catch (err) {
    console.error('Error checking passcode setup:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
