import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { isAdminServer, createAuditLog } from '@/utils/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isAdminServer(supabase)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body // This is the devices.id UUID

    if (!id) {
      return NextResponse.json({ error: 'Missing device UUID' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Get the device user_id and name before deleting (for auditing)
    const { data: deviceData, error: fetchErr } = await adminSupabase
      .from('devices')
      .select('user_id, device_name')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !deviceData) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // 2. Delete the device from the database
    const { error: deleteError } = await adminSupabase
      .from('devices')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete device from DB:', deleteError.message)
      return NextResponse.json({ error: 'Database delete failed' }, { status: 500 })
    }

    // 3. Write Audit Log
    await createAuditLog(
      user.id,
      'DEVICE_REMOVE',
      deviceData.user_id,
      id,
      { device_name: deviceData.device_name }
    )

    return NextResponse.json({ success: true, message: 'Device removed successfully' })
  } catch (err: any) {
    console.error('Delete device error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
