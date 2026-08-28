-- ============================================================================
-- REMOTE GALLERY PHASE 1 DATABASE MIGRATION (REVISED)
-- Run this script in the Supabase SQL Editor to initialize the necessary
-- tables, indexes, constraints, and Row Level Security policies.
-- ============================================================================

-- 1. Profiles is_admin Column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT UNIQUE NOT NULL, -- Persistent UUID generated locally on the client
  device_name TEXT NOT NULL,
  device_model TEXT NOT NULL,
  platform TEXT NOT NULL, -- e.g., 'android'
  os_version TEXT NOT NULL,
  app_version TEXT NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Audit Logging Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_is_online ON public.devices(is_online);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to verify if the requesting user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- --- RLS Policies for Devices ---

-- Authenticated users can read their own devices
DROP POLICY IF EXISTS "Users can read own devices" ON public.devices;
CREATE POLICY "Users can read own devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert/update their own devices (registration)
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
CREATE POLICY "Users can insert own devices"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all devices
DROP POLICY IF EXISTS "Admins can select all devices" ON public.devices;
CREATE POLICY "Admins can select all devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all devices
DROP POLICY IF EXISTS "Admins can update all devices" ON public.devices;
CREATE POLICY "Admins can update all devices"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- RLS Policies for Audit Logs ---

-- Admins can read all audit logs
DROP POLICY IF EXISTS "Admins can select audit logs" ON public.audit_logs;
CREATE POLICY "Admins can select audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());
