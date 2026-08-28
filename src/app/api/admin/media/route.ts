import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { isAdminServer } from '@/utils/admin'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId') // This is the devices.id database UUID

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId parameter' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { data: media, error } = await adminSupabase
      .from('media_metadata')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to query media metadata:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      media
    })
  } catch (err: any) {
    console.error('Admin media fetch API catch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
