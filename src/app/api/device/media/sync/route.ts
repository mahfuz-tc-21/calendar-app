import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { deviceId, media } = body

    if (!deviceId || !Array.isArray(media)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Verify the device is registered and belongs to this user
    const { data: device, error: deviceError } = await adminSupabase
      .from('devices')
      .select('id')
      .eq('device_id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 })
    }

    // 2. Map and Upsert new or modified media metadata
    const upsertRows = media.map((item: any) => ({
      device_id: device.id,
      media_store_id: item.mediaStoreId,
      file_name: item.fileName,
      mime_type: item.mimeType,
      width: item.width,
      height: item.height,
      size: item.size,
      created_at: item.createdAt,
      modified_at: item.modifiedAt,
      media_type: item.mediaType || 'image',
      indexed_at: new Date().toISOString()
    }))

    if (upsertRows.length > 0) {
      const { error: upsertError } = await adminSupabase
        .from('media_metadata')
        .upsert(upsertRows, { onConflict: 'device_id,media_store_id' })

      if (upsertError) {
        console.error('Failed to upsert media metadata:', upsertError.message)
        return NextResponse.json({ error: 'Database upsert failed' }, { status: 500 })
      }
    }

    // 3. Reconcile deleted media
    // We check the database records that fall within the modification range of the synced batch.
    // If any database record in that range is missing from the batch, it has been deleted from the device.
    if (media.length > 0) {
      try {
        const times = media.map((m) => new Date(m.modifiedAt).getTime())
        const minTime = new Date(Math.min(...times)).toISOString()
        const maxTime = new Date(Math.max(...times)).toISOString()

        const { data: dbItems, error: fetchError } = await adminSupabase
          .from('media_metadata')
          .select('id, media_store_id')
          .eq('device_id', device.id)
          .gte('modified_at', minTime)
          .lte('modified_at', maxTime)

        if (!fetchError && dbItems && dbItems.length > 0) {
          const payloadIds = new Set(media.map((m) => m.mediaStoreId))
          const deleteIds = dbItems
            .filter((dbItem: any) => !payloadIds.has(dbItem.media_store_id))
            .map((dbItem: any) => dbItem.id)

          if (deleteIds.length > 0) {
            const { error: deleteError } = await adminSupabase
              .from('media_metadata')
              .delete()
              .in('id', deleteIds)
              
            if (deleteError) {
              console.error('Failed to purge stale media metadata:', deleteError.message)
            }
          }
        }
      } catch (reconcileErr) {
        console.error('Reconciliation parsing error:', reconcileErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Media metadata sync API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
