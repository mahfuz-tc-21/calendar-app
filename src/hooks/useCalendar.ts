'use client'

import { useState, useCallback } from 'react'
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
  const supabase = createClient()
  const { user } = useAuth()
  const { showToast } = useToast()

  const fetchEvents = useCallback(async (year: number, month: number) => {
    if (!user) return
    setLoading(true)

    try {
      // Calculate month boundaries safely
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)
      
      const startStr = startOfMonth.toISOString().split('T')[0]
      const endStr = endOfMonth.toISOString().split('T')[0]

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
        // Keep sorting by start_time
        const updated = [...prev, data]
        return updated.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      })
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
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  }
}
