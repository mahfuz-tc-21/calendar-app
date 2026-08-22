'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

export interface DailyMood {
  id: string
  user_id: string
  mood_date: string // YYYY-MM-DD
  mood: 'great' | 'good' | 'okay' | 'bad' | 'difficult'
  note: string | null
  created_at: string
  updated_at: string
}

export function useMood() {
  const [moods, setMoods] = useState<DailyMood[]>([])
  const [loading, setLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const supabaseRef = useRef<any>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }
  const supabase = supabaseRef.current
  const { user } = useAuth()
  const { showToast } = useToast()

  // Sync network state
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
      }
    }
    setupNetwork()
    return () => {
      isMounted = false
      if (networkListener) networkListener.remove()
    }
  }, [])

  const fetchMoods = useCallback(async (year: number, month: number) => {
    if (!user) return
    setLoading(true)

    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)
    const startStr = startOfMonth.toISOString().split('T')[0]
    const endStr = endOfMonth.toISOString().split('T')[0]

    // 1. Fetch from cache first
    try {
      const cached = localStorage.getItem('daily_moods_' + user.id)
      if (cached) {
        const parsed: DailyMood[] = JSON.parse(cached)
        const monthMoods = parsed.filter(m => m.mood_date >= startStr && m.mood_date <= endStr)
        setMoods(monthMoods)
      }
    } catch (e) {
      console.error('Error reading mood cache:', e)
    }

    if (isOffline) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('daily_moods')
        .select('*')
        .eq('user_id', user.id)
        .gte('mood_date', startStr)
        .lte('mood_date', endStr)

      if (error) {
        showToast(error.message, 'error')
      } else {
        const fetchedMoods = (data || []) as DailyMood[]
        setMoods(fetchedMoods)

        // Merge to cache
        try {
          const cached = localStorage.getItem('daily_moods_' + user.id)
          let cachedMoods: DailyMood[] = cached ? JSON.parse(cached) : []
          cachedMoods = cachedMoods.filter(m => m.mood_date < startStr || m.mood_date > endStr)
          cachedMoods.push(...fetchedMoods)
          localStorage.setItem('daily_moods_' + user.id, JSON.stringify(cachedMoods))
        } catch (e) {
          console.error('Error saving mood cache:', e)
        }
      }
    } catch (err) {
      console.error('Error fetching moods:', err)
    } finally {
      setLoading(false)
    }
  }, [user, supabase, isOffline, showToast])

  const saveMood = useCallback(async (mood_date: string, mood: DailyMood['mood'], note: string | null) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('daily_moods')
        .upsert({
          user_id: user.id,
          mood_date,
          mood,
          note,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,mood_date' })
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      const updatedMood = data as DailyMood
      setMoods(prev => {
        const filtered = prev.filter(m => m.mood_date !== mood_date)
        return [...filtered, updatedMood]
      })

      // Update cache
      try {
        const cached = localStorage.getItem('daily_moods_' + user.id)
        let cachedMoods: DailyMood[] = cached ? JSON.parse(cached) : []
        cachedMoods = cachedMoods.filter(m => m.mood_date !== mood_date)
        cachedMoods.push(updatedMood)
        localStorage.setItem('daily_moods_' + user.id, JSON.stringify(cachedMoods))
      } catch (e) {
        console.error('Error updating mood cache:', e)
      }

      showToast('Mood logged successfully', 'success')
      return updatedMood
    } catch (err) {
      console.error('Error saving mood:', err)
      showToast('Failed to save mood', 'error')
      return null
    }
  }, [user, supabase, showToast])

  const deleteMood = useCallback(async (mood_date: string) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('daily_moods')
        .delete()
        .eq('user_id', user.id)
        .eq('mood_date', mood_date)

      if (error) {
        showToast(error.message, 'error')
        return false
      }

      setMoods(prev => prev.filter(m => m.mood_date !== mood_date))

      // Update cache
      try {
        const cached = localStorage.getItem('daily_moods_' + user.id)
        if (cached) {
          let cachedMoods: DailyMood[] = JSON.parse(cached)
          cachedMoods = cachedMoods.filter(m => m.mood_date !== mood_date)
          localStorage.setItem('daily_moods_' + user.id, JSON.stringify(cachedMoods))
        }
      } catch (e) {
        console.error('Error deleting mood cache:', e)
      }

      showToast('Mood deleted successfully', 'success')
      return true
    } catch (err) {
      console.error('Error deleting mood:', err)
      showToast('Failed to delete mood', 'error')
      return false
    }
  }, [user, supabase, showToast])

  return {
    moods,
    loading,
    isOffline,
    fetchMoods,
    saveMood,
    deleteMood
  }
}
