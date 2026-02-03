---
name: auro-campaign-builder
description: Orchestrates the creation of a full real estate brokerage campaign including WhatsApp funnels, landing pages, and email nurture sequences.
---

# Auro Campaign Builder

This skill orchestrates the creation of a complete marketing campaign for a real estate project or brokerage within the Auro ecosystem.

## 🔗 Related Skills
- `page-cro`: For landing page optimization
- `email-sequence`: For nurture campaigns
- `twilio-communications`: For WhatsApp configuration
- `voice-agents`: For Vapi voice AI setup
- `copywriting`: For ad and page copy

## 🚀 Campaign Workflow

### 1. Campaign Definition
Define the core parameters of the campaign:
- **Project/Development**: (e.g., "Emaar Beachfront", "Sobha Hartland")
- **Target Audience**: (e.g., "Investors", "End-users", "Luxury buyers")
- **Key Selling Points**: (ROI, Location, Payment Plan)
- **Offer**: (e.g., "Download Brochure", "Book Viewing", "Register Interest")

### 2. WhatsApp Funnel Configuration
Configures the entry point in `netlify/functions/whatsapp.ts`:
- **Entry Trigger**: Define keywords or ad payloads (e.g., `listing_id`, `utm_source`).
- **Qualification Flow**: Determine requisite lead data (Budget, Timeline, Nationality/Residency).
- **Asset Delivery**: Configure brochure/floorplan PDF delivery via WhatsApp.
- **AI Persona**: Set system prompt context for the specific project.

### 3. Landing Page & Micro-site
Generates or updates the project landing page:
- **Hero Section**: High-impact visuals + Value Prop + CTA.
- **Project Details**: Location map, amenities, floor plan gallery.
- **Lead Capture Form**: Integrated with Supabase `leads` table.
- **Vapi Integration**: "Talk to AI Agent" floating widget or CTA.

### 4. Nurture Sequence (Email + WhatsApp)
Sets up the follow-up cadence:
- **Day 0**: Immediate WhatsApp brochure delivery + Welcome Email.
- **Day 1**: "Did you see the floorplans?" (WhatsApp/SMS).
- **Day 3**: "Investment Analysis" or "Community Tour" video email.
- **Day 7**: "Final logic/Scarcity" push.

## 🛠️ Implementation Steps

1.  **Database**: Ensure `listings` or `projects` table has the entry.
2.  **Assets**: Confirm images/PDFs are in Supabase Storage or S3.
3.  **Edge Functions**: Update `whatsapp` and `vapi` functions with specific routing logic if needed.
4.  **Frontend**: Deploy landing page to `auro.app/projects/<slug>`.

## 💡 Best Practices
- **Speed to Lead**: WhatsApp AI agent should engage within 5 seconds of lead form submission.
- **Omnichannel**: Ensure context travels from Landing Page -> WhatsApp -> Voice Call.
- **Tracking**: All links must have `utm_source`, `utm_medium`, `utm_campaign`.
