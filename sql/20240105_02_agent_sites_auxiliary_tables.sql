-- Migration: 20240105_02_agent_sites_auxiliary_tables.sql
-- Description: Auxiliary tables for Agent Sites: Quotas, Leads, Domains, Conversations, Logs

-- Rate limiting for scraping
CREATE TABLE IF NOT EXISTS public.agent_scrape_quotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE UNIQUE NOT NULL,
  daily_limit INTEGER DEFAULT 30,
  used_today INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quota lookups (though unique already creates one)
CREATE INDEX IF NOT EXISTS idx_agent_scrape_quotas_agent_id ON public.agent_scrape_quotas(agent_id);

-- Custom domain mappings
CREATE TABLE IF NOT EXISTS public.agent_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  domain TEXT UNIQUE NOT NULL, -- "mybrand.com"
  status TEXT DEFAULT 'pending_dns', -- pending_dns, pending_ssl, active, error
  is_primary BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  ssl_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_domains_agent_id ON public.agent_domains(agent_id);

-- WhatsApp conversation state for Bird number
CREATE TABLE IF NOT EXISTS public.site_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE UNIQUE NOT NULL,
  current_state TEXT NOT NULL, -- "COLLECT_NAME", "LISTINGS_LOOP", etc.
  state_data JSONB DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Explicit index for state lookups (heavy use in Phase 2)
CREATE INDEX IF NOT EXISTS idx_site_conversations_agent_id ON public.site_conversations(agent_id);

-- Enterprise leads captured from agents/microsites
CREATE TABLE IF NOT EXISTS public.enterprise_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL, -- Referring agent
  brokerage_name TEXT,
  num_agents INTEGER,
  decision_maker_name TEXT,
  decision_maker_email TEXT,
  decision_maker_phone TEXT,
  source TEXT, -- whatsapp_prompt, site_footer, site_banner, manual, auto_trigger
  trigger_reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  priority TEXT DEFAULT 'medium', -- low, medium, high
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_leads_agent_id ON public.enterprise_leads(agent_id);

-- Cache for scraper results (avoid re-scraping same URL within 24h)
CREATE TABLE IF NOT EXISTS public.scrape_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT NOT NULL, -- listing, style
  data JSONB NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_url ON public.scrape_cache(url);
CREATE INDEX IF NOT EXISTS idx_scrape_cache_type ON public.scrape_cache(type);

-- AI Usage Logs for cost tracking and metrics
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  operation TEXT NOT NULL, -- build_site, scrape_listing, scrape_style
  model TEXT, -- "claude-3.5-sonnet-20241022"
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agent_id ON public.ai_usage_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_operation ON public.ai_usage_logs(operation);

-- Site Analytics rollup table
CREATE TABLE IF NOT EXISTS public.site_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  site_slug TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  whatsapp_clicks INTEGER DEFAULT 0,
  avg_time_on_site_seconds INTEGER,
  top_referrers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, site_slug, date)
);

CREATE INDEX IF NOT EXISTS idx_site_analytics_agent_id ON public.site_analytics(agent_id);
CREATE INDEX IF NOT EXISTS idx_site_analytics_slug ON public.site_analytics(site_slug);
CREATE INDEX IF NOT EXISTS idx_site_analytics_date ON public.site_analytics(date);

-- Enable RLS
ALTER TABLE public.agent_scrape_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- Simple Policies
CREATE POLICY "Enable read access for all" ON public.agent_scrape_quotas FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.agent_domains FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.site_conversations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.enterprise_leads FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.scrape_cache FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.ai_usage_logs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON public.site_analytics FOR SELECT USING (true);

-- Permissions
GRANT ALL ON public.agent_scrape_quotas TO authenticated, service_role;
GRANT ALL ON public.agent_domains TO authenticated, service_role;
GRANT ALL ON public.site_conversations TO authenticated, service_role;
GRANT ALL ON public.enterprise_leads TO authenticated, service_role;
GRANT ALL ON public.scrape_cache TO authenticated, service_role;
GRANT ALL ON public.ai_usage_logs TO authenticated, service_role;
GRANT ALL ON public.site_analytics TO authenticated, service_role;

GRANT SELECT ON public.agent_scrape_quotas TO anon;
GRANT SELECT ON public.agent_domains TO anon;
GRANT SELECT ON public.site_conversations TO anon;
GRANT SELECT ON public.enterprise_leads TO anon;
GRANT SELECT ON public.scrape_cache TO anon;
GRANT SELECT ON public.ai_usage_logs TO anon;
GRANT SELECT ON public.site_analytics TO anon;
