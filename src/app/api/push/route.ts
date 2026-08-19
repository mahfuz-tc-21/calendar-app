import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Initialize Firebase Admin SDK securely using stringified credentials in env
if (getApps().length === 0) {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccountStr) {
    try {
      const serviceAccount = JSON.parse(serviceAccountStr)
      initializeApp({
        credential: cert(serviceAccount)
      })
      console.log('Firebase Admin initialized successfully in API Route.')
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT json:', e)
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not defined.')
  }
}

export async function POST(request: Request) {
  try {
    // 1. Verify Authorization webhook secret to secure the endpoint
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.CHAT_WEBHOOK_SECRET
    
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized webhook trigger request' }, { status: 401 })
    }

    const payload = await request.json()
    console.log('Push Webhook received payload:', JSON.stringify(payload))

    // We only process INSERT events in the messages table
    if (payload.type !== 'INSERT' || payload.table !== 'messages') {
      return NextResponse.json({ status: 'ignored', message: 'Not an insert event on messages table' })
    }

    const record = payload.record
    if (!record || !record.conversation_id || !record.sender_id) {
      return NextResponse.json({ error: 'Invalid payload record structure' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase service role keys are missing.')
      return NextResponse.json({ error: 'Supabase configuration keys missing in env' }, { status: 500 })
    }

    // Initialize Supabase admin client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 2. Fetch the other member (recipient) of this conversation
    const { data: members, error: memberErr } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', record.conversation_id)
      .neq('user_id', record.sender_id)

    if (memberErr) {
      console.error('Error fetching conversation members:', memberErr)
      return NextResponse.json({ error: memberErr.message }, { status: 500 })
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ status: 'no_recipient', message: 'No recipient found for this conversation' })
    }

    const recipientId = members[0].user_id

    // 3. Fetch recipient's push token
    const { data: recipientProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientId)
      .single()

    if (profileErr) {
      console.error('Error fetching recipient profile:', profileErr)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    const pushToken = recipientProfile?.push_token
    if (!pushToken) {
      return NextResponse.json({ status: 'no_token', message: 'Recipient does not have a registered push token' })
    }

    // 4. Send background push notification via FCM
    if (getApps().length === 0) {
      console.error('Firebase Admin SDK is not initialized.')
      return NextResponse.json({ error: 'Firebase SDK not initialized' }, { status: 500 })
    }

    const fcmPayload = {
      token: pushToken,
      notification: {
        title: 'New message',
        body: 'You have a new message.'
      },
      data: {
        conversationId: record.conversation_id
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FCM_OUTSIDE_CLICK'
        }
      }
    }

    console.log('Sending FCM payload:', JSON.stringify(fcmPayload))
    const response = await getMessaging().send(fcmPayload)
    console.log('FCM Push sent successfully, messageId:', response)

    return NextResponse.json({ success: true, messageId: response })
  } catch (err: any) {
    console.error('Error handling push webhook:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
