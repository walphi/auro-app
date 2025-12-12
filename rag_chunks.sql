-- AURO RAG Chunks Table Schema
-- Run this in Supabase SQL Editor to fix the rag_chunks table

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop and recreate rag_chunks table with correct schema
DROP TABLE IF EXISTS public.rag_chunks CASCADE;

CREATE TABLE public.rag_chunks (
  chunk_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),  -- Gemini text-embedding-004 produces 768 dimensions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_chunks_client ON public.rag_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_folder ON public.rag_chunks(client_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON public.rag_chunks(document_id);

-- Vector similarity index (requires 100+ rows to be effective)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON public.rag_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Enable RLS (but allow all for now)
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all read on rag_chunks" ON public.rag_chunks;
DROP POLICY IF EXISTS "Allow all write on rag_chunks" ON public.rag_chunks;

CREATE POLICY "Allow all read on rag_chunks" ON public.rag_chunks FOR SELECT USING (true);
CREATE POLICY "Allow all write on rag_chunks" ON public.rag_chunks FOR ALL USING (true);

-- 5. Create match_rag_chunks function for vector search
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_client_id text DEFAULT NULL,
  filter_folder_id text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  client_id text,
  folder_id text,
  document_id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.chunk_id,
    r.client_id,
    r.folder_id,
    r.document_id,
    r.content,
    r.metadata,
    (1 - (r.embedding <=> query_embedding))::float as similarity
  FROM public.rag_chunks r
  WHERE
    (filter_client_id IS NULL OR r.client_id = filter_client_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Grant permissions
GRANT ALL ON public.rag_chunks TO authenticated;
GRANT ALL ON public.rag_chunks TO service_role;
GRANT ALL ON public.rag_chunks TO anon;

-- 7. Verify the table
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'rag_chunks' 
ORDER BY ordinal_position;
