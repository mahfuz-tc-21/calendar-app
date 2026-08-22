'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/context/ToastContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface AuthFormProps {
  mode: 'login' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      showToast('Please fill in all fields', 'error')
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'signup') {
        if (!username) {
          showToast('Username is required for signup', 'error')
          setIsLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: username.toLowerCase().trim(),
              display_name: displayName.trim() || username.trim(),
            },
          },
        })

        if (error) {
          showToast(error.message, 'error')
        } else {
          showToast('Signup successful! Welcome to Calendar.', 'success')
          router.push('/calendar')
          router.refresh()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          showToast(error.message, 'error')
        } else {
          showToast('Welcome back!', 'success')
          router.push('/calendar')
          router.refresh()
        }
      }
    } catch (err: any) {
      showToast('An unexpected error occurred', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-sm">
      <div className="flex flex-col gap-2 text-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'login' 
            ? 'Enter your credentials to access your calendar' 
            : 'Get started with your private and secure calendar'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {mode === 'signup' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="e.g. john_doe"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="displayName">
                Display Name (Optional)
              </label>
              <input
                id="displayName"
                type="text"
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-3 pr-10 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 text-primary-foreground font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <p>
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-semibold">
              Sign Up
            </Link>
          </p>
        ) : (
          <p>
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
