-- ============================================================================
-- PRIVACY-FOCUSED CALENDAR + CHAT DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor to initialize all tables,
-- constraints, triggers, and Row Level Security (RLS) policies.
-- ============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TABLES

-- Profiles Table (references auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Conversation Members Table (links profiles to conversations, exactly two members)
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(conversation_id, user_id)
);

-- Messages Table (supports text and image messages with reply links)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  image_path TEXT,
  reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Message Reactions Table (unique user/reaction combination per message)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, reaction)
);

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Privacy Settings Table (secures the private chat space)
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_key_hash TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0 NOT NULL,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id_date ON public.calendar_events(user_id, event_date);

-- 4. TRIGGERS AND FUNCTIONS

-- Trigger function to automatically create a public profile upon user signup in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 1;
BEGIN
  -- Determine base username from metadata or email
  base_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    split_part(new.email, '@', 1)
  );
  
  -- Handle potential empty or fallback cases
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user_' || substring(md5(random()::text) from 1 for 6);
  END IF;

  final_username := base_username;

  -- Ensure uniqueness of username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    new.id,
    final_username,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', '')
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to limit conversations to a maximum of 2 members
CREATE OR REPLACE FUNCTION public.check_conversation_members_limit()
RETURNS trigger AS $$
BEGIN
  IF (
    SELECT COUNT(*) 
    FROM public.conversation_members 
    WHERE conversation_id = new.conversation_id
  ) >= 2 THEN
    RAISE EXCEPTION 'A conversation can have at most 2 members.';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER enforce_conversation_members_limit
  BEFORE INSERT ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.check_conversation_members_limit();


-- 4.5. HELPER FUNCTION TO PREVENT RLS RECURSION
-- This function verifies conversation membership and runs with SECURITY DEFINER
-- which bypasses RLS checks, breaking the infinite query loop.
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- Profiles
DROP POLICY IF EXISTS "Allow select on profiles for authenticated users" ON public.profiles;
CREATE POLICY "Allow select on profiles for authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow update on own profile" ON public.profiles;
CREATE POLICY "Allow update on own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Conversations
DROP POLICY IF EXISTS "Allow select on conversations for members" ON public.conversations;
CREATE POLICY "Allow select on conversations for members"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    is_conversation_member(id) OR
    NOT EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_id = id
    )
  );

DROP POLICY IF EXISTS "Allow insert on conversations for authenticated users" ON public.conversations;
CREATE POLICY "Allow insert on conversations for authenticated users"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete on conversations for members" ON public.conversations;
CREATE POLICY "Allow delete on conversations for members"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (is_conversation_member(id));

-- Conversation Members
DROP POLICY IF EXISTS "Allow select on conversation_members for members" ON public.conversation_members;
CREATE POLICY "Allow select on conversation_members for members"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Allow insert on conversation_members for conversation participants" ON public.conversation_members;
CREATE POLICY "Allow insert on conversation_members for conversation participants"
  ON public.conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR is_conversation_member(conversation_id)
  );

-- Messages
DROP POLICY IF EXISTS "Allow select on messages for conversation members" ON public.messages;
CREATE POLICY "Allow select on messages for conversation members"
  ON public.messages FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Allow insert on messages for conversation members" ON public.messages;
CREATE POLICY "Allow insert on messages for conversation members"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND is_conversation_member(conversation_id)
  );

DROP POLICY IF EXISTS "Allow soft delete or update on own messages" ON public.messages;
CREATE POLICY "Allow soft delete or update on own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Message Reactions
DROP POLICY IF EXISTS "Allow select on message reactions for conversation members" ON public.message_reactions;
CREATE POLICY "Allow select on message reactions for conversation members"
  ON public.message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Allow insert on reactions for own user and message members" ON public.message_reactions;
CREATE POLICY "Allow insert on reactions for own user and message members"
  ON public.message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Allow delete on own reactions" ON public.message_reactions;
CREATE POLICY "Allow delete on own reactions"
  ON public.message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Calendar Events
DROP POLICY IF EXISTS "Allow all actions on own calendar events" ON public.calendar_events;
CREATE POLICY "Allow all actions on own calendar events"
  ON public.calendar_events FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Privacy Settings
DROP POLICY IF EXISTS "Allow all actions on own privacy settings" ON public.privacy_settings;
CREATE POLICY "Allow all actions on own privacy settings"
  ON public.privacy_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 7. SUPABASE STORAGE BUCKET & POLICIES FOR PRIVATE CHAT IMAGES

-- Ensure the chat_images bucket is registered
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage objects (using helper function to verify membership)
DROP POLICY IF EXISTS "Allow authenticated users to read chat images if conversation member" ON storage.objects;
CREATE POLICY "Allow authenticated users to read chat images if conversation member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat_images' AND
    is_conversation_member(CAST(split_part(name, '/', 1) AS UUID))
  );

DROP POLICY IF EXISTS "Allow authenticated users to upload chat images if conversation member" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload chat images if conversation member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat_images' AND
    is_conversation_member(CAST(split_part(name, '/', 1) AS UUID))
  );

DROP POLICY IF EXISTS "Allow authenticated users to delete own chat images" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete own chat images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat_images' AND
    owner = auth.uid()
  );


-- ============================================================================
-- 8. ENABLE REALTIME REPLICATION FOR MESSAGES & REACTIONS
-- Run this block to register the tables in Supabase Realtime publication.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
