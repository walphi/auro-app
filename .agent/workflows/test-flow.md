---
description: Test the lead flow and tenant resolution for a specific tenant ID
---

# Workflow: Test Tenant Flow

Use this workflow to verify that a tenant is correctly configured and the AI responds with the correct branding and RAG context.

### Step 1: Resolve Tenant
Verify the tenant existence in the database.
```bash
# Example query to run in Supabase SQL editor or via script
SELECT * FROM public.tenants WHERE id = [TENANT_ID];
```

### Step 2: Simulate WhatsApp Inbound
Trigger the `whatsapp.ts` function locally or via a mock request to verify tenant resolution by `To` number.

**Check Logs For:**
- `[TenantConfig] Resolved tenant [NAME] (id=[ID])`
- `[RAG] Searching rag_chunks with client_id: [TENANT_RAG_ID]`
- `[AI] Identity check: Does the response mention the correct agency name?`

### Step 3: Verify Tool Integration
- **VAPI**: Check if the `INITIATE_CALL` tool passes the correct `assistantId` and `tenant_id` metadata.
- **Bitrix**: Ensure the `updateLead` call uses the tenant's `crm_webhook_url`.

### Step 4: Off-Plan Script Check
If testing an off-plan flow:
1. Send a query about a specific off-plan project.
2. Confirm the AI follows the **WhatsApp Off-Plan Nurturing Skill** (asks budget, location, etc.).
3. Verify the booking link provided matches `tenant.booking_cal_link`.
