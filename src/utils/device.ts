import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// Register the AutoUpdate plugin locally if needed to get app version
interface AppInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
}
interface AutoUpdatePluginType {
  getAppInfo(): Promise<AppInfo>;
}
const AutoUpdate = registerPlugin<AutoUpdatePluginType>('AutoUpdate')

function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }
  // Fallback UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server-side-placeholder'
  
  try {
    const { value } = await Preferences.get({ key: 'secure_device_id' })
    if (value) {
      return value
    }
    
    const newId = generateUUID()
    await Preferences.set({ key: 'secure_device_id', value: newId })
    return newId
  } catch (err) {
    console.error('Failed to get or create device id:', err)
    return 'fallback-device-id'
  }
}

export interface DeviceMetadata {
  deviceId: string
  deviceName: string
  deviceModel: string
  platform: string
  osVersion: string
  appVersion: string
}

export async function getDeviceMetadata(): Promise<DeviceMetadata> {
  const deviceId = await getOrCreateDeviceId()
  const platform = Capacitor.getPlatform()
  
  let deviceModel = 'Web Browser'
  let osVersion = 'Unknown OS'
  let deviceName = 'Web Client'
  
  if (typeof window !== 'undefined') {
    const ua = window.navigator.userAgent
    
    if (platform === 'android') {
      deviceName = 'Android Device'
      deviceModel = 'Android'
      // Parse User-Agent for model and Android version
      // Example: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ... Chrome/... Mobile ..."
      // or "Mozilla/5.0 (Linux; Android 13; SM-A546B Build/...)"
      const androidMatch = ua.match(/Android\s+([0-9\.]+)/)
      if (androidMatch) {
        osVersion = `Android ${androidMatch[1]}`
      } else {
        osVersion = 'Android OS'
      }
      
      const modelMatch = ua.match(/;\s+([^;]+)\s+Build\//)
      if (modelMatch) {
        deviceModel = modelMatch[1].trim()
        deviceName = deviceModel
      } else {
        // Fallback search inside parentheses
        const parenMatch = ua.match(/\(([^)]+)\)/)
        if (parenMatch) {
          const parts = parenMatch[1].split(';')
          if (parts.length >= 3) {
            deviceModel = parts[2].trim()
            deviceName = deviceModel
          }
        }
      }
    } else {
      // Parse Web browser details
      deviceName = 'Web Browser'
      const matches = ua.match(/(Firefox|Chrome|Safari|Edge|OPR)\/([0-9\.]+)/)
      if (matches) {
        deviceModel = `${matches[1]} Browser`
        osVersion = navigator.platform || 'Web Platform'
      }
    }
  }
  
  let appVersion = '1.0.13' // Default fallback matching package.json
  if (platform !== 'web') {
    try {
      const info = await AutoUpdate.getAppInfo()
      if (info && info.versionName) {
        appVersion = info.versionName
      }
    } catch (e) {
      console.warn('Failed to get app version from AutoUpdate plugin:', e)
    }
  }
  
  return {
    deviceId,
    deviceName,
    deviceModel,
    platform,
    osVersion,
    appVersion
  }
}
