import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://github.com/mahfuz-tc-21/calendar-app/releases/latest/download/latest.json', {
      cache: 'no-store'
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: `GitHub returned status ${res.status}` }, { status: res.status })
    }
    
    const data = await res.json()
    
    // Return with CORS headers to allow Android WebView access
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
