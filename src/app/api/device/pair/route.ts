import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createAuditLog } from '@/utils/admin'
import crypto from 'crypto'

// Simple in-memory rate limiter keyed by user_id to prevent brute-forcing pairing codes
const FAILED_ATTEMPTS = new Map<string, { count: number; lockUntil: number }>()

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting check
    const rateLimit = FAILED_ATTEMPTS.get(user.id)
    const now = Date.now()
    if (rateLimit && rateLimit.lockUntil > now) {
      const waitMinutes = Math.ceil((rateLimit.lockUntil - now) / 60000)
      return NextResponse.json(
        { error: `Too many failed pairing attempts. Please try again in ${waitMinutes} minute(s).` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { pairingCode, deviceId } = body

    if (!pairingCode || !deviceId) {
      return NextResponse.json({ error: 'Missing pairingCode or deviceId' }, { status: 400 })
    }

    // Clean up input and format
    const cleanedCode = pairingCode.trim().toUpperCase()
    const codeHash = crypto.createHash('sha256').update(cleanedCode).digest('hex')

    const adminSupabase = createAdminClient()

    // 1. Fetch the pairing code session using the Admin client
    const { data: codeData, error: codeError } = await adminSupabase
      .from('pairing_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .maybeSingle()

    if (codeError || !codeData) {
      // Record failed attempt for rate limiting
      const currentFailures = rateLimit ? rateLimit.count + 1 : 1
      if (currentFailures >= 5) {
        FAILED_ATTEMPTS.set(user.id, {
          count: currentFailures,
          lockUntil: now + 15 * 60 * 1000 // 15 min lock
        })
      } else {
        FAILED_ATTEMPTS.set(user.id, {
          count: currentFailures,
          lockUntil: 0
        })
      }

      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 })
    }

    // 2. Validate expiration and usage
    if (new Date(codeData.expires_at).getTime() < now) {
      return NextResponse.json({ error: 'Pairing code has expired' }, { status: 400 })
    }

    if (codeData.used_at) {
      return NextResponse.json({ error: 'Pairing code has already been used' }, { status: 400 })
    }

    // 3. Look up the device record matching the deviceId and user
    const { data: deviceData, error: deviceError } = await adminSupabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (deviceError || !deviceData) {
      return NextResponse.json({ error: 'Device must be registered first' }, { status: 404 })
    }

    if (deviceData.is_paired) {
      return NextResponse.json({ error: 'Device is already paired' }, { status: 400 })
    }

    const updateTime = new Date().toISOString()

    // 4. Update the device as paired
    const { error: devUpdateError } = await adminSupabase
      .from('devices')
      .update({
        is_paired: true,
        paired_at: updateTime,
        updated_at: updateTime
      })
      .eq('id', deviceData.id)

    if (devUpdateError) {
      console.error('Failed to update device status:', devUpdateError.message)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    // 5. Update the pairing code as used
    const { error: codeUpdateError } = await adminSupabase
      .from('pairing_codes')
      .update({
        used_at: updateTime,
        device_id: deviceData.id
      })
      .eq('id', codeData.id)

    if (codeUpdateError) {
      console.error('Failed to update pairing code status:', codeUpdateError.message)
      // Note: We don't rollback device update to avoid security state conflicts, but we log it
    }

    // Reset rate limiter on success
    FAILED_ATTEMPTS.delete(user.id)

    // 6. Write Audit Log
    await createAuditLog(
      codeData.created_by, // Admin who generated code
      'DEVICE_PAIR',
      user.id, // Target user
      deviceData.id, // Target device
      { code_id: codeData.id }
    )

    return NextResponse.json({
      success: true,
      message: 'Device paired successfully',
      device: {
        id: deviceData.id,
        deviceName: deviceData.device_name,
        deviceModel: deviceData.device_model,
        pairedAt: updateTime
      }
    })
  } catch (err: any) {
    console.error('Pairing API catch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
