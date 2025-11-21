-- Create Leads Table
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  phone text unique not null,
  email text,
  status text default 'New'::text,
  custom_field_1 text,
  custom_field_2 text,
  last_interaction timestamp with time zone default timezone('utc'::text, now())
);

-- Create Messages/History Table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  type text not null, -- 'Message', 'Voice_Transcript', 'System_Note', 'Status_Change'
  sender text not null, -- 'Lead', 'AURO_AI', 'User', 'System'
  content text,
  metadata jsonb default '{}'::jsonb
);

-- Enable Row Level Security (RLS)
alter table public.leads enable row level security;
alter table public.messages enable row level security;

-- Create Policies (Allow all for now for MVP, refine later)
create policy "Enable read access for all users" on public.leads for select using (true);
create policy "Enable insert access for all users" on public.leads for insert with check (true);
create policy "Enable update access for all users" on public.leads for update using (true);

create policy "Enable read access for all users" on public.messages for select using (true);
create policy "Enable insert access for all users" on public.messages for insert with check (true);
create policy "Enable update access for all users" on public.messages for update using (true);

-- Create Realtime Publication
drop publication if exists supabase_realtime;
create publication supabase_realtime for table public.leads, public.messages;
