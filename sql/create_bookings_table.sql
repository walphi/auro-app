-- Create bookings table to store Google Calendar registration details
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL,
    calendar_event_id TEXT UNIQUE,
    meeting_start_iso TIMESTAMPTZ NOT NULL,
    meeting_end_iso TIMESTAMPTZ,
    status TEXT DEFAULT 'confirmed',
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for idempotency: (lead_id, meeting_start_iso)
ALTER TABLE public.bookings ADD CONSTRAINT unique_lead_meeting_time UNIQUE (lead_id, meeting_start_iso);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON public.bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_meeting_start ON public.bookings(meeting_start_iso);

-- Add RLS (Row Level Security) - basic policy for service role access primarily
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.bookings
    FOR SELECT USING (true);

CREATE POLICY "Enable all for service role" ON public.bookings
    USING (true)
    WITH CHECK (true);
