import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { deviceId, deviceName, deviceModel, platform, osVersion, appVersion } = body

    if (!deviceId || !deviceName || !deviceModel || !platform || !osVersion || !appVersion) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Upsert the device details under the current user.
    // RLS will ensure that the user can only insert/update records where user_id = auth.uid().
    const { data, error } = await supabase
      .from('devices')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          device_name: deviceName,
          device_model: deviceModel,
          platform: platform,
          os_version: osVersion,
          app_version: appVersion,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'device_id' }
      )
      .select()

    if (error) {
      console.error('Device registration DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, device: data?.[0] }, { status: 200 })
  } catch (err: any) {
    console.error('Device registration API catch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
