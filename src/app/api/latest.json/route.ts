import { NextResponse } from 'next/server'

// Shared no-cache + CORS headers — identical to /api/update
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Legacy backward-compat endpoint for old APK versions (v1.0.5 and earlier).
 * Those builds were compiled with the fallback URL:
 *   NEXT_PUBLIC_HOSTED_URL + "/latest.json"
 * Vercel rewrites /latest.json -> /api/latest.json (see next.config.ts).
 * This route returns the exact same payload as /api/update.
 */
export async function GET() {
  try {
    const res = await fetch(
      'https://github.com/mahfuz-tc-21/calendar-app/releases/latest/download/latest.json',
      { cache: 'no-store', next: { revalidate: 0 } }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub returned status ${res.status}` },
        { status: res.status, headers: NO_CACHE_HEADERS }
      )
    }

    const data = await res.json()

    return NextResponse.json(data, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
