-- ============================================================================
-- MULTIPLAYER GAMES EXPANSION MIGRATION
-- Run this script in your Supabase SQL Editor to register the new game types.
-- ============================================================================

-- 1. Drop existing constraint on game_type and recreate it including new types
ALTER TABLE public.games 
DROP CONSTRAINT IF EXISTS games_game_type_check;

ALTER TABLE public.games 
ADD CONSTRAINT games_game_type_check 
CHECK (game_type IN (
  'tictactoe', 'rps', 'emojiguess', 'wouldyourather', 'battleship', 
  'wordguess', 'connectfour', 'dotsandboxes', 'higherlower', 'reactionbattle'
));
