# Enterprise WhatsApp → VAPI Lead Nurturing Flow

This document provides a precise, implementation-level overview of how the AuroApp B2B lead flow (e.g., Provident) currently functions.

## High-Level Overview
The Enterprise flow is designed to capture cold leads (from Bitrix24 or direct WhatsApp), qualify them through an AI-driven chat interaction, and escalate high-intent users to a VAPI voice agent for immediate viewing confirmation or specialized off-plan guidance. It leverages a dual-agent configuration (Gemini for text/logic, VAPI for voice).

## Step-by-Step Flow

1. **Lead Entry & Identification**
   - **Entry Points**: 
     - *Webhook*: `provident-bitrix-webhook.ts` triggers an initial message via `auroWhatsApp.ts`.
     - *Direct*: Incoming WhatsApp message to `whatsapp.ts`.
   - **Logic**: The handler identifies the lead by phone number in the `leads` table or creates a new entry.
   - **Context**: Existing lead data (budget, location, last property viewed) is fetched and injected into the AI's system prompt.

2. **WhatsApp Nurturing (AI Interaction)**
   - **Handler**: `netlify/functions/whatsapp.ts`.
   - **Processing**: Uses `gemini-2.0-flash` with a tool-enabled system instruction.
   - **Tool Use**:
     - `UPDATE_LEAD`: Captures name, budget, and preferences directly from chat.
     - `SEARCH_LISTINGS`: Fetches real-time inventory from `property_listings`.
     - `GET_PROPERTY_DETAILS`: Sends property cards and manages sequential image galleries.
   - **History**: All interactions (Incoming/Outgoing) are logged to the `messages` table.

3. **Booking & Escalation Decision**
   - **Triggers**:
     - Machine detected "Booking Intent" via `BOOK_VIEWING` tool.
     - Manual request for a call via `INITIATE_CALL` tool.
     - Off-plan interest via `OFFPLAN_BOOKING` tool.
   - **Off-plan Logic**: If the listing has a `payment_plan`, the AI offers a "3-Path" choice (Sales Centre, Video Call, or Voice Call).
   - **Agent Rotation**: The `get_next_sales_agent` RPC is called during the off-plan flow to assign a specialist based on community/developer.

4. **VAPI Voice Interaction**
   - **Escalation**: `whatsapp.ts` calls `https://api.vapi.ai/call` to initiate an outbound call.
   - **Voice Engine**: `vapi-llm.ts` acts as the LLM backend for the call, using the same RAG and listing tools as WhatsApp.
   - **Confirmation**: The voice agent resolves a viewing date/time and updates the `leads` table (`viewing_datetime`, `booking_status: 'confirmed'`).

5. **Closing & Notifications**
   - **Handshake**: On call end, `vapi.ts` logs the transcript and summary.
   - **Verification**: `booking-notify.ts` sends a WhatsApp/Email confirmation with a Cal.com link for management.
   - **Learning**: `rag-learn.ts` is notified of the outcome (qualified/booked) to optimize future RAG retrieval.

## Key Functions & Files

- `netlify/functions/whatsapp.ts`: Core text agent and tool coordinator.
- `netlify/functions/vapi-llm.ts`: Custom LLM implementation for voice calls.
- `lib/auroWhatsApp.ts`: Initial engagement logic and Twilio wrappers.
- `listings-helper.ts`: Database query abstraction for properties.
- `sql/create_sales_agents.sql`: RPC implementation for agent rotation.

## Tables & Fields Touched

| Table | Column(s) | Action |
|-------|-----------|--------|
| `leads` | `status`, `budget`, `property_type`, `viewing_datetime` | UPDATE (via tools) |
| `messages` | `content`, `type`, `sender`, `meta` | INSERT (Logging) |
| `property_listings` | (Various property fields) | SELECT (Read-only) |
| `sales_centre_agents` | `last_assigned_at`, `total_assignments` | UPDATE (Rotation) |

## Intent Logging
The system tracks high-level user intents in the `lead_intents_log` table to provide structured data for analytics and downstream automation. Unlike the `messages` table, which stores human-readable chat history, the intents log captures specific triggers:

- **booking_interest**: Detected when a user selects a property or asks for a viewing.
- **booking_confirmed**: Logged when a VAPI call successfully resolves a meeting time.
- **offplan_interest**: Triggered when a user interacts with off-plan specific tools.
- **vapi_status_update**: Capture call outcomes (machine, answered, human).
- **vapi_error**: Structured logs of telephony or AI errors during voice calls.

Each entry includes a `payload` JSON object containing the `property_id`, `source` (whatsapp/vapi), and any relevant meeting details.


## Gaps / Opportunities

1. **Bitrix Sync Back**: While inbound webhooks are handled, there is no automated "Push back to Bitrix" logic triggered upon qualification in the main handlers.
2. **Redundant Vapi Handlers**: Both `vapi.ts` and `vapi-llm.ts` exist; the split between webhook handling and LLM streaming logic could be more unified for clarity.
3. **Tool Context Duplication**: The `RAG_QUERY_TOOL` logic is duplicated across `whatsapp.ts`, `vapi.ts`, and `vapi-llm.ts`. Centralizing this into a library would improve maintenance.
