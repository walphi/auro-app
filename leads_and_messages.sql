-- Create Leads Table
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  phone text not null unique,
  name text,
  status text default 'New'::text,
  budget text,
  property_type text,
  timeline text,
  custom_field_1 text
);

-- Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  type text not null, -- 'Message', 'System_Note'
  sender text not null, -- 'Lead', 'AURO_AI', 'System'
  content text
);

-- Enable RLS
alter table public.leads enable row level security;
alter table public.messages enable row level security;

-- Policies (Open for MVP - Adjust for production)
create policy "Enable read access for all users" on public.leads for select using (true);
create policy "Enable insert access for all users" on public.leads for insert with check (true);
create policy "Enable update access for all users" on public.leads for update using (true);

create policy "Enable read access for all users" on public.messages for select using (true);
create policy "Enable insert access for all users" on public.messages for insert with check (true);
create policy "Enable update access for all users" on public.messages for update using (true);

-- Realtime
create publication supabase_realtime_leads_messages for table public.leads, public.messages;
