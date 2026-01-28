-- Migration to unify RAG identity around tenant_id
-- 20260123000000_unify_rag_tenant_id.sql

-- 1. Update knowledge_base table
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant_id ON public.knowledge_base(tenant_id);

-- 2. Migrating existing data
-- Note: In knowledge_base, client_id is inside the metadata JSONB column
UPDATE public.knowledge_base SET tenant_id = 1 WHERE (metadata->>'client_id' = 'demo' OR metadata->>'client_id' IS NULL) AND tenant_id IS NULL;

-- 3. Update rag_chunks indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_folder ON public.rag_chunks(tenant_id, folder_id);

-- 4. Update match_rag_chunks function to use tenant_id
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_tenant_id int DEFAULT NULL,
  filter_folder_id text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  tenant_id int,
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
    r.tenant_id,
    r.folder_id,
    r.document_id,
    r.content,
    r.metadata,
    (1 - (r.embedding <=> query_embedding))::float as similarity
  FROM public.rag_chunks r
  WHERE
    (filter_tenant_id IS NULL OR r.tenant_id = filter_tenant_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Update match_rag_chunks_weighted function to use tenant_id
CREATE OR REPLACE FUNCTION match_rag_chunks_weighted(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_tenant_id int DEFAULT NULL,
  filter_folder_id text DEFAULT NULL,
  filter_source_types text[] DEFAULT NULL,
  weight_outcome_correlation float DEFAULT 1.0,
  weight_feedback float DEFAULT 1.0,
  weight_conversion float DEFAULT 1.0
)
RETURNS TABLE (
  chunk_id text,
  tenant_id int,
  folder_id text,
  document_id text,
  content text,
  metadata jsonb,
  source_type text,
  similarity float,
  weighted_score float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.chunk_id,
    r.tenant_id,
    r.folder_id,
    r.document_id,
    r.content,
    r.metadata,
    r.source_type,
    (1 - (r.embedding <=> query_embedding))::float as similarity,
    (
      (1 - (r.embedding <=> query_embedding)) 
      * (1 + COALESCE(r.outcome_correlation, 0) * weight_outcome_correlation)
      * (1 + COALESCE(r.feedback_score, 0) * weight_feedback)
      * COALESCE(r.conversion_weight, 1.0) * weight_conversion
    )::float as weighted_score
  FROM public.rag_chunks r
  WHERE
    (filter_tenant_id IS NULL OR r.tenant_id = filter_tenant_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (filter_source_types IS NULL OR r.source_type = ANY(filter_source_types))
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY weighted_score DESC
  LIMIT match_count;
END;
$$;
