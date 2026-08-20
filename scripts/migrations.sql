-- ============================================================================
-- DATABASE MIGRATIONS FOR ADVANCED MOBILE CHAT FEATURES
-- Run this block in your Supabase SQL Editor to update your active schema.
-- ============================================================================

-- 1. Update Profiles table to support Push Tokens
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Update Messages table for delivery/edit states and additional types
-- Drop the existing message_type check constraint first (so we can recreate it with 'gif' and 'sticker')
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add new columns if not exist
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Add updated check constraint for message_type
ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'gif', 'sticker'));

-- 3. Register 'avatars' storage bucket and define RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for Avatars
DROP POLICY IF EXISTS "Allow public read on avatars" ON storage.objects;
CREATE POLICY "Allow public read on avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow owner to upload avatars" ON storage.objects;
CREATE POLICY "Allow owner to upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow owner to update own avatars" ON storage.objects;
CREATE POLICY "Allow owner to update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow owner to delete own avatars" ON storage.objects;
CREATE POLICY "Allow owner to delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- 4. DATABASE WEBHOOK TRIGGER FOR NEW CHAT MESSAGES PUSH NOTIFICATIONS
-- Run this block in your Supabase SQL Editor to connect INSERT events
-- in messages to the FCM API webhook endpoint dynamically.
-- ============================================================================

-- Enable pg_net extension to support asynchronous HTTP triggers in Supabase
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create app settings table to store Vercel URL and Webhook secret securely
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable Row Level Security to prevent public read/write access
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- (No policies are created, which restricts all public/authenticated API operations from reading it.
-- However, SECURITY DEFINER functions bypass RLS and can query the table.)

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER AS $$
DECLARE
  vercel_url TEXT;
  webhook_secret TEXT;
BEGIN
  -- Retrieve webhook details dynamically from RLS protected app_settings table
  SELECT value INTO vercel_url FROM public.app_settings WHERE key = 'vercel_url';
  SELECT value INTO webhook_secret FROM public.app_settings WHERE key = 'chat_webhook_secret';

  IF vercel_url IS NULL OR webhook_secret IS NULL THEN
    RAISE WARNING 'FCM Database Webhook settings (vercel_url or chat_webhook_secret) are not configured in public.app_settings';
    RETURN NEW;
  END IF;

  -- Trigger the push webhook asynchronously. The main message INSERT remains successful 
  -- even if the network call or notification delivery fails.
  PERFORM net.http_post(
    url := vercel_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'schema', 'public',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on messages INSERT
DROP TRIGGER IF EXISTS trigger_new_message_push ON public.messages;
CREATE TRIGGER trigger_new_message_push
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_message_push();


-- ============================================================================
-- 5. DATABASE COLUMNS FOR PRIVACY SETTINGS
-- Run this block in your Supabase SQL Editor to add settings columns to profiles.
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS active_status_enabled BOOLEAN DEFAULT TRUE NOT NULL;


-- ============================================================================
-- 6. PRIVATE CHAT GAMES SYSTEM DATABASE MIGRATIONS
-- ============================================================================

-- 1. Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('tictactoe', 'rps', 'emojiguess', 'wouldyourather', 'battleship', 'wordguess')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create game_private_states table
CREATE TABLE IF NOT EXISTS public.game_private_states (
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  private_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (game_id, user_id)
);

-- 3. Enable RLS on games and game_private_states
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_private_states ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for games
DROP POLICY IF EXISTS "Allow select on games for conversation members" ON public.games;
CREATE POLICY "Allow select on games for conversation members"
  ON public.games FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Allow insert on games for conversation members" ON public.games;
CREATE POLICY "Allow insert on games for conversation members"
  ON public.games FOR INSERT
  TO authenticated
  WITH CHECK (
    is_conversation_member(conversation_id) AND
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Allow update on games for conversation members" ON public.games;
CREATE POLICY "Allow update on games for conversation members"
  ON public.games FOR UPDATE
  TO authenticated
  USING (is_conversation_member(conversation_id))
  WITH CHECK (is_conversation_member(conversation_id));

-- 5. Create RLS policies for game_private_states
DROP POLICY IF EXISTS "Allow select on own private state" ON public.game_private_states;
CREATE POLICY "Allow select on own private state"
  ON public.game_private_states FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all on own private state" ON public.game_private_states;
CREATE POLICY "Allow all on own private state"
  ON public.game_private_states FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Add game_id and update message_type check constraint on messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.games(id) ON DELETE CASCADE;

-- Drop old check constraint if it exists
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'gif', 'sticker', 'game'));


