import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const client = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
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
    }
  )

  try {
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    const refreshToken = headersList.get('x-refresh-token')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
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
    // Fail silently or log error if headers are not available in this context
    console.error('Error setting session from Authorization header:', err)
  }

  return client
}
