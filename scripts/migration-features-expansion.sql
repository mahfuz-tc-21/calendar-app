-- ============================================================================
-- FEATURE EXPANSION MIGRATION
-- Daily Planner, Mood Check-in, Private Journal, and Chat Themes
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Daily Planner Tasks Table
CREATE TABLE IF NOT EXISTS public.planner_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_date DATE NOT NULL,
  task_time TIME WITHOUT TIME ZONE,
  completed BOOLEAN DEFAULT false NOT NULL,
  reorder_index INTEGER DEFAULT 0 NOT NULL,
  reminder_offset TEXT DEFAULT 'none',
  reminder_custom_time TIME WITHOUT TIME ZONE,
  reminder_repeat TEXT DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alter Calendar Events to support offline reminders
ALTER TABLE public.calendar_events 
  ADD COLUMN IF NOT EXISTS reminder_offset TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reminder_custom_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS reminder_repeat TEXT DEFAULT 'none';

-- 2. Daily Mood Tracker Table
CREATE TABLE IF NOT EXISTS public.daily_moods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mood_date DATE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'bad', 'difficult')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, mood_date)
);

-- 3. Private Journals Table
CREATE TABLE IF NOT EXISTS public.private_journals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Conversation Themes Table
CREATE TABLE IF NOT EXISTS public.conversation_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('default', 'purple', 'ocean', 'emerald', 'sunset', 'rose', 'cyan')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, conversation_id)
);

-- 5. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_planner_tasks_user_date ON public.planner_tasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_daily_moods_user_date ON public.daily_moods(user_id, mood_date);
CREATE INDEX IF NOT EXISTS idx_private_journals_user_date ON public.private_journals(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_conversation_themes_user_conv ON public.conversation_themes(user_id, conversation_id);

-- 6. Enable RLS
ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_themes ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "Allow all actions on own planner tasks" ON public.planner_tasks;
CREATE POLICY "Allow all actions on own planner tasks"
  ON public.planner_tasks FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all actions on own daily moods" ON public.daily_moods;
CREATE POLICY "Allow all actions on own daily moods"
  ON public.daily_moods FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all actions on own private journals" ON public.private_journals;
CREATE POLICY "Allow all actions on own private journals"
  ON public.private_journals FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all actions on own conversation themes if conversation member" ON public.conversation_themes;
CREATE POLICY "Allow all actions on own conversation themes if conversation member"
  ON public.conversation_themes FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND public.is_conversation_member(conversation_id))
  WITH CHECK (user_id = auth.uid() AND public.is_conversation_member(conversation_id));

-- 8. Alter Constraint for Premium Themes
ALTER TABLE public.conversation_themes DROP CONSTRAINT IF EXISTS conversation_themes_theme_check;
ALTER TABLE public.conversation_themes ADD CONSTRAINT conversation_themes_theme_check CHECK (theme IN ('default', 'purple', 'ocean', 'emerald', 'sunset', 'rose', 'cyan'));
