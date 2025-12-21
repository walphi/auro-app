-- Migration to add current_listing_id to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS current_listing_id UUID REFERENCES public.property_listings(id);

-- Comment for clarity
COMMENT ON COLUMN public.leads.current_listing_id IS 'ID of the property listing the lead is currently inquiring about, used for conversation context.';
