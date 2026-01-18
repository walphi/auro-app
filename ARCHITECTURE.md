# AuroApp Architecture

AuroApp is a dual-domain platform built as a monorepo. It serves institutional real estate engines (B2B) and individual broker empowerment (B2C) from a unified base of Netlify functions and a React frontend.

## High-Level Domains

### 1. Enterprise Lead Engine (B2B)
The "Institutional Side." It powers heavy-duty workflows for major brokerages like Provident. 
- **Core Value**: Turning silent leads into qualified bookings.
- **Differentiator**: Complex tool use (VAPI voice, rotation logic for sales centers).

### 2. Agent Sites Platform (B2C)
The "Retail Side." A headless CMS and site builder controlled entirely via WhatsApp.
- **Core Value**: Zero-friction digital presence for brokers.
- **Differentiator**: Generative UI (LLM generates the site schema dynamically).

---

## Folder Map

| Directory | Primary Domain | Purpose |
|-----------|----------------|---------|
| `/netlify/functions/whatsapp.ts` | **Enterprise** | The main "Lead Engine" bot for Provident. |
| `/netlify/functions/whatsapp-agent-sites.ts` | **Agent Sites** | The "Builder" bot for broker site creation. |
| `/netlify/functions/vapi.ts` | **Enterprise** | Voice agent handling and real-time transcripts. |
| `/lib/auroWhatsApp.ts` | **Enterprise** | Core business logic for Enterprise chat flows. |
| `/lib/agentSitesConversation.ts` | **Agent Sites** | State machine for the B2C onboarding/editing. |
| `/lib/aiBuilder/` | **Agent Sites** | Logic that converts agent profiles into site JSON. |
| `/lib/db/` | **Shared** | Supabase client wrappers and schema helpers. |
| `/src/` | **Agent Sites** | The React frontend that renders the `AgentSite` view. |

## Key Data Flows

### Enterprise: The Lead Qualification Loop
`WhatsApp (Incoming)` → `whatsapp.ts` → `agentLogic.ts` (Intent detection) → `leads` (Database) → `Nurturing Loop` → `VAPI Escalation` → `vapi-llm.ts` → `sales_centre_agents` (Rotation) → `Booking Confirmation`.

### Agent Sites: The WhatsApp Builder Flow
`Broker Chat` → `whatsapp-agent-sites.ts` → `agentSitesConversation.ts` (State: Bio → Branding → Focus) → `agent_configs` → `aiBuilder` (Claude) → `agent_site_documents` → `React Frontend` (Live View).

---

## Automation Points
- **Cron Jobs**: `sync-listings.ts` runs hourly to pull ParseBot data into `property_listings`.
- **RAG Updates**: `rag-learn.ts` processes new documents added to the `knowledge_base`.
- **Background Jobs**: `build-site-background.ts` handles the heavy lifting of site generation to avoid timeout.

## For Agents

### Safe to Modify
- `/lib/aiBuilder/`: If improving the site generation prompts or layout logic.
- `/netlify/functions/agents/`: Safe to add new specialist agents or tools here.
- `/docs/`: Safe to expand documentation.

### Change with Care
- `/netlify/functions/whatsapp.ts`: This is the high-traffic Enterprise core. Any regression breaks active lead nurturing.
- `/lib/db/`: Schema-level changes here affect both domains.
- `/src/App.tsx`: Routing logic for both the dashboard and live agent sites.

> [!IMPORTANT]
> Always check `docs/data-model.md` before adding columns to ensure you aren't duplicating cross-domain logic.
