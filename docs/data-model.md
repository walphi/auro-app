# AuroApp Data Model

This document classifies the Supabase tables into the three primary domains of the AuroApp ecosystem.

## Enterprise Lead Engine (B2B)
Focused on high-touch real estate workflows (e.g., Provident), WhatsApp-to-VAPI nurturing, and sales center booking.

| Table | Purpose | Key Relationships | Agent Writeable? |
|-------|---------|-------------------|------------------|
| `leads` | Central repository for B2B prospects. | - | **Yes** (Update status, add metadata) |
| `messages` | History of WhatsApp chats, transcripts, and notes. | `lead_id` → `leads.id` | **Yes** (Append new messages/notes) |
| `sales_centre_agents` | Directory of internal agents for appointment rotation. | - | No (Admin/Reference) |
| `lead_intents_log` | Structured logs of detected user intents (booking, objection, etc.). | `lead_id` → `leads.id` | **Yes** (Append logs) |
| `property_listings` | Real-time database of available inventory (ParseBot sync). | - | No (Source of truth) |

---

## Agent Sites Platform (B2C)
Focused on individual brokers using the "WhatsApp Site Builder" to create personal landing pages and manage their own leads.

| Table | Purpose | Key Relationships | Agent Writeable? |
|-------|---------|-------------------|------------------|
| `brokerages` | Multi-tenant parent organizations for agents. | - | No (Admin only) |
| `agents` | Brokers registered on the platform. | `brokerage_id` → `brokerages.id` | No (Managed by Clerk/Admin) |
| `agent_configs` | Profile, branding, bio, and site preferences for an agent. | `agent_id` → `agents.id` | **Yes** (Update bio, theme, areas) |
| `agent_site_documents` | AI-generated structured JSON for the React frontend. | `agent_id` → `agents.id` | **Yes** (Overwrite on site rebuild) |
| `site_conversations` | Conversation state for the B2C site builder bot. | `agent_id` → `agents.id` | **Yes** (Update bot state) |
| `enterprise_leads` | Leads captured from an agent's microsite. | `agent_id` → `agents.id` | **Yes** (Insert new leads) |
| `agent_domains` | Custom domain mapping for agent sites. | `agent_id` → `agents.id` | No (Managed by infra) |
| `agent_scrape_quotas` | Rate limiting for agent branding/data extraction. | `agent_id` → `agents.id` | **Yes** (Increment usage) |

---

## Shared / Infrastructure
Cross-cutting tables used by both domains or for system stability.

| Table | Purpose | Key Relationships | Agent Writeable? |
|-------|---------|-------------------|------------------|
| `knowledge_base` | RAG data for AI agents (files, URLs, text chunks). | `project_id` → `projects.id` | **Yes** (Add KB entries) |
| `rag_chunks` | Individual vector-embedded text segments. | `document_id` → `knowledge_base.id` | **Yes** (Add embeddings) |
| `ai_usage_logs` | Performance and cost tracking for LLM calls. | `agent_id` → `agents.id` (optional) | **Yes** (Append logs) |
| `scrape_cache` | Temporary storage for website scraping results. | - | **Yes** (Manage cache) |
| `site_analytics` | Rollup metrics for site traffic and interactions. | `agent_id` → `agents.id` | **Yes** (Update stats) |
| `agent_sessions` | Temporary state for active AI interactions. | - | **Yes** (Manage sessions) |
