import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { isAdminServer } from '@/utils/admin'

export async function GET() {
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

    const adminSupabase = createAdminClient()

    // 1. Fetch profiles
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, last_seen')
      .order('username', { ascending: true })

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // 2. Fetch devices
    const { data: devices, error: devicesError } = await adminSupabase
      .from('devices')
      .select('*')
      .order('last_seen', { ascending: false })

    if (devicesError) {
      return NextResponse.json({ error: devicesError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profiles,
      devices
    })
  } catch (err: any) {
    console.error('Fetch admin devices error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
