import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Wrap auth.getUser() in a try-catch so it doesn't crash when running with fallback/unconfigured credentials
  let user = null
  let isNetworkError = false
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('fetch') || error.status === 0 || error.status === 502 || error.status === 504) {
        isNetworkError = true
      }
    }
  } catch (err: any) {
    console.warn('Supabase Auth error (probably unconfigured credentials):', err)
    const msg = err?.message?.toLowerCase() || ''
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
      isNetworkError = true
    }
  }

  const { pathname } = request.nextUrl

  // Auth pages (login, signup)
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  
  // Protected pages (calendar, private chat)
  const isProtectedPage = pathname.startsWith('/calendar') || pathname.startsWith('/private')

  if (!user && isProtectedPage) {
    const cookies = request.cookies.getAll()
    const hasAuthCookie = cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    if (hasAuthCookie && isNetworkError) {
      // Let it slide to allow offline mode operation of cached files
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/calendar'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
