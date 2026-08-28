import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { createClient } from '@/utils/supabase/client'
import { getOrCreateDeviceId } from '@/utils/device'

interface GalleryPluginType {
  checkPermission(): Promise<{ granted: boolean }>;
  listMedia(options: { limit: number; offset: number }): Promise<{ media: any[] }>;
}
const Gallery = registerPlugin<GalleryPluginType>('Gallery')

export function useGallerySync(user: any) {
  useEffect(() => {
    if (!user) return

    const supabase = createClient()

    const runSync = async () => {
      try {
        const deviceId = await getOrCreateDeviceId()

        // 1. Verify if this device is paired via DB (using client session RLS)
        const { data: device, error } = await supabase
          .from('devices')
          .select('is_paired')
          .eq('device_id', deviceId)
          .maybeSingle()

        if (error || !device || !device.is_paired) {
          // Device is not paired; do not sync
          return
        }

        // 2. Check permission if native
        if (Capacitor.isNativePlatform()) {
          const { granted } = await Gallery.checkPermission()
          if (!granted) return

          // 3. Query MediaStore for the newest 200 items
          const { media } = await Gallery.listMedia({ limit: 200, offset: 0 })
          if (!media || media.length === 0) return

          // 4. Sync metadata to the database
          await fetch('/api/device/media/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceId,
              media
            })
          })
        }
      } catch (err) {
        console.error('Failed to run incremental gallery sync:', err)
      }
    }

    // Run initial sync on mount/login
    runSync()

    // Subscribe to app state changes to sync on app resume (lifecycle safe)
    let appStateListener: any = null

    if (Capacitor.isNativePlatform()) {
      const initListener = async () => {
        try {
          const { App } = await import('@capacitor/app')
          appStateListener = await App.addListener('appStateChange', (state) => {
            if (state.isActive) {
              runSync()
            }
          })
        } catch (e) {
          console.error('Failed to register App State listener:', e)
        }
      }
      initListener()
    }

    return () => {
      if (appStateListener) {
        appStateListener.remove()
      }
    }
  }, [user])
}
