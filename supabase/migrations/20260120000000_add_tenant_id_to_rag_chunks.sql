-- Migration to add tenant_id to rag_chunks for multi-tenant isolation
ALTER TABLE public.rag_chunks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_id ON public.rag_chunks(tenant_id);

-- Update existing chunks if possible (optional, but good for consistency)
-- For now, we assume existing chunks might belong to tenant 1 (Provident) if they are 'demo'
UPDATE public.rag_chunks SET tenant_id = 1 WHERE client_id = 'demo' AND tenant_id IS NULL;
