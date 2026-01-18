---
description: Onboard a new tenant to the multi-tenant real-estate SaaS
---

# Workflow: Onboard New Tenant

This workflow guides you through the process of setting up a new agency (tenant) on the platform.

### Step 1: Collect Tenant Information
Gather the following details from the user:
- **Agency Name** (e.g., "Elite Dubai Properties")
- **Short Name** (id/slug, e.g., "elite")
- **RAG Client ID** (for knowledge base isolation)
- **Twilio Credentials** (Account SID, Auth Token, Phone Number)
- **VAPI Credentials** (Assistant ID, Phone Number ID)
- **Booking Link** (Cal.com or similar)
- **Bitrix Webhook URL** (optional)

### Step 2: Generate Migration
// turbo
Create a new SQL migration file in `supabase/migrations/` to seed the `public.tenants` table.

```sql
INSERT INTO public.tenants (
    name, short_name, rag_client_id, system_prompt_identity, 
    twilio_account_sid, twilio_auth_token, twilio_phone_number,
    vapi_assistant_id, vapi_phone_number_id, booking_cal_link, crm_webhook_url
) VALUES (
    '[AGENCY_NAME]', '[SHORT_NAME]', '[RAG_CLIENT_ID]', '[AGENCY_NAME] Dubai',
    '[TWILIO_SID]', '[TWILIO_TOKEN]', '[TWILIO_PHONE]',
    '[VAPI_ASSISTANT_ID]', '[VAPI_PHONE_ID]', '[BOOKING_LINK]', '[BITRIX_URL]'
);
```

### Step 3: Verify Configuration
- Run a check against the `public.tenants` table to ensure the ID is assigned.
- Verify that the `system_prompt_identity` matches the agency's branding.

### Step 4: Documentation
Update the internal tenant registry or `docs/infra/tenants.md` with the new tenant's details.

### Step 5: Test
Use the `/test-flow` command to verify the new tenant's resolution logic.
