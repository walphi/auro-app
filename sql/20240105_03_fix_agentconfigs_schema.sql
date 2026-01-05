
-- Fix AgentConfig table schema mismatch
-- This script adds missing columns to the 'agentconfigs' table to align with the AgentConfig TypeScript interface and requirements.

-- Add needs_site_rebuild column
ALTER TABLE public.agentconfigs 
ADD COLUMN IF NOT EXISTS needs_site_rebuild BOOLEAN DEFAULT true;

-- Ensure other potentially missing columns from the model are present
ALTER TABLE public.agentconfigs 
ADD COLUMN IF NOT EXISTS last_built_at TIMESTAMPTZ;

-- If 'rera_number' was meant to be 'reraNumber' in some contexts, but we use snake_case in DB
-- The code uses: await createOrUpdateAgentConfig(agent.id, { rera_number: text });
-- So we ensure rera_number exists.
ALTER TABLE public.agentconfigs 
ADD COLUMN IF NOT EXISTS rera_number TEXT;

-- Verify if status column exists and has correct default
-- (Already likely exists but good to be safe)
-- ALTER TABLE public.agentconfigs ALTER COLUMN status SET DEFAULT 'draft';

-- Add any other missing fields if they don't exist
ALTER TABLE public.agentconfigs 
ADD COLUMN IF NOT EXISTS property_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS developers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS differentiators TEXT[] DEFAULT '{}';

-- Final check for timestamps
ALTER TABLE public.agentconfigs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
