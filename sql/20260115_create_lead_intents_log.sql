-- Migration: 20260115_create_lead_intents_log.sql
-- Description: Create dedicated table for lead intent logging

CREATE TABLE IF NOT EXISTS public.lead_intents_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  intent_type TEXT NOT NULL, -- e.g. 'booking', 'objection', 'offplan_interest', 'call_request'
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_intents_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.lead_intents_log FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.lead_intents_log FOR INSERT WITH CHECK (true);

-- Permissions
GRANT ALL ON public.lead_intents_log TO authenticated, service_role;
GRANT SELECT ON public.lead_intents_log TO anon;

-- Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_intents_log;
