-- Add missing columns to leads table to support lead qualification
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS notes text;

-- Add comment to explain usage
COMMENT ON COLUMN public.leads.email IS 'Email address of the lead';
COMMENT ON COLUMN public.leads.location IS 'Preferred location for property search';
COMMENT ON COLUMN public.leads.notes IS 'General notes or summary of the lead';
