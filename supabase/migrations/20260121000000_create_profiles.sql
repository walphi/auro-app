-- Migration: Create profiles table to map Clerk users to tenants
-- This enables multi-tenant isolation in the dashboard

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL, -- Clerk User ID (e.g., user_2abc123...)
  tenant_id INTEGER REFERENCES public.tenants(id),
  role TEXT DEFAULT 'agent', -- 'admin', 'agent', 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Enable RLS (placeholder policies for now since we use anon key)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow all reads for now (application-level isolation)
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all" ON public.profiles FOR UPDATE USING (true);

-- Comment for documentation
COMMENT ON TABLE public.profiles IS 'Maps Clerk User IDs to tenant IDs for multi-tenant dashboard isolation';
