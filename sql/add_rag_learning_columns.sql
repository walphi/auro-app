-- Add RAG Learning columns to rag_chunks table
-- Run this in Supabase SQL Editor

-- 1. Add new columns for learning metadata
ALTER TABLE public.rag_chunks 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload',
ADD COLUMN IF NOT EXISTS outcome_correlation FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS feedback_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_weight FLOAT DEFAULT 1.0;

-- 2. Create index for source type filtering
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_type 
ON public.rag_chunks(source_type);

-- 3. Create index for conversion weight queries
CREATE INDEX IF NOT EXISTS idx_rag_chunks_conversion_weight 
ON public.rag_chunks(conversion_weight DESC);

-- 4. Add comments for documentation
COMMENT ON COLUMN public.rag_chunks.source_type IS 
  'Origin: upload, conversation_learning, winning_script, hot_topic';
COMMENT ON COLUMN public.rag_chunks.outcome_correlation IS 
  'Correlation score with positive outcomes (0.0 to 1.0)';
COMMENT ON COLUMN public.rag_chunks.feedback_score IS 
  'User feedback: -1.0 (thumbs down) to 1.0 (thumbs up)';
COMMENT ON COLUMN public.rag_chunks.usage_count IS 
  'Number of times this chunk was retrieved and used';
COMMENT ON COLUMN public.rag_chunks.conversion_weight IS 
  'Conversion weight: 3.0 (booking confirmed), 1.5 (qualified), 0.5 (dropped), 1.0 (default)';

-- 5. Create weighted search function with source type filtering and client isolation
CREATE OR REPLACE FUNCTION match_rag_chunks_weighted(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_client_id text DEFAULT NULL,
  filter_folder_id text DEFAULT NULL,
  filter_source_types text[] DEFAULT NULL,
  weight_outcome_correlation float DEFAULT 1.0,
  weight_feedback float DEFAULT 1.0,
  weight_conversion float DEFAULT 1.0
)
RETURNS TABLE (
  chunk_id text,
  client_id text,
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
    r.client_id,
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
    -- Client isolation (required for multi-tenant)
    (filter_client_id IS NULL OR r.client_id = filter_client_id)
    -- Folder filtering
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    -- Source type filtering (for Vapi priority boost)
    AND (filter_source_types IS NULL OR r.source_type = ANY(filter_source_types))
    -- Similarity threshold
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY weighted_score DESC
  LIMIT match_count;
END;
$$;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION match_rag_chunks_weighted TO authenticated;
GRANT EXECUTE ON FUNCTION match_rag_chunks_weighted TO service_role;
GRANT EXECUTE ON FUNCTION match_rag_chunks_weighted TO anon;

-- 7. Verification query
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'rag_chunks' 
  AND column_name IN ('source_type', 'outcome_correlation', 'feedback_score', 'usage_count', 'conversion_weight')
ORDER BY column_name;
