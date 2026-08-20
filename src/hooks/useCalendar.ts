'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string
  event_date: string // YYYY-MM-DD
  start_time: string | null // HH:MM
  end_time: string | null // HH:MM
  created_at: string
  updated_at: string
}

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  
  const supabaseRef = useRef<any>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }
  const supabase = supabaseRef.current
  const { user } = useAuth()
  const { showToast } = useToast()

  // Listen to network status changes to keep isOffline in sync
  useEffect(() => {
    let networkListener: any = null
    let isMounted = true
    const setupNetwork = async () => {
      try {
        const { Network } = require('@capacitor/network')
        const status = await Network.getStatus()
        if (isMounted) setIsOffline(!status.connected)
        networkListener = await Network.addListener('networkStatusChange', (status: any) => {
          if (isMounted) setIsOffline(!status.connected)
        })
      } catch (e) {
        if (isMounted) setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
        const handleOnline = () => { if (isMounted) setIsOffline(false) }
        const handleOffline = () => { if (isMounted) setIsOffline(true) }
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
        }
      }
    }
    setupNetwork()
    return () => {
      isMounted = false
      if (networkListener) {
        networkListener.remove()
      }
    }
  }, [])

  const fetchEvents = useCallback(async (year: number, month: number) => {
    if (!user) return
    setLoading(true)

    // Calculate month boundaries safely
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)
    
    const startStr = startOfMonth.toISOString().split('T')[0]
    const endStr = endOfMonth.toISOString().split('T')[0]

    // 1. Instantly load from local cache first
    try {
      const cachedData = localStorage.getItem('calendar_events_' + user.id)
      if (cachedData) {
        const cachedEvents: CalendarEvent[] = JSON.parse(cachedData)
        const monthEvents = cachedEvents.filter(
          (e) => e.event_date >= startStr && e.event_date <= endStr
        )
        setEvents(monthEvents)
      }
    } catch (e) {
      console.error('Error reading local calendar cache:', e)
    }

    // 2. Check network connectivity
    let isConnected = true
    try {
      const { Network } = require('@capacitor/network')
      const status = await Network.getStatus()
      isConnected = status.connected
    } catch {
      isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true
    }

    setIsOffline(!isConnected)

    if (!isConnected) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', startStr)
        .lte('event_date', endStr)
        .order('start_time', { ascending: true })

      if (error) {
        showToast(error.message, 'error')
      } else {
        setEvents(data || [])
        // Merge into cache
        try {
          const cachedData = localStorage.getItem('calendar_events_' + user.id)
          let cachedEvents: CalendarEvent[] = cachedData ? JSON.parse(cachedData) : []
          // Filter out existing cached events in this month range
          cachedEvents = cachedEvents.filter(
            (e) => e.event_date < startStr || e.event_date > endStr
          )
          // Add fresh events
          if (data) {
            cachedEvents.push(...data)
          }
          localStorage.setItem('calendar_events_' + user.id, JSON.stringify(cachedEvents))
        } catch (e) {
          console.error('Error saving calendar cache:', e)
        }
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err)
      showToast('Failed to fetch events', 'error')
    } finally {
      setLoading(false)
    }
  }, [user, supabase, showToast])

  const createEvent = useCallback(async (eventData: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          ...eventData,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      showToast('Event created successfully', 'success')
      setEvents((prev) => {
        const updated = [...prev, data]
        return updated.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      })

      // Update cache
      try {
        const cachedData = localStorage.getItem('calendar_events_' + user.id)
        let cachedEvents: CalendarEvent[] = cachedData ? JSON.parse(cachedData) : []
        cachedEvents.push(data)
        localStorage.setItem('calendar_events_' + user.id, JSON.stringify(cachedEvents))
      } catch (e) {
        console.error('Error updating cache on createEvent:', e)
      }

      return data
    } catch (err) {
      console.error('Error creating event:', err)
      showToast('Failed to create event', 'error')
      return null
    }
  }, [user, supabase, showToast])

  const updateEvent = useCallback(async (id: string, eventData: Partial<Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return null
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(eventData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      showToast('Event updated successfully', 'success')
      setEvents((prev) => {
        const updated = prev.map((e) => (e.id === id ? data : e))
        return updated.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      })

      // Update cache
      try {
        const cachedData = localStorage.getItem('calendar_events_' + user.id)
        if (cachedData) {
          let cachedEvents: CalendarEvent[] = JSON.parse(cachedData)
          cachedEvents = cachedEvents.map((e) => (e.id === id ? data : e))
          localStorage.setItem('calendar_events_' + user.id, JSON.stringify(cachedEvents))
        }
      } catch (e) {
        console.error('Error updating cache on updateEvent:', e)
      }

      return data
    } catch (err) {
      console.error('Error updating event:', err)
      showToast('Failed to update event', 'error')
      return null
    }
  }, [user, supabase, showToast])

  const deleteEvent = useCallback(async (id: string) => {
    if (!user) return false
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        showToast(error.message, 'error')
        return false
      }

      showToast('Event deleted successfully', 'success')
      setEvents((prev) => prev.filter((e) => e.id !== id))

      // Update cache
      try {
        const cachedData = localStorage.getItem('calendar_events_' + user.id)
        if (cachedData) {
          let cachedEvents: CalendarEvent[] = JSON.parse(cachedData)
          cachedEvents = cachedEvents.filter((e) => e.id !== id)
          localStorage.setItem('calendar_events_' + user.id, JSON.stringify(cachedEvents))
        }
      } catch (e) {
        console.error('Error updating cache on deleteEvent:', e)
      }

      return true
    } catch (err) {
      console.error('Error deleting event:', err)
      showToast('Failed to delete event', 'error')
      return false
    }
  }, [user, supabase, showToast])

  return {
    events,
    loading,
    isOffline,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  }
}
