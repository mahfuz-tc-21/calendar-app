import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('private_space_token')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error during locking private space:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
