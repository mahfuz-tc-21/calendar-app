import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  let cookieStore: any = null
  let headersList: any = null
  try {
    const [c, h] = await Promise.all([cookies(), headers()])
    cookieStore = c
    headersList = h
  } catch {
    // Graceful fallback if called outside request context
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const authHeader = headersList ? (headersList.get('authorization') || '') : ''

  const client = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : []
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if we have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
    }
  )

  if (headersList) {
    try {
      const authHeaderVal = headersList.get('authorization')
      const refreshToken = headersList.get('x-refresh-token')
      if (authHeaderVal && authHeaderVal.startsWith('Bearer ')) {
        const token = authHeaderVal.substring(7)
        if (token && refreshToken) {
          await client.auth.setSession({ access_token: token, refresh_token: refreshToken })
        } else if (token) {
          // Fallback: Intercept getUser to verify the JWT if refresh token is missing
          const originalGetUser = client.auth.getUser.bind(client.auth)
          client.auth.getUser = async (jwt?: string) => {
            return originalGetUser(jwt || token)
          }
        }
      }
    } catch (err) {
      console.error('Error setting session from Authorization header:', err)
    }
  }

  return client
}

// Admin client that bypasses RLS — only use in trusted server-side API routes
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false }
  })
}
