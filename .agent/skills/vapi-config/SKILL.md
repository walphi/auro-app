# Skill: VAPI Configuration Management

## Description
Instructions and procedures for managing VAPI assistants and phone numbers in a multi-tenant environment.

## Key Actions

### 1. Mapping Assistants to Tenants
Every tenant should have a `vapi_assistant_id` stored in `public.tenants`.
- **Primary Source**: `vapi_assistant_id` column.
- **Failover**: If null, the system might use a shared assistant but MUST pass `tenant_id` in `assistantOverrides`.

### 2. Implementing Assistant Overrides
When triggering a call via VAPI (server-to-server), always include:
```json
{
  "assistantOverrides": {
    "variableValues": {
      "tenant_id": "...",
      "lead_id": "...",
      "rag_client_id": "..."
    }
  }
}
```

### 3. Voice Logic Isolation
Ensure the `vapi-llm.ts` function:
1. Extracts `tenant_id` from `variableValues`.
2. Loads the `tenant` config using `getTenantById`.
3. Sets the `systemInstruction` using `tenant.system_prompt_identity`.

## Verification
- Use the VAPI dashboard or API to inspect active calls and verify `variableValues` are present.
- Check Netlify logs for `[VAPI-LLM] Resolved tenant...`.
