-- Create agent_site_documents and ai_usage_logs tables if they don't exist
-- This fixes the PGRST205 "Could not find table" error

CREATE TABLE IF NOT EXISTS agent_site_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    config_id UUID NOT NULL REFERENCES agentconfigs(id),
    slug TEXT NOT NULL,
    version INTEGER NOT NULL,
    language_codes TEXT[] NOT NULL DEFAULT '{en}',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    theme JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    listings JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by TEXT,
    token_usage JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for security
ALTER TABLE agent_site_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for read access (public)
CREATE POLICY "Public read access for documents"
ON agent_site_documents FOR SELECT
USING (true);

-- Create policy for insert access (service role can insert)
CREATE POLICY "Service role insert documents"
ON agent_site_documents FOR INSERT
WITH CHECK (true);


CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    operation TEXT NOT NULL,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for insert (service role)
CREATE POLICY "Service role insert logs"
ON ai_usage_logs FOR INSERT
WITH CHECK (true);

-- Grant permissions to anon/authenticated/service_role as appropriate
GRANT ALL ON agent_site_documents TO service_role;
GRANT SELECT ON agent_site_documents TO anon, authenticated;

GRANT ALL ON ai_usage_logs TO service_role;
