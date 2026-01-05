-- Migration: 20240105_01_agent_sites_core_tables.sql
-- Description: Core tables for Agent Sites product

-- Brokerages table for multi-tenant organizations
CREATE TABLE IF NOT EXISTS public.brokerages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  num_agents INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'starter', -- starter, professional, enterprise
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table linked to brokerages
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brokerage_id UUID REFERENCES public.brokerages(id) ON DELETE SET NULL,
  phone TEXT UNIQUE NOT NULL, -- WhatsApp phone (Bird number contact)
  email TEXT,
  role TEXT DEFAULT 'agent', -- agent, team_lead, manager, owner
  status TEXT DEFAULT 'pending', -- pending, onboarding, active, suspended
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Configs (Profile, branding, focus, listings, leadConfig, styleProfile)
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  brokerage_id UUID REFERENCES public.brokerages(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL, -- URL slug: "sarah-ahmed"
  status TEXT DEFAULT 'draft', -- draft, ready, published

  -- Identity
  name TEXT,
  designation TEXT,
  company TEXT,
  rera_number TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  languages TEXT[] DEFAULT '{}',
  bio TEXT,

  -- Branding
  primary_color TEXT DEFAULT '#1a365d',
  secondary_color TEXT DEFAULT '#c9a227',
  theme_variant TEXT DEFAULT 'light', -- light, darkGold, darkBlue, minimal
  logo_url TEXT,
  profile_photo_url TEXT,

  -- Focus
  areas TEXT[] DEFAULT '{}',
  property_types TEXT[] DEFAULT '{}',
  developers TEXT[] DEFAULT '{}',

  -- Services
  services TEXT[] DEFAULT '{}',
  differentiators TEXT[] DEFAULT '{}',

  -- Listings (JSONB array of Listing objects)
  listings JSONB DEFAULT '[]'::jsonb,

  -- Lead Config
  lead_config JSONB DEFAULT '{}'::jsonb,

  -- Style Profile
  style_profile JSONB DEFAULT '{}'::jsonb,

  -- Build Control
  needs_site_rebuild BOOLEAN DEFAULT true,
  last_built_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Agent Site Documents (Versioned Claude-generated site schemas)
CREATE TABLE IF NOT EXISTS public.agent_site_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  config_id UUID REFERENCES public.agent_configs(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  language_codes TEXT[] DEFAULT '{"en"}',
  
  meta JSONB DEFAULT '{}'::jsonb,
  theme JSONB DEFAULT '{}'::jsonb,
  sections JSONB DEFAULT '[]'::jsonb,
  listings JSONB DEFAULT '[]'::jsonb,

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT, -- Model name: "claude-3.5-sonnet-20241022"
  token_usage JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_site_documents ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Allow read access, restricted write access)
-- Note: In a real app, these would be filtered by user identity/auth.uid()
CREATE POLICY "Enable read access for all" ON public.brokerages FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.agent_configs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.agent_site_documents FOR SELECT USING (true);

-- Permissions
GRANT ALL ON public.brokerages TO authenticated, service_role;
GRANT ALL ON public.agents TO authenticated, service_role;
GRANT ALL ON public.agent_configs TO authenticated, service_role;
GRANT ALL ON public.agent_site_documents TO authenticated, service_role;

GRANT SELECT ON public.brokerages TO anon;
GRANT SELECT ON public.agents TO anon;
GRANT SELECT ON public.agent_configs TO anon;
GRANT SELECT ON public.agent_site_documents TO anon;
