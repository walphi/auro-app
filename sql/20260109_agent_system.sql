-- Create agent_intents_log table
create table if not exists public.agent_intents_log (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid, -- Reference to an agent if applicable, or null for general intent
  message text not null,
  parsed_action jsonb not null,
  source text not null, -- 'edge' (FunctionGemma) or 'claude' (fallback)
  latency_ms int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create agent_sessions table
create table if not exists public.agent_sessions (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid not null,
  lead_id uuid references public.leads(id) on delete cascade,
  state jsonb default '{}'::jsonb not null,
  last_activity timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.agent_intents_log enable row level security;
alter table public.agent_sessions enable row level security;

-- Policies
create policy "Enable read access for all users" on public.agent_intents_log for select using (true);
create policy "Enable insert access for all users" on public.agent_intents_log for insert with check (true);

create policy "Enable read access for all users" on public.agent_sessions for select using (true);
create policy "Enable insert access for all users" on public.agent_sessions for insert with check (true);
create policy "Enable update access for all users" on public.agent_sessions for update using (true);

-- Realtime
alter publication supabase_realtime add table public.agent_intents_log, public.agent_sessions;
