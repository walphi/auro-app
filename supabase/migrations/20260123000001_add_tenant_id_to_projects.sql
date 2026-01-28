-- Migration to add tenant_id to projects table
-- 20260123000001_add_tenant_id_to_projects.sql

-- 1. Add tenant_id to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);

-- 2. Migrate existing projects
-- Assume projects with client_id = 'demo' or NULL map to tenant 1
UPDATE public.projects SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 3. Add comment
COMMENT ON COLUMN public.projects.tenant_id IS 'Owner tenant of this project/campaign';
