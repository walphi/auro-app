-- Migration to add booking fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS viewing_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'none';

-- Add comments for clarity
COMMENT ON COLUMN public.leads.viewing_datetime IS 'Scheduled datetime for the property viewing (Asia/Dubai)';
COMMENT ON COLUMN public.leads.booking_status IS 'Status of the viewing booking: none, pending, confirmed, completed';
