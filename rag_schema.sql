-- Enable pgvector extension (Run this in Supabase SQL Editor if not enabled)
create extension if not exists vector;

-- Create Projects Table (Agent Folders)
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  client_id text, -- Optional: to link to specific client accounts if multi-tenant
  status text default 'Active'::text, -- 'Active', 'Archived'
  description text
);

-- Create Knowledge Base Table (RAG Data)
create table if not exists public.knowledge_base (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  type text not null, -- 'file', 'url', 'text'
  source_name text not null, -- Filename, URL, or "Manual Context"
  content text, -- The actual text content (chunked or full)
  embedding vector(768), -- Google Gemini embedding dimension is 768. OpenAI is 1536. Adjust as needed.
  metadata jsonb default '{}'::jsonb, -- Store extra info like page number, chunk index, etc.
  relevance_score float default 1.0 -- For "Hot Topic" prioritization
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.knowledge_base enable row level security;

-- Policies (Drop if exists to avoid errors on re-run)
drop policy if exists "Enable read access for all users" on public.projects;
drop policy if exists "Enable insert access for all users" on public.projects;
drop policy if exists "Enable update access for all users" on public.projects;

create policy "Enable read access for all users" on public.projects for select using (true);
create policy "Enable insert access for all users" on public.projects for insert with check (true);
create policy "Enable update access for all users" on public.projects for update using (true);

drop policy if exists "Enable read access for all users" on public.knowledge_base;
drop policy if exists "Enable insert access for all users" on public.knowledge_base;
drop policy if exists "Enable update access for all users" on public.knowledge_base;

create policy "Enable read access for all users" on public.knowledge_base for select using (true);
create policy "Enable insert access for all users" on public.knowledge_base for insert with check (true);
create policy "Enable update access for all users" on public.knowledge_base for update using (true);
create policy "Enable delete access for all users" on public.knowledge_base for delete using (true);

-- Realtime (Drop publication if exists to avoid errors)
drop publication if exists supabase_realtime_rag;
create publication supabase_realtime_rag for table public.projects, public.knowledge_base;

-- Vector Search Function
create or replace function match_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_project_id uuid
)
returns table (
  id uuid,
  content text,
  source_name text,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.source_name,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  from knowledge_base
  where 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  and (filter_project_id is null or knowledge_base.project_id = filter_project_id)
  order by similarity desc
  limit match_count;
end;
$$;
