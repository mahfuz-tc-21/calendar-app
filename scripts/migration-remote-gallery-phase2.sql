-- ============================================================================
-- REMOTE GALLERY PHASE 2 DATABASE MIGRATION
-- Run this script in the Supabase SQL Editor to initialize the media metadata cache.
-- ============================================================================

-- Create Media Metadata Table
CREATE TABLE IF NOT EXISTS public.media_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  media_store_id TEXT NOT NULL, -- Native Android MediaStore ID
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image' or 'video'
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(device_id, media_store_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_metadata_device_id ON public.media_metadata(device_id);
CREATE INDEX IF NOT EXISTS idx_media_metadata_media_store_id ON public.media_metadata(media_store_id);
CREATE INDEX IF NOT EXISTS idx_media_metadata_media_type ON public.media_metadata(media_type);

-- Row Level Security (RLS)
ALTER TABLE public.media_metadata ENABLE ROW LEVEL SECURITY;

-- Admins can perform all operations
DROP POLICY IF EXISTS "Admins have full access to media metadata" ON public.media_metadata;
CREATE POLICY "Admins have full access to media metadata"
  ON public.media_metadata FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
