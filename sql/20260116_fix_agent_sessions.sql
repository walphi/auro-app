
-- Migration to fix agent_sessions UUID issue
-- Adding text columns for channel and user_key (phone)
-- We keep lead_id (UUID) for backward compatibility but allow it to be NULL

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS user_key TEXT;

-- Update existing rows if any (unlikely to have many)
UPDATE agent_sessions SET user_key = lead_id::text WHERE user_key IS NULL;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_sessions_lookup ON agent_sessions(agent_id, user_key, channel);

-- Make lead_id nullable if it's not already
ALTER TABLE agent_sessions ALTER COLUMN lead_id DROP NOT NULL;
