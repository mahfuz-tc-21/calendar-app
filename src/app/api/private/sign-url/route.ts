import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    // Parse conversation ID from the storage path (format: conversation_id/filename)
    const conversationId = path.split('/')[0]
    if (!conversationId) {
      return NextResponse.json({ error: 'Invalid path structure' }, { status: 400 })
    }

    // Verify database membership level before signing
    const { data: membership, error: memberErr } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberErr || !membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this chat' }, { status: 403 })
    }

    // Generate signed URL (expires in 5 minutes)
    const { data, error: signErr } = await supabase
      .storage
      .from('chat_images')
      .createSignedUrl(path, 300)

    if (signErr || !data) {
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    console.error('Error signing storage URL:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
