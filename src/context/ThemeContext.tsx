'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export type ThemeType = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeType
  setTheme: (theme: ThemeType) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Lazily import native-only modules to avoid web errors
async function getNativeTheme() {
  if (!Capacitor.isNativePlatform()) return null
  const { registerPlugin } = await import('@capacitor/core')
  return registerPlugin<{
    setStatusBarTheme(options: { theme: 'light' | 'dark' }): Promise<void>
    setNavigationBarTheme(options: { theme: 'light' | 'dark' }): Promise<void>
  }>('AutoUpdate')
}

async function applyNativeBarTheme(activeTheme: 'light' | 'dark') {
  if (!Capacitor.isNativePlatform()) return
  try {
    const plugin = await getNativeTheme()
    if (!plugin) return
    await Promise.all([
      plugin.setStatusBarTheme({ theme: activeTheme }),
      plugin.setNavigationBarTheme({ theme: activeTheme }),
    ])
  } catch (e) {
    // Silently skip if plugin not available (e.g. web preview)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('system')

  // Load the initial theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // localStorage works on both web and Android WebView
        const stored = localStorage.getItem('theme')
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeState(stored)
          return
        }

        // Fallback: read from Capacitor Preferences on native
        if (Capacitor.isNativePlatform()) {
          const { Preferences } = await import('@capacitor/preferences')
          const { value } = await Preferences.get({ key: 'theme' })
          if (value === 'light' || value === 'dark' || value === 'system') {
            setThemeState(value)
          }
        }
      } catch (e) {
        console.error('Failed to load theme preference', e)
      }
    }
    loadTheme()
  }, [])

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme)
    try {
      // Always persist to localStorage (works everywhere)
      localStorage.setItem('theme', newTheme)

      // Also persist to Capacitor Preferences on native for cross-session reliability
      if (Capacitor.isNativePlatform()) {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.set({ key: 'theme', value: newTheme })
      }
    } catch (e) {
      console.error('Failed to save theme preference', e)
    }
    applyTheme(newTheme)
  }

  const applyTheme = (t: ThemeType) => {
    const activeTheme: 'light' | 'dark' =
      t === 'dark'
        ? 'dark'
        : t === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

    // Toggle document class (works in both browser and WebView)
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Native bars: only on Android, fire-and-forget
    applyNativeBarTheme(activeTheme)
  }

  useEffect(() => {
    applyTheme(theme)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
