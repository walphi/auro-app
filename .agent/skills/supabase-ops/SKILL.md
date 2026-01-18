# Skill: Supabase Operations for Multi-Tenancy

## Description
Best practices and guidelines for managing the Supabase database in a multi-tenant real estate application.

## Core Principles

### 1. Data Isolation (Tenant ID)
Every table containing lead, activity, or configuration data MUST include a `tenant_id` column.
- **Reference**: `REFERENCES public.tenants(id)`.
- **Constraint**: `NOT NULL` is preferred for new tables to enforce isolation.

### 2. Row Level Security (RLS)
Apply RLS policies to ensure that queries (even from the dashboard if using non-service-role keys) are filtered by `tenant_id`.
```sql
CREATE POLICY "Tenants can only see their own leads" 
ON public.leads 
FOR ALL 
USING (tenant_id = (current_setting('app.current_tenant_id')::integer));
```

### 3. Migration Safety
- **Backups**: Always run `scripts/backup-supabase.sh` before applying major schema changes.
- **Seeds**: Place default data (like the Provident tenant) in `supabase/migrations/` to ensure new environments are immediately functional.

## RAG Isolation
- Use the `filter_client_id` parameter in standard RAG match functions (e.g., `match_rag_chunks`).
- Map `filter_client_id` directly to `tenant.rag_client_id`.

## Procedures
- **Adding a Table**: Ensure `tenant_id` is created and indexed.
- **Querying Data**: Always include `.eq('tenant_id', tenant.id)` in Supabase JS/TS client calls.
