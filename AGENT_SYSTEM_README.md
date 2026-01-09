# Auro Multi-Agent System Deployment Guide

This guide describes how to deploy and configure the new multi-agent architecture for Auro App.

## Architecture Overview

- **Edge Intents (`/edge/intents`)**: Netlify Edge Function that parses WhatsApp messages using FunctionGemma 270M (simulated or optimized local execution).
- **Orchestrator (`/functions/orchestrator`)**: Routes parsed intents to specialized agents.
- **Specialized Agents (`/functions/agents/*`)**: Isolated agents for Site, Listing, Theme, Content, and CRM actions.
- **Supabase**: Persistent storage for agent intents and sessions.

## Routing Matrix

| Channel | Webhook/Entry Point | Backend Flow |
| :--- | :--- | :--- |
| **Twilio (Auro broker site number)** | `/functions/whatsapp-agent-sites` | Edge + Orchestrator + Agents |
| **Twilio (Provident nurturing number)** | `/functions/whatsapp` | Legacy nurturing logic (unchanged) |

## Environment Variables (.env)

Ensure the following environment variables are set in your Netlify dashboard:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
USE_GEMMA_EDGE=true
FUNCTION_GEMMA_PATH=/models/functiongemma-270M
CLAUDE_API_KEY=your_anthropic_key
```

## Deployment Steps

1.  **Database Migration**: Run the SQL migration located in `sql/20260109_agent_system.sql` in your Supabase SQL Editor.
2.  **Deploy Edge Function**: Ensure `netlify/edge-functions/intents.ts` is deployed. Update `netlify.toml` if needed (see section below).
3.  **Deploy Functions**: Deploy the `orchestrator` and the `agents` folder within `netlify/functions`.
4.  **Twilio Configuration**: For the Auro broker site number, set the WhatsApp webhook to: `https://your-app.netlify.app/.netlify/functions/whatsapp-agent-sites`. The `whatsapp-agent-sites` function will invoke the edge intents endpoint (or be routed through it via `netlify.toml`), so the public webhook URL does not change.

## Netlify Configuration (`netlify.toml`)

Add the following snippet to your `netlify.toml` to enable the edge function:

```toml
[[edge_functions]]
function = "intents"
path = "/edge/intents"
```

## Fallback Logic

If FunctionGemma fails or is disabled (`USE_GEMMA_EDGE=false`), the system automatically falls back to the orchestrator layer, which can leverage Claude for intent parsing or use legacy logic. All decisions are logged in the `agent_intents_log` table for analysis.

## Legacy Integration

> [!IMPORTANT]
> **Do not modify `netlify/functions/whatsapp.ts`.** That function continues to serve the existing Provident Real Estate lead‑nurturing flow and is out of scope for this architecture.
