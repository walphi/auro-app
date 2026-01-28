-- Migration to add project_id to rag_chunks for campaign-specific RAG
-- 20260123000002_add_project_id_to_rag_chunks.sql

-- 1. Add project_id to rag_chunks
ALTER TABLE public.rag_chunks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_project_id ON public.rag_chunks(project_id);

-- 2. Update match_rag_chunks to support project filtering
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_tenant_id int DEFAULT NULL,
  filter_folder_id text DEFAULT NULL,
  filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  tenant_id int,
  project_id uuid,
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
    r.project_id,
    r.folder_id,
    r.document_id,
    r.content,
    r.metadata,
    (1 - (r.embedding <=> query_embedding))::float as similarity
  FROM public.rag_chunks r
  WHERE
    (filter_tenant_id IS NULL OR r.tenant_id = filter_tenant_id)
    AND (filter_project_id IS NULL OR r.project_id = filter_project_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Update match_rag_chunks_weighted to support project filtering
CREATE OR REPLACE FUNCTION match_rag_chunks_weighted(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_tenant_id int DEFAULT NULL,
  filter_folder_id text DEFAULT NULL,
  filter_project_id uuid DEFAULT NULL,
  filter_source_types text[] DEFAULT NULL,
  weight_outcome_correlation float DEFAULT 1.0,
  weight_feedback float DEFAULT 1.0,
  weight_conversion float DEFAULT 1.0
)
RETURNS TABLE (
  chunk_id text,
  tenant_id int,
  project_id uuid,
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
    r.project_id,
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
    AND (filter_project_id IS NULL OR r.project_id = filter_project_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (filter_source_types IS NULL OR r.source_type = ANY(filter_source_types))
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY weighted_score DESC
  LIMIT match_count;
END;
$$;
