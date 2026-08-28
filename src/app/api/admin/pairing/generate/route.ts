import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { isAdminServer, createAuditLog } from '@/utils/admin'
import crypto from 'crypto'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Server-side check that the user is an admin
    const isAdmin = await isAdminServer(supabase)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate standard 8-character alphanumeric pairing code: XXXX-XXXX
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid confusing chars (I, O, 0, 1)
    let part1 = ''
    let part2 = ''
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length))
      part2 += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const rawCode = `${part1}-${part2}`
    
    // Hash the code
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex')
    
    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('pairing_codes')
      .insert({
        code_hash: codeHash,
        created_by: user.id,
        expires_at: expiresAt,
        is_used: false
      })
      .select()

    if (error) {
      console.error('Failed to save pairing code:', error.message)
      return NextResponse.json({ error: 'Failed to generate pairing code' }, { status: 500 })
    }

    // Audit log
    await createAuditLog(
      user.id,
      'DEVICE_PAIR_GENERATE',
      null,
      null,
      { expires_at: expiresAt }
    )

    return NextResponse.json({
      success: true,
      code: rawCode,
      expiresAt
    })
  } catch (err: any) {
    console.error('Generate pairing code error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
