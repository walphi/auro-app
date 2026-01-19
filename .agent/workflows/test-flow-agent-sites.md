---
description: Simulate a full WhatsApp onboarding flow for an agent and verify site configuration.
---

# Workflow: Test Agent Sites Flow

This workflow simulates the end-to-end WhatsApp onboarding for a broker (Bio → Branding → Focus) and asserts the correct behavior of the state machine.

### Prerequisites
1. Ensure the local dev server is running: `npm run dev` or `netlify dev`.
2. A test WhatsApp number (use `+971507150121` for simulation).

### Step 1: Initialize Onboarding (Bio)
Send the first message to trigger the `IDENTIFY_AGENT` state.
// turbo
```powershell
curl -X POST http://localhost:8888/.netlify/functions/whatsapp-agent-sites `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "From=whatsapp:+971507150121&Body=Hi"
```
**Expected Response:** "Welcome to Auro Agent Sites! ... What is your full name?"

### Step 2: Complete Bio & Branding
Simulate the collection of name, RERA, and style inspiration.
// turbo
```powershell
# Send Name
curl -X POST http://localhost:8888/.netlify/functions/whatsapp-agent-sites `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "From=whatsapp:+971507150121&Body=John Doe"

# Send RERA/Company (Simulated jump for brevity)
# In reality, you'd follow each prompt.
```

### Step 3: Verify Database State
Check the `site_conversations` and `agent_configs` tables specifically for this agent.
```sql
SELECT current_state, state_data 
FROM site_conversations 
WHERE agent_id = (SELECT id FROM agents WHERE phone = '971507150121');

SELECT slug, name, style_profile 
FROM agent_configs 
WHERE agent_id = (SELECT id FROM agents WHERE phone = '971507150121');
```

### Step 4: Assert Site Configuration Summary
The workflow should output:
1.  **State Transitions**: Verify the transitions (e.g., `COLLECT_NAME` → `COLLECT_RERA`).
2.  **Config Integrity**: Ensure `primary_color` and `bio` are correctly populated in `agent_configs`.
3.  **Generated Config**: Verify the `style_profile` contains the synthesized style from inspirations.

### Assertion Guardrails
- **Log Check**: Look for `[AgentSites] Updating conversation state` in the console.
- **Fail Case**: If `agent_configs` is not created or updated, check `netlify/functions/whatsapp-agent-sites.ts` error logs.
