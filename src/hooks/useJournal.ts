'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'

export interface JournalEntry {
  id: string
  user_id: string
  entry_date: string // YYYY-MM-DD
  title: string | null
  content: string // stored encrypted locally, plain text in memory
  mood: string | null
  created_at: string
  updated_at: string
}

function encryptText(text: string, key: string): string {
  if (!key) return text
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    result += String.fromCharCode(charCode)
  }
  try {
    return btoa(unescape(encodeURIComponent(result)))
  } catch {
    return btoa(result)
  }
}

function decryptText(encoded: string, key: string): string {
  if (!key) return encoded
  try {
    let text = ''
    try {
      text = decodeURIComponent(escape(atob(encoded)))
    } catch {
      text = atob(encoded)
    }
    let result = ''
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      result += String.fromCharCode(charCode)
    }
    return result
  } catch (e) {
    return encoded
  }
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const supabaseRef = useRef<any>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }
  const supabase = supabaseRef.current
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isUnlocked } = usePrivateSpace()

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

  const getSecretKey = useCallback((): string => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('local_privacy_hash') || ''
  }, [])

  const fetchEntries = useCallback(async () => {
    if (!user || !isUnlocked) return
    setLoading(true)

    const key = getSecretKey()

    // 1. Fetch from cache first
    try {
      const cached = localStorage.getItem('private_journals_' + user.id)
      if (cached) {
        const parsed: JournalEntry[] = JSON.parse(cached)
        const decrypted = parsed.map(e => ({
          ...e,
          content: decryptText(e.content, key)
        }))
        setEntries(decrypted.sort((a, b) => b.entry_date.localeCompare(a.entry_date)))
      }
    } catch (e) {
      console.error('Error reading journal cache:', e)
    }

    if (isOffline) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('private_journals')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })

      if (error) {
        showToast(error.message, 'error')
      } else {
        const fetched = (data || []) as JournalEntry[]
        setEntries(fetched)

        // Encrypt content for local storage cache
        try {
          const encryptedCache = fetched.map(e => ({
            ...e,
            content: encryptText(e.content, key)
          }))
          localStorage.setItem('private_journals_' + user.id, JSON.stringify(encryptedCache))
        } catch (e) {
          console.error('Error saving journal cache:', e)
        }
      }
    } catch (err) {
      console.error('Error fetching journal entries:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isUnlocked, supabase, isOffline, showToast, getSecretKey])

  const createEntry = useCallback(async (entryData: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user || !isUnlocked) return null
    const key = getSecretKey()

    try {
      const { data, error } = await supabase
        .from('private_journals')
        .insert({
          ...entryData,
          user_id: user.id
        })
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      const newEntry = data as JournalEntry
      setEntries(prev => [newEntry, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)))

      // Encrypt and save to cache
      try {
        const cached = localStorage.getItem('private_journals_' + user.id)
        const cachedEntries: JournalEntry[] = cached ? JSON.parse(cached) : []
        const cachedItem = { ...newEntry, content: encryptText(newEntry.content, key) }
        cachedEntries.push(cachedItem)
        localStorage.setItem('private_journals_' + user.id, JSON.stringify(cachedEntries))
      } catch (e) {
        console.error('Error updating journal cache:', e)
      }

      showToast('Journal entry saved', 'success')
      return newEntry
    } catch (err) {
      console.error('Error creating journal entry:', err)
      showToast('Failed to save entry', 'error')
      return null
    }
  }, [user, isUnlocked, supabase, showToast, getSecretKey])

  const updateEntry = useCallback(async (id: string, entryData: Partial<Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user || !isUnlocked) return null
    const key = getSecretKey()

    try {
      const { data, error } = await supabase
        .from('private_journals')
        .update(entryData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        showToast(error.message, 'error')
        return null
      }

      const updated = data as JournalEntry
      setEntries(prev => prev.map(e => e.id === id ? updated : e).sort((a, b) => b.entry_date.localeCompare(a.entry_date)))

      // Encrypt and update cache
      try {
        const cached = localStorage.getItem('private_journals_' + user.id)
        if (cached) {
          let cachedEntries: JournalEntry[] = JSON.parse(cached)
          const cachedUpdated = { ...updated, content: encryptText(updated.content, key) }
          cachedEntries = cachedEntries.map(e => e.id === id ? cachedUpdated : e)
          localStorage.setItem('private_journals_' + user.id, JSON.stringify(cachedEntries))
        }
      } catch (e) {
        console.error('Error updating journal cache:', e)
      }

      return updated
    } catch (err) {
      console.error('Error updating journal entry:', err)
      showToast('Failed to update entry', 'error')
      return null
    }
  }, [user, isUnlocked, supabase, showToast, getSecretKey])

  const deleteEntry = useCallback(async (id: string) => {
    if (!user || !isUnlocked) return false

    try {
      const { error } = await supabase
        .from('private_journals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        showToast(error.message, 'error')
        return false
      }

      setEntries(prev => prev.filter(e => e.id !== id))

      // Delete from cache
      try {
        const cached = localStorage.getItem('private_journals_' + user.id)
        if (cached) {
          let cachedEntries: JournalEntry[] = JSON.parse(cached)
          cachedEntries = cachedEntries.filter(e => e.id !== id)
          localStorage.setItem('private_journals_' + user.id, JSON.stringify(cachedEntries))
        }
      } catch (e) {
        console.error('Error deleting journal cache:', e)
      }

      showToast('Entry deleted', 'success')
      return true
    } catch (err) {
      console.error('Error deleting journal entry:', err)
      showToast('Failed to delete entry', 'error')
      return false
    }
  }, [user, isUnlocked, supabase, showToast])

  return {
    entries,
    loading,
    isOffline,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry
  }
}
