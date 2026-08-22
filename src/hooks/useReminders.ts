'use client'

import { useCallback } from 'react'

export interface ReminderConfig {
  id: string // UUID of parent event/task
  title: string
  body: string
  triggerAt: Date
  repeat?: 'daily' | 'weekly' | 'monthly' | null
}

function hashStringToInt(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export function useReminders() {
  const scheduleReminder = useCallback(async (config: ReminderConfig) => {
    try {
      const { LocalNotifications } = require('@capacitor/local-notifications')
      
      // Request permission if not already granted
      const checkPerms = await LocalNotifications.checkPermissions()
      if (checkPerms.display !== 'granted') {
        const requestPerms = await LocalNotifications.requestPermissions()
        if (requestPerms.display !== 'granted') {
          console.warn('Local Notification permissions rejected.')
          return false
        }
      }

      const notificationId = hashStringToInt(config.id)

      // First cancel existing to prevent duplicates
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }]
      })

      // Configure trigger
      const scheduleOptions: any = {
        at: config.triggerAt
      }

      if (config.repeat) {
        if (config.repeat === 'daily') {
          scheduleOptions.every = 'day'
        } else if (config.repeat === 'weekly') {
          scheduleOptions.every = 'week'
        } else if (config.repeat === 'monthly') {
          scheduleOptions.every = 'month'
        }
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: config.title,
            body: config.body,
            schedule: scheduleOptions,
            sound: 'default',
            actionTypeId: '',
            extra: null
          }
        ]
      })

      return true
    } catch (err) {
      console.error('Failed to schedule local notification:', err)
      return false
    }
  }, [])

  const cancelReminder = useCallback(async (id: string) => {
    try {
      const { LocalNotifications } = require('@capacitor/local-notifications')
      const notificationId = hashStringToInt(id)
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }]
      })
      return true
    } catch (err) {
      console.error('Failed to cancel local notification:', err)
      return false
    }
  }, [])

  return {
    scheduleReminder,
    cancelReminder
  }
}
