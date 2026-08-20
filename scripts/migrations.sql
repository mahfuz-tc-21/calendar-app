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


