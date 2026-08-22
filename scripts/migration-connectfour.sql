-- ============================================================================
-- CONNECT FOUR MULTIPLAYER GAME MIGRATION
-- Run this script in your Supabase SQL Editor to register the new game type.
-- ============================================================================

-- 1. Drop existing constraint on game_type and recreate it including 'connectfour'
ALTER TABLE public.games 
DROP CONSTRAINT IF EXISTS games_game_type_check;

ALTER TABLE public.games 
ADD CONSTRAINT games_game_type_check 
CHECK (game_type IN ('tictactoe', 'rps', 'emojiguess', 'wouldyourather', 'battleship', 'wordguess', 'connectfour'));

-- 2. Ensure games table is registered for realtime updates in the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
  END IF;
END $$;
