-- Drop overloaded functions to fix ambiguity
DROP FUNCTION IF EXISTS match_rag_chunks(vector, float, int, int, text, uuid, text[]);
DROP FUNCTION IF EXISTS match_rag_chunks(vector, float, int, int, text, uuid);

-- Create Unified Function
CREATE OR REPLACE FUNCTION match_rag_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_tenant_id int DEFAULT 1,
  filter_folder_id text DEFAULT NULL,
  filter_project_id uuid DEFAULT NULL,
  filter_folders text[] DEFAULT NULL,
  client_filter text DEFAULT 'demo'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  folder_id text,
  document_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.content,
    rc.metadata,
    rc.folder_id,
    rc.document_id,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_chunks rc
  WHERE (1 - (rc.embedding <=> query_embedding) > match_threshold)
    AND (filter_tenant_id IS NULL OR rc.tenant_id = filter_tenant_id)
    AND (filter_project_id IS NULL OR rc.project_id = filter_project_id)
    AND (
      -- Folder filtering: matches folder_id if single, or in folders if list
      (filter_folder_id IS NULL AND filter_folders IS NULL)
      OR (filter_folder_id IS NOT NULL AND rc.folder_id = filter_folder_id)
      OR (filter_folders IS NOT NULL AND rc.folder_id = ANY(filter_folders))
    )
    AND (client_filter IS NULL OR rc.client_id = client_filter)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
