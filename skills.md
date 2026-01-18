# AuroApp Agent Skills

This file defines the core skills and operational guidelines for agents working on the AuroApp codebase.

---

## enterprise-leads-skill
**Description**: Managing the B2B institutional lead engine (Provident-style workflows).

### When to use
Use this skill when modifying or interacting with:
- **Core Files**: `netlify/functions/whatsapp.ts`, `netlify/functions/vapi.ts`, `lib/auroWhatsApp.ts`.
- **Tables**: `leads`, `messages`, `sales_centre_agents`, `property_listings`, `lead_intents_log`.

### Operational Guidelines
- **Safe to Modify**: `/netlify/functions/agents/`, `/docs/`.
- **Change with Care**: `/netlify/functions/whatsapp.ts` (Core engine), `/lib/db/` (Shared schema).
- **Data Integrity**: 
  - `property_listings`: **Read-only**. This is synced from external sources.
  - `sales_centre_agents`: **Read-only**. Used for reference and rotation logic.
  - `leads`: Safe to update `status` and `metadata`.
  - `messages`: Safe to append new interaction records.

### Standard Workflows
1. **Lead Assessment**: Read `leads` and `messages` history to determine the current nurturing stage.
2. **Intent Handling**: Log detected user intents to `lead_intents_log` for future routing.
3. **Escalation**: Transition from WhatsApp to VAPI voice agent when lead qualification criteria are met.
4. **Booking**: Use `sales_centre_agents` rotation logic to assign meetings to available agents.

---

## agent-sites-skill
**Description**: Managing the B2C WhatsApp Site Builder and broker microsite platform.

### When to use
Use this skill when modifying or interacting with:
- **Core Files**: `netlify/functions/whatsapp-agent-sites.ts`, `lib/agentSitesConversation.ts`, `lib/aiBuilder/`.
- **Tables**: `agents`, `agent_configs`, `agent_site_documents`, `site_conversations`.

### Operational Guidelines
- **Safe Patterns**:
  - Updating `agent_configs` (branding, bio, focus areas).
  - Generating new versions of `agent_site_documents`.
  - Updating `site_conversations` state data during onboarding/editing.
- **Strictly Prohibited**:
  - Do not directly edit core `agents` identity (e.g., phone, email) or `brokerages` metadata without explicit user instruction.
- **Frontend Sync**: Changes to site documents must be verified against the `AgentSite.tsx` renderer.

### Standard Workflows
1. **Broker Onboarding**: Guide brokers through the WhatsApp onboarding state machine and capture data into `agent_configs`.
2. **Site Generation**: Trigger the `aiBuilder` to process `agent_configs` and write a new, structured JSON to `agent_site_documents`.
3. **Edit Mode**: Manage the transition into "Edit Mode" via `site_conversations` to allow contextual updates without restarting onboarding.
