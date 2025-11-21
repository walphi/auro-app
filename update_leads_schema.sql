-- Add missing columns to leads table to support CRM Dashboard
alter table public.leads add column if not exists last_interaction timestamp with time zone default now();
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists location text;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists priority text default 'Medium';
alter table public.leads add column if not exists purpose text;
