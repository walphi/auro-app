# Agent Sites: Platform Overview for External AI Agents

This document provides a technical summary of the **Agent Sites (B2C)** platform within AuroApp. It is designed for external agent frameworks (e.g., Agent Zero) to understand the system architecture, data flow, and potential integration points.

## High-Level Purpose
Agent Sites is a B2C platform that empowers individual Dubai real estate brokers to build and manage professional, AI-powered microsites via WhatsApp. Unlike the **Enterprise Lead Engine (B2B)** which focuses on large-scale sales center workflows, Agent Sites is optimized for individual personal branding and lead capture.

The platform solves the "onboarding friction" problem for brokers by replacing complex CMS interfaces with a natural language WhatsApp conversation. AI is used to generate luxury-grade site layouts, write SEO-optimized copy, and structure property listings.

## Core Flow: Broker Onboarding & Site Generation
The system follows a sequential state-machine flow triggered by WhatsApp interactions:

1.  **WhatsApp Handshake**: The broker starts a chat with the "site builder" bot.
2.  **Identity & Profile**: The bot collects profile information (Name, RERA/BRN, Brokerage, Designation, Bio).
3.  **Branding & Style**: The bot collects branding assets (Profile Photo, Logo) and preferences (Colors, Focus Areas, Property Types).
4.  **Design Inspiration**: The broker shares screenshots of premium websites they admire. The system stores these in `style_profile.inspirations`.
5.  **Listing Intake**: The broker provides property URLs (Bayut/Property Finder) or manual details. These are scraped and structured.
6.  **AI Reconstruction**: Once "publish" is triggered, the `build-site-background` function sends the collected `agent_config` and `style_profile` to an LLM (Claude/Gemini).
7.  **Site Document**: The AI generates a structured JSON `agent_site_document` containing sections, navigation, and hydrated listing data, informed by the design inspirations.
8.  **Rendering**: The React SPA (`sites` project) fetches the document and renders a high-performance, themed luxury site.

## Key Components & Files

| Component | Responsibility | File Path |
| :--- | :--- | :--- |
| **Inbound Webhook** | Handles Twilio/WhatsApp events and delegates to the orchestrator. | [whatsapp-agent-sites.ts](file:///c:/Users/phill/Downloads/2025/Auro%20App/netlify/functions/whatsapp-agent-sites.ts) |
| **State Machine** | Manages the conversation flow and updates agent configurations. | [agentSitesConversation.ts](file:///c:/Users/phill/Downloads/2025/Auro%20App/lib/agentSitesConversation.ts) |
| **AI Builder** | Orchestrates LLM calls to generate the site structure JSON. | [buildSite.ts](file:///c:/Users/phill/Downloads/2025/Auro%20App/lib/aiBuilder/buildSite.ts) |
| **Site Renderer** | The React entry point that dynamically renders pages from the AI document. | [AgentSite.tsx](file:///c:/Users/phill/Downloads/2025/Auro%20App/sites/src/components/AgentSite.tsx) |
| **Listing Scraper** | Extracts property data from portal URLs for the builder. | `netlify/functions/scrape-listing.ts` |

## Data Model Snapshot (for External Agents)

| Table | Access | Purpose |
| :--- | :--- | :--- |
| `agents` | **Read** | Core identity (phone, status). Managed by Clerk. |
| `agent_configs` | **Read/Write** | Store Branding, Bio, Focus Areas, Listing Collections, and `style_profile` (Design Inspiration). |
| `agent_site_documents` | **Read/Write** | The generated JSON consumed by the frontend. Overwritten on rebuild. |
| `site_conversations` | **Read/Write** | Current state of the WhatsApp builder bot (e.g., `COLLECT_BIO`). |
| `enterprise_leads` | **Read** | Leads captured specifically from this agent's microsite. |

> [!IMPORTANT]
> External agents should primarily interact with `agent_configs` to suggest improvements and then trigger a rebuild via the builder function. Direct modification of `agent_site_documents` is discouraged as it will be overwritten during the next AI "re-imagining".

## Integration Points for External Agents (e.g. Agent Zero)

External frameworks can safely interact with the Agent Sites platform through the following patterns:

### 1. Analysis & Suggestions (Read-Only)
- **Bio Review**: Read `agent_configs.bio` and suggest more professional or SEO-friendly alternatives.
- **Inventory Check**: Analyze `agent_configs.listings` to ensure all data is current compared to external portals.
- **Layout Optimization**: Review `agent_site_documents` to suggest structural changes to the hero or listing sections.

### 2. Guided Configuration (Write-Access)
- **SEO Enhancements**: Propose new values for metadata and focus areas directly into `agent_configs`.
- **Content Expansion**: Suggest new "Services" or "Insights" sections based on the broker's focus areas.

### 3. Build Orchestration
External agents can trigger a site rebuild via the `build-site-background` Netlify function (via API/MCP) to apply new configurations without requiring a WhatsApp command from the broker.

The orchestration process:
1.  Fetches the latest `agent_configs`.
2.  Optionally incorporates `style_profile` data (Design Inspirations) if present to guide the AI's aesthetic choices.
3.  Calls the AI Builder with a synthesized prompt.
4.  Updates `agent_site_documents`.

**Note on Style Profile**: The `style_profile` is optional. If provided, the AI Builder uses it as "inspiration" (interpretative, not literal) to set the mood, color palette, and layout philosophy. If absent, the system defaults to a premium "Eden House" aesthetic.

---
*Refer to [ARCHITECTURE.md](file:///c:/Users/phill/Downloads/2025/Auro%20App/ARCHITECTURE.md) for the global AuroApp system context.*
