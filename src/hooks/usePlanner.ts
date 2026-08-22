'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

export interface PlannerTask {
  id: string
  user_id: string
  title: string
  description: string
  task_date: string // YYYY-MM-DD
  task_time: string | null // HH:MM
  completed: boolean
  reorder_index: number
  reminder_offset?: string
  reminder_custom_time?: string | null
  reminder_repeat?: string
  created_at: string
  updated_at: string
}

export function usePlanner() {
  const [tasks, setTasks] = useState<PlannerTask[]>([])
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

  const fetchTasks = useCallback(async (year: number, month: number) => {
    if (!user) return
    setLoading(true)

    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)
    const startStr = startOfMonth.toISOString().split('T')[0]
    const endStr = endOfMonth.toISOString().split('T')[0]

    // 1. Fetch from cache first
    try {
      const cached = localStorage.getItem('planner_tasks_' + user.id)
      if (cached) {
        const parsed: PlannerTask[] = JSON.parse(cached)
        const monthTasks = parsed.filter(t => t.task_date >= startStr && t.task_date <= endStr)
        setTasks(monthTasks.sort((a, b) => a.reorder_index - b.reorder_index))
      }
    } catch (e) {
      console.error('Error reading planner cache:', e)
    }

    if (isOffline) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('planner_tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('task_date', startStr)
        .lte('task_date', endStr)
        .order('reorder_index', { ascending: true })

      if (error) {
        showToast(error.message, 'error')
      } else {
        const fetchedTasks = (data || []) as PlannerTask[]
        setTasks(fetchedTasks)
        
        // Merge to cache
        try {
          const cached = localStorage.getItem('planner_tasks_' + user.id)
          let cachedTasks: PlannerTask[] = cached ? JSON.parse(cached) : []
          cachedTasks = cachedTasks.filter(t => t.task_date < startStr || t.task_date > endStr)
          cachedTasks.push(...fetchedTasks)
          localStorage.setItem('planner_tasks_' + user.id, JSON.stringify(cachedTasks))
        } catch (e) {
          console.error('Error saving planner cache:', e)
        }
      }
    } catch (err) {
      console.error('Error fetching planner tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [user, supabase, isOffline, showToast])

  const createTask = useCallback(async (taskData: Omit<PlannerTask, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed' | 'reorder_index'>) => {
    if (!user) return null

    // Determine reorder index
    const maxIndex = tasks.reduce((max, t) => t.reorder_index > max ? t.reorder_index : max, -1)
    const reorder_index = maxIndex + 1

    try {
      const { data, error } = await supabase
        .from('planner_tasks')
        .insert({
          ...taskData,
          user_id: user.id,
          completed: false,
          reorder_index
        })
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      const newTask = data as PlannerTask
      setTasks(prev => [...prev, newTask].sort((a, b) => a.reorder_index - b.reorder_index))

      // Update cache
      try {
        const cached = localStorage.getItem('planner_tasks_' + user.id)
        const cachedTasks: PlannerTask[] = cached ? JSON.parse(cached) : []
        cachedTasks.push(newTask)
        localStorage.setItem('planner_tasks_' + user.id, JSON.stringify(cachedTasks))
      } catch (e) {
        console.error('Error updating cache on createTask:', e)
      }

      showToast('Task added successfully', 'success')
      return newTask
    } catch (err) {
      console.error('Error creating task:', err)
      showToast('Failed to create task', 'error')
      return null
    }
  }, [user, supabase, tasks, showToast])

  const updateTask = useCallback(async (id: string, taskData: Partial<Omit<PlannerTask, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('planner_tasks')
        .update(taskData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      const updated = data as PlannerTask
      setTasks(prev => prev.map(t => t.id === id ? updated : t).sort((a, b) => a.reorder_index - b.reorder_index))

      // Update cache
      try {
        const cached = localStorage.getItem('planner_tasks_' + user.id)
        if (cached) {
          let cachedTasks: PlannerTask[] = JSON.parse(cached)
          cachedTasks = cachedTasks.map(t => t.id === id ? updated : t)
          localStorage.setItem('planner_tasks_' + user.id, JSON.stringify(cachedTasks))
        }
      } catch (e) {
        console.error('Error updating cache on updateTask:', e)
      }

      return updated
    } catch (err) {
      console.error('Error updating task:', err)
      showToast('Failed to update task', 'error')
      return null
    }
  }, [user, supabase, showToast])

  const deleteTask = useCallback(async (id: string) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('planner_tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        showToast(error.message, 'error')
        return false
      }

      setTasks(prev => prev.filter(t => t.id !== id))

      // Update cache
      try {
        const cached = localStorage.getItem('planner_tasks_' + user.id)
        if (cached) {
          let cachedTasks: PlannerTask[] = JSON.parse(cached)
          cachedTasks = cachedTasks.filter(t => t.id !== id)
          localStorage.setItem('planner_tasks_' + user.id, JSON.stringify(cachedTasks))
        }
      } catch (e) {
        console.error('Error deleting cache on deleteTask:', e)
      }

      showToast('Task deleted successfully', 'success')
      return true
    } catch (err) {
      console.error('Error deleting task:', err)
      showToast('Failed to delete task', 'error')
      return false
    }
  }, [user, supabase, showToast])

  const reorderTasks = useCallback(async (reorderedList: PlannerTask[]) => {
    if (!user) return

    // Optimistically set UI
    setTasks(reorderedList)

    // Save to cache
    try {
      const cached = localStorage.getItem('planner_tasks_' + user.id)
      if (cached) {
        let cachedTasks: PlannerTask[] = JSON.parse(cached)
        // Remove old tasks in this monthly set
        const idsToUpdate = new Set(reorderedList.map(t => t.id))
        cachedTasks = cachedTasks.filter(t => !idsToUpdate.has(t.id))
        cachedTasks.push(...reorderedList)
        localStorage.setItem('planner_tasks_' + user.id, JSON.stringify(cachedTasks))
      }
    } catch (e) {
      console.error('Error saving reorder index to cache:', e)
    }

    if (isOffline) return

    // Update in Supabase in parallel
    try {
      await Promise.all(
        reorderedList.map((task, idx) => 
          supabase
            .from('planner_tasks')
            .update({ reorder_index: idx })
            .eq('id', task.id)
        )
      )
    } catch (err) {
      console.error('Error syncing reorder index to Supabase:', err)
    }
  }, [user, supabase, isOffline])

  return {
    tasks,
    loading,
    isOffline,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks
  }
}
