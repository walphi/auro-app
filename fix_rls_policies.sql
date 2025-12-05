-- Fix RLS policies for knowledge_base and rag_chunks tables
-- Run this in Supabase SQL Editor to enable delete operations

-- =====================
-- knowledge_base table
-- =====================

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on knowledge_base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.knowledge_base;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.knowledge_base;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.knowledge_base;
DROP POLICY IF EXISTS "Enable update for all users" ON public.knowledge_base;

-- Create permissive policies (allow all operations)
CREATE POLICY "Allow all on knowledge_base" ON public.knowledge_base
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO anon;
GRANT ALL ON public.knowledge_base TO service_role;

-- =====================
-- rag_chunks table
-- =====================

-- Enable RLS
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on rag_chunks" ON public.rag_chunks;
DROP POLICY IF EXISTS "Allow all on rag_chunks" ON public.rag_chunks;

-- Create permissive policy
CREATE POLICY "Allow all on rag_chunks" ON public.rag_chunks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.rag_chunks TO authenticated;
GRANT ALL ON public.rag_chunks TO anon;
GRANT ALL ON public.rag_chunks TO service_role;

-- =====================
-- Verify
-- =====================
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    cmd 
FROM pg_policies 
WHERE tablename IN ('knowledge_base', 'rag_chunks');
