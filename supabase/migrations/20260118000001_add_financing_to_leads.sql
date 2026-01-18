-- Add financing column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS financing TEXT;
