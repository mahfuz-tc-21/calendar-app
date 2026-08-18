import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
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
      return NextResponse.json({ unlocked: false }, { status: 401 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get('private_space_token')?.value

    if (!token || !verifySessionToken(token, user.id)) {
      return NextResponse.json({ unlocked: false })
    }

    return NextResponse.json({ unlocked: true })
  } catch (err) {
    return NextResponse.json({ unlocked: false })
  }
}
