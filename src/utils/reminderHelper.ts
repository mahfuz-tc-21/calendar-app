import { ReminderConfig } from '@/hooks/useReminders'

export function calculateReminderDate(
  dateStr: string, // YYYY-MM-DD
  timeStr: string | null, // HH:MM
  offset: string, // 'none' | 'at' | '5m' | '15m' | '30m' | '1h' | '1d' | 'custom'
  customTimeStr: string | null // HH:MM
): Date | null {
  if (offset === 'none') return null

  // 1. Get base date-time
  let baseHour = 9
  let baseMin = 0
  if (timeStr) {
    const parts = timeStr.split(':')
    baseHour = parseInt(parts[0], 10)
    baseMin = parseInt(parts[1], 10)
  }

  const [yr, mo, dy] = dateStr.split('-').map(Number)
  // Construct local date safely
  const baseDate = new Date(yr, mo - 1, dy, baseHour, baseMin, 0)

  // 2. Adjust offset
  let triggerDate = new Date(baseDate.getTime())

  if (offset === '5m') {
    triggerDate.setMinutes(triggerDate.getMinutes() - 5)
  } else if (offset === '15m') {
    triggerDate.setMinutes(triggerDate.getMinutes() - 15)
  } else if (offset === '30m') {
    triggerDate.setMinutes(triggerDate.getMinutes() - 30)
  } else if (offset === '1h') {
    triggerDate.setHours(triggerDate.getHours() - 1)
  } else if (offset === '1d') {
    triggerDate.setDate(triggerDate.getDate() - 1)
  } else if (offset === 'custom' && customTimeStr) {
    const parts = customTimeStr.split(':')
    const customH = parseInt(parts[0], 10)
    const customM = parseInt(parts[1], 10)
    triggerDate = new Date(yr, mo - 1, dy, customH, customM, 0)
  }

  // If final trigger is in the past, return null
  if (triggerDate.getTime() <= Date.now()) {
    return null
  }

  return triggerDate
}
