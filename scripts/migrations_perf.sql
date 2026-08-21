-- ============================================================================
-- PERFORMANCE OPTIMIZATION MIGRATIONS
-- Run this script in the Supabase SQL Editor to apply indices and triggers.
-- ============================================================================

-- 1. Create composite performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_conversation_status ON public.games(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(lower(username));

-- 2. Create trigger function to automatically update conversations.updated_at on message insert
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register the trigger on messages table
DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();
