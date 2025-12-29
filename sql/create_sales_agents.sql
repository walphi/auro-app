-- Sales Centre Agents table for agent rotation
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.sales_centre_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  community TEXT,  -- Which community/project they handle (NULL = all)
  developer TEXT,  -- Which developer they specialize in (Emaar, Damac, etc.)
  is_available BOOLEAN DEFAULT true,
  last_assigned_at TIMESTAMPTZ,
  total_assignments INTEGER DEFAULT 0
);

-- Sample agents
INSERT INTO public.sales_centre_agents (name, phone, email, community, developer) VALUES
  ('Sarah Ahmed', '+971501234001', 'sarah@provident.ae', 'Dubai Marina', 'Emaar'),
  ('Mohammed Al-Rashid', '+971501234002', 'mohammed@provident.ae', 'Downtown Dubai', 'Emaar'),
  ('Priya Sharma', '+971501234003', 'priya@provident.ae', 'JBR', 'Dubai Properties'),
  ('James Wilson', '+971501234004', 'james@provident.ae', 'Palm Jumeirah', 'Nakheel'),
  ('Fatima Hassan', '+971501234005', 'fatima@provident.ae', NULL, NULL)  -- General agent
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.sales_centre_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read on sales_centre_agents" ON public.sales_centre_agents 
  FOR SELECT USING (true);
CREATE POLICY "Allow update on sales_centre_agents" ON public.sales_centre_agents 
  FOR UPDATE USING (true);

-- Function to get next available agent with rotation
CREATE OR REPLACE FUNCTION get_next_sales_agent(
  filter_community TEXT DEFAULT NULL,
  filter_developer TEXT DEFAULT NULL
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  agent_phone TEXT,
  agent_email TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  selected_agent RECORD;
BEGIN
  -- Select agent with least recent assignment, matching community/developer if specified
  SELECT id, name, phone, email INTO selected_agent
  FROM public.sales_centre_agents
  WHERE is_available = true
    AND (filter_community IS NULL OR community IS NULL OR community ILIKE '%' || filter_community || '%')
    AND (filter_developer IS NULL OR developer IS NULL OR developer ILIKE '%' || filter_developer || '%')
  ORDER BY last_assigned_at NULLS FIRST, total_assignments ASC
  LIMIT 1;

  IF selected_agent IS NOT NULL THEN
    -- Update assignment tracking
    UPDATE public.sales_centre_agents 
    SET last_assigned_at = NOW(), total_assignments = total_assignments + 1
    WHERE id = selected_agent.id;

    RETURN QUERY SELECT selected_agent.id, selected_agent.name, selected_agent.phone, selected_agent.email;
  END IF;
END;
$$;

-- Grant permissions
GRANT ALL ON public.sales_centre_agents TO authenticated;
GRANT ALL ON public.sales_centre_agents TO service_role;
GRANT ALL ON public.sales_centre_agents TO anon;
GRANT EXECUTE ON FUNCTION get_next_sales_agent TO authenticated, service_role, anon;

-- Verify
SELECT * FROM public.sales_centre_agents;
