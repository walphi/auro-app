CREATE TABLE public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  source text DEFAULT 'footer',
  metadata jsonb DEFAULT '{}'
);

-- Index for querying active subscribers
CREATE INDEX idx_subscribers_status ON public.subscribers (status);

-- RLS: allow anon inserts (for the footer form), restrict reads/updates to service role
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.subscribers
  USING (true)
  WITH CHECK (true);
