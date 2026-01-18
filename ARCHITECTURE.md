# AuroApp Architecture

AuroApp is a dual-domain, multi-tenant platform built as a monorepo. It serves institutional real estate engines (B2B) and individual broker empowerment (B2C) from a unified base of Netlify functions, Supabase, and a React frontend, orchestrated by an Antigravity `.agent/` workspace.

---

## High-Level Domains

### 1. Enterprise Lead Engine (B2B)

The "Institutional Side." It powers heavy-duty workflows for major brokerages like Provident.

- **Core value**: Turning silent leads into qualified bookings.
- **Differentiator**: Multi-tenant architecture, complex tool use (VAPI voice, CRM sync, RAG), and tenant-specific branding/flows.

### 2. Agent Sites Platform (B2C)

The "Retail Side." A headless CMS and site builder controlled entirely via WhatsApp.

- **Core value**: Zero-friction digital presence for brokers.
- **Differentiator**: Generative UI (LLM generates the site schema dynamically) and WhatsApp-native editing.

---

## Multi-Tenant Model

Auro is multi-tenant at the data and configuration layer.

- **Tenants table**

  - `public.tenants` stores per-agency configuration:
    - Branding: `name`, `short_name`, `system_prompt_identity`
    - Channels: Twilio WhatsApp number, VAPI `phoneNumberId` and `assistantId`
    - CRM: `crm_type`, `crm_webhook_url` or API credentials
    - AI: `rag_client_id`, `booking_cal_link`, other prompts

- **Lead isolation**

  - `public.leads` includes `tenant_id` (FK into `public.tenants`).
  - All lead queries and updates must respect `tenant_id` to prevent cross-agency leakage.

- **Tenant resolution paths**

  - WhatsApp:
    - Twilio webhook `To=whatsapp:+...` → `getTenantByTwilioNumber` → tenant row.
  - Voice / VAPI:
    - VAPI assistant or phone number IDs → `getTenantByVapiId` → tenant row.
  - Direct context:
    - Internal tools can call `getTenantById` when tenant is already known.

---

## Folder Map

| Directory / File                         | Primary Domain   | Purpose                                                   |
|-----------------------------------------|------------------|-----------------------------------------------------------|
| `/netlify/functions/whatsapp.ts`        | **Enterprise**   | Main "Lead Engine" bot for multi-tenant WhatsApp flows.  |
| `/netlify/functions/vapi.ts`            | **Enterprise**   | Voice agent entrypoint and call handling.                |
| `/netlify/functions/vapi-llm.ts`        | **Enterprise**   | LLM logic for VAPI calls and assistant overrides.        |
| `/netlify/functions/whatsapp-agent-sites.ts` | **Agent Sites** | "Builder" bot for broker site creation.                  |
| `/lib/auroWhatsApp.ts`                  | **Enterprise**   | Core business logic for Enterprise chat flows.           |
| `/lib/tenantConfig.ts`                  | **Enterprise**   | Tenant resolution utilities (Twilio, VAPI, direct).      |
| `/lib/bitrixClient.ts` (and future CRM clients) | **Enterprise** | CRM sync clients (Bitrix24, etc.)                        |
| `/lib/agentSitesConversation.ts`        | **Agent Sites**  | State machine for B2C onboarding/editing.                |
| `/lib/aiBuilder/`                       | **Agent Sites**  | Logic that converts agent profiles into site JSON.       |
| `/lib/db/`                              | **Shared**       | Supabase client wrappers and schema helpers.             |
| `/src/`                                 | **Agent Sites**  | React frontend that renders the `AgentSite` view.        |
| `/reports/`                             | **Enterprise**   | Daily intent logs and tenant-level performance reports.  |
| `/tools/test_tenant_flow.ts` (or similar) | **Enterprise** | Local simulation of tenant WhatsApp flows.               |

---

## Key Data Flows

### Enterprise: The Multi-Tenant Lead Qualification Loop

`WhatsApp (Incoming)`  
→ `whatsapp.ts` (resolve tenant via Twilio To)  
→ `tenantConfig` (load tenant config + branding)  
→ lead context in `leads` (scoped by `tenant_id`)  
→ **Off-plan Nurturing** (Big 5: budget, area, type, timeframe, financing)  
→ tools (e.g. `UPDATE_LEAD`, `INITIATE_CALL`, booking link)  
→ `vapi.ts` / `vapi-llm.ts` for voice escalation  
→ CRM sync via `crm-sync-master` and CRM client (e.g. Bitrix)  
→ `reports/` daily intent logs for monitoring per tenant.

### Agent Sites: The WhatsApp Builder Flow

`Broker Chat`  
→ `whatsapp-agent-sites.ts`  
→ `agentSitesConversation.ts` (State: Bio → Branding → Focus)  
→ `agent_configs`  
→ `aiBuilder` (LLM)  
→ `agent_site_documents`  
→ `React Frontend` (Live View).

---

## Antigravity Agent Layer (`.agent/`)

Auro uses Antigravity to orchestrate safe changes through specialized agents, skills, and workflows.

### Specialist Agents

- **Architect**  
  - Owns the high-level map of Auro’s architecture.
  - Runs Request → Plan → Execute loops for complex changes (new tenant, new CRM, schema changes).

- **tenant-onboarder**  
  - Handles new tenant setup:
    - Inserts/updates rows in `public.tenants`.
    - Configures Twilio, VAPI, CRM, RAG, `booking_cal_link`.
    - Ensures Provident (tenant 1) remains backward-compatible.

- **flow-specialist**  
  - Owns Enterprise chat and voice flows:
    - `whatsapp.ts`, `vapi.ts`, `vapi-llm.ts`.
    - Applies the WhatsApp Off-Plan Nurturing Skill (Big 5, drip feed, mirroring, trust-building).
    - Ensures `tenant_id` is resolved and propagated correctly.

- **crm-sync-master (multi-CRM)**  
  - Owns CRM integration:
    - `lib/bitrixClient.ts` and future `lib/*Client.ts` modules.
    - Branches on `tenant.crm_type` and `crm_webhook_url` / credentials.
    - Maintains a canonical lead schema and mappings per CRM.
    - Tracks “CRM unsynced” status per tenant.

### Core Skills (examples)

- **Supabase Operations**  
  - Patterns for multi-tenant schema migrations, adding `tenant_id`, adding new lead fields, and verifying with diagnostics.

- **WhatsApp Off-Plan Nurturing**  
  - Conversation patterns for off-plan leads:
    - Capture Big 5 (budget, area, property type, timeframe, financing).
    - Limit 1–2 questions per message.
    - Mirror user inputs and inject trust via RAG market insights.
    - Decide when to offer booking link vs INITIATE_CALL to voice.

- **VAPI Configuration**  
  - Best practices for:
    - Per-tenant `assistantId`, `phoneNumberId`, API keys.
    - `assistantOverrides` variables (lead_id, tenant_id, listing, etc.).
    - Testing outbound calls and transcripts.

- **CRM Sync**  
  - Guidelines for mapping canonical lead fields into Bitrix/other CRMs.
  - Handling rate limits, retries, and privacy constraints.

### Workflows (Slash Commands)

- `/onboard-tenant`  
  - Guided onboarding for a new agency:
    - Collects tenant name, short_name, channels, CRM, RAG, booking link.
    - Generates SQL for `public.tenants`.
    - Proposes tests for WhatsApp, VAPI, and CRM.

- `/test-flow <tenant_id>`  
  - Simulates an inbound WhatsApp flow for a given tenant:
    - Asserts correct tenant resolution and branding.
    - Exercises the Off-Plan Nurturing flow and tooling (including `financing`).
    - Verifies that booking/call behavior is correct.

---

## Testing, Diagnostics, and Reporting

- **Local flow testing**

  - `test_tenant_flow.ts` (or equivalent):
    - Simulates WhatsApp inbound per tenant.
    - Useful for regression tests without Twilio.

- **Diagnostics**

  - `inspect_schema.js`, `check_*.js`:
    - Verify `tenant_id` presence and referential integrity.
    - Confirm required lead fields (Big 5) are populated.
    - Detect “CRM unsynced” leads per tenant.

- **Reporting**

  - `/reports/`:
    - Daily intent logs per tenant (e.g., enquiry → qualified → call requested → booked).
    - Basis for optimization of WhatsApp flows, voice scripts, and CRM mappings.

---

## Automation Points

- **Cron Jobs**
  - `sync-listings.ts`: Runs hourly to pull listing data into `property_listings`.

- **RAG Updates**
  - `rag-learn.ts`: Processes new documents into the `knowledge_base` per `rag_client_id`.

- **Background Jobs**
  - `build-site-background.ts`: Handles heavy site generation workloads for Agent Sites.

---

## For Agents (Humans and AI)

### Safe to Modify

- `/lib/aiBuilder/`: Improve site generation prompts or layout logic.
- `/netlify/functions/agents/`: Add new specialist agents/tools.
- `/docs/`: Expand documentation.
- `.agent/agents`, `.agent/skills`, `.agent/workflows`: Evolve Antigravity configuration via Architect/agents.

### Change with Care

- `/netlify/functions/whatsapp.ts`: High-traffic Enterprise core; regressions break live lead nurturing.
- `/netlify/functions/vapi.ts`, `/netlify/functions/vapi-llm.ts`: Voice and escalation logic; errors affect outbound calls.
- `/lib/db/`: Schema helpers used by both domains.
- `/src/App.tsx`: Routing for dashboard and live agent sites.
- `public.tenants`, `public.leads`: Core multi-tenant data model.

> [!IMPORTANT]
> - Always check `docs/data-model.md` before adding columns to avoid duplicating cross-domain logic.
> - For schema or flow changes, prefer using Antigravity workflows (`/onboard-tenant`, `/test-flow`) and skills to plan and verify work before deploy.
