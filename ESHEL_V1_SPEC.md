# Eshel Properties v1.0 Technical Specification

**Version:** 1.0  
**Date:** March 26, 2026  
**Status:** PRODUCTION LIVE - NON-NEGOTIABLE CONTRACT  
**Tenant:** Eshel Properties (ID: 2)

---

## Executive Summary

This specification documents the complete, working lead nurturing and conversion pipeline for Eshel Properties. Any future modifications must maintain these exact behaviors, data flows, and integration points. This is the non-negotiable contract for the v1.0 release.

---

## System Architecture

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   HUBSPOT       │────▶│   WHATSAPP       │────▶│   RAG/GEMINI     │
│  (Lead Source)  │     │   (Entry Point)  │     │   (Nurturing)    │
└─────────────────┘     └──────────────────┘     └──────────────────┘
         │                                               │
         │                                               ▼
         │                                       ┌──────────────────┐
         │                                       │   LEAD ENGAGED   │
         │                                       │   (Qualification)│
         │                                       └──────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   HUBSPOT       │◀────│   CAL.COM        │◀────│   VAPI/EDGAR   │
│  (Timeline)     │     │   (Booking)      │     │   (Voice Call) │
└─────────────────┘     └──────────────────┘     └──────────────────┘
         │                      │
         └──────────────────────┘
              WHATSAPP CONFIRMATION
```

---

## Component Specifications

### 1. HubSpot Webhook Handler
**File:** `netlify/functions/eshel-hubspot-webhook.ts`

#### Trigger
- **Event:** `contact.creation`
- **Source:** HubSpot Webhooks API v3
- **Security:** HMAC-SHA256 signature verification
- **Replay Protection:** 5-minute window (`MAX_EVENT_AGE_MS = 5 * 60 * 1000`)

#### Behavior
1. Validates webhook signature using `CLIENT_SECRET`
2. Filters events older than 5 minutes
3. Extracts contact: `firstname`, `lastname`, `phone`, `email`, `objectId`
4. Normalizes phone: `normalizePhone(rawPhone)`
5. Resolves tenant: Eshel (ID: 2)
6. **MUST** send WhatsApp template via Twilio
7. **MUST** create/update lead in Supabase with:
   - `phone`
   - `name`
   - `email` (from HubSpot contact)
   - `status: 'New'`
   - `source: 'HubSpot'`
   - `tenant_id: 2`
8. **MUST** update email if lead exists but email differs from HubSpot
9. **MUST** log template message to Supabase as `AURO_AI` sender
10. Fire-and-forget: Creates HubSpot note "WhatsApp outreach sent"

#### Template Message Content
```
"Hi [FirstName], this is Eshel Properties. We received your enquiry, is now a good time to chat?"
```

#### Environment Variables
- `HUBSPOT_CLIENT_SECRET` - Webhook signature validation
- `AURO_SIDECAR_KEY` - CRM sync authentication
- `TWILIO_ACCOUNT_SID_ESHEL_T2` - Twilio account
- `TWILIO_AUTH_TOKEN_ESHEL_T2` - Twilio auth
- `ESHEL_T2_WHATSAPP_FROM` - Sender number (whatsapp:+15558874631)
- `ESHEL_T2_CONTENT_SID` - Template SID (HX7471...)
- `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database

---

### 2. WhatsApp Entry Point
**File:** `netlify/functions/eshel-whatsapp.ts`

#### Purpose
Thin wrapper that forces tenant resolution to Eshel via custom header.

#### Behavior
1. Injects header: `x-aurora-tenant: eshel`
2. Delegates ALL logic to core `whatsapp.ts` handler
3. Returns response as-is

#### Webhook URL (Twilio Configuration)
```
POST https://auro-app.netlify.app/.netlify/functions/eshel-whatsapp
Content-Type: application/x-www-form-urlencoded
```

---

### 3. Core WhatsApp Handler
**File:** `netlify/functions/whatsapp.ts`

#### Entry Points
- Standard Twilio webhook: `/.netlify/functions/whatsapp`
- Eshel-specific: `/.netlify/functions/eshel-whatsapp` (via wrapper)

#### Tenant Resolution (Priority Order)
1. Header override: `x-aurora-tenant` header
2. Twilio "To" number: `getTenantByTwilioNumber(toNumber)`
3. Default: `getDefaultTenant()` (Provident)

#### Message Processing Flow

**Step 1: Extract Message Data**
- `userMessage` from `body.Body`
- `fromNumber` normalized from `body.From`
- `numMedia` from `body.NumMedia`
- Media URLs from `body.MediaUrl0`, `body.MediaContentType0`

**Step 2: Lead Resolution**
- Lookup by phone in Supabase
- Create new lead if not exists: `name: "WhatsApp Lead {phone}"`
- Fetch lead context: budget, location, timeline, current_listing_id

**Step 3: Log Inbound Message**
- **MUST** insert to `messages` table:
  - `lead_id`
  - `type: 'Message'` or `'Voice'` (if audio)
  - `sender: 'Lead'`
  - `content: userMessage`
  - `meta` (media URL if present)

**Step 4: Intent Detection & Call Escalation**
- **CRITICAL:** Check for call escalation BEFORE nurturing

```typescript
// Call Escalation Logic (NON-NEGOTIABLE)
const wasLastMessageOffer = (
  lastAiText.includes("call you now") ||
  lastAiText.includes("Would you like a call now?") ||
  lastAiText.includes("Is now a good time?") ||
  lastAiText.includes("schedule a time for later") ||
  lastAiText.includes("consultation") ||
  lastAiText.includes("specialist call")
) && !lastAiText.includes("received your enquiry");  // EXCLUDE TEMPLATE

const shouldEscalate = (
  explicitCallRequest || 
  (wasLastMessageOffer && isRecentEnough && callAffirmative)
) && !negativeIntent;
```

**Step 5: If Escalating to Vapi**
1. Build WhatsApp conversation summary (last 10 messages):
   ```
   Lead: [message]
   Auro: [response]
   Lead: [message]
   ...
   ```
2. Call `initiateVapiCall(phoneNumber, tenant, context)` with:
   - `lead_id`
   - `name`
   - `whatsapp_summary`
3. Response: "Great! I'm connecting you with an off-plan specialist now..."
4. Skip Gemini (set `skipGemini = true`)

**Step 6: RAG Context Loading (If Not Escalating)**
- Auto-RAG: Detect project keywords in `userMessage`:
  - Keywords: "Hado", "Edit", "Talea", "PASSO", "LOOM", "Avenew", "Beyond", "Meraas", "Dubai South", "d3"
- If keywords found AND message length > 5:
  - Call `queryRAG(userMessage, tenant, ['campaign_docs', 'projects'])`
  - If no results, fallback to Perplexity web search
  - Store in `autoRagContext`

**Step 7: Gemini Agent Processing**
- Load chat history (last 12 messages from Supabase)
- Format for Gemini: roles alternate user/model
- System instruction includes:
  - Lead profile (budget, location, timeline)
  - RAG context (if available)
  - Eshel branding guidelines
  - Tool definitions: RAG_QUERY, SEARCH_LISTINGS, SHOW_IMAGE, BOOK_VIEWING, OFFPLAN_BOOKING
- Execute tools if called (max 2 turns)
- Generate response

**Step 8: Log AI Response**
- **MUST** insert to `messages` table:
  - `lead_id`
  - `type: 'Message'` or `'Voice'`
  - `sender: 'AURO_AI'`
  - `content: responseText`

**Step 9: CRM Sync**
- **MUST** trigger HubSpot sidecar for `whatsapp_inbound` and `whatsapp_outbound` events

---

### 4. Vapi Call Initiation
**File:** `netlify/functions/whatsapp.ts` (function `initiateVapiCall`)

#### API Endpoint
```
POST https://api.vapi.ai/call
Authorization: Bearer {VAPI_API_KEY}
```

#### Payload Structure
```typescript
{
  phoneNumberId: tenant.vapi_phone_number_id,
  assistantId: tenant.vapi_assistant_id,
  customer: {
    number: phoneNumber,
    name: context.name || "Client",
    email: context.email  // Only if present
  },
  assistantOverrides: {
    variableValues: {
      lead_id: context.lead_id,
      tenant_id: tenant.id.toString(),
      first_name: (name.split(' ')[0]),
      last_name: (name.split(' ').slice(1).join(' ') || ""),
      name: context.name,
      email: context.email,
      budget: context.budget,
      location: context.location,
      property_type: context.property_type,
      whatsapp_summary: context.whatsapp_summary,
      date_rules: "DATES AND TIMEZONE RULES (CRITICAL):\n- Timezone: Asia/Dubai (+04:00)\n- Calculate actual dates relative to today\n- Output ISO 8601 datetime with +04:00 offset"
    }
  }
}
```

#### Success Response
- Returns `true` if HTTP 201/200
- Logs: `[VAPI CALL] Call started successfully`

---

### 5. Vapi Server URL Handler
**File:** `netlify/functions/vapi.ts`

#### Purpose
Handles server-side events from Vapi during active calls

#### Events Handled

**A. assistant.started**
- Returns `assistantOverrides.variableValues` for the call
- **CRITICAL:** WhatsApp summary passed in variables
- Variables available to voice agent (Edgar):
  - `lead_id`, `tenant_id`
  - `first_name`, `last_name`, `name`, `email`
  - `budget`, `location`, `property_type`
  - `whatsapp_summary`
  - `date_rules`

**B. end-of-call-report / call-ended**
- Extracts: `summary`, `duration`, `callId`
- Gets `structuredData` from call analysis
- **MUST** trigger HubSpot sidecar for `vapi_call_ended`
- **MUST** pass `whatsappContext` (whatsapp_summary from variables)

**HubSpot Note Creation:**
```typescript
await triggerHubSpotSidecar(tenant, 'vapi_call_ended', leadData, syncSummary, undefined, {
  qualificationData: {
    budget: structuredData.budget || leadData?.budget,
    propertyType: structuredData.property_type || leadData?.property_type,
    area: structuredData.preferred_area || leadData?.location
  },
  vapi: { callId, summary: syncSummary, duration },
  whatsappContext: whatsappSummary  // NON-NEGOTIABLE: Must be included
});
```

**C. Tool Calls (during call)**
- **BOOK_VIEWING:** Creates Cal.com booking via `createCalComBooking()`
- **RAG_QUERY:** Queries vector database for project info
- **SEARCH_LISTINGS:** Searches property listings
- **OFFPLAN_BOOKING:** Handles off-plan booking options

---

### 6. Vapi Webhook Handler
**File:** `netlify/functions/vapi-webhook.ts`

#### Purpose
Receives asynchronous events from Vapi (separate from Server URL)

#### Events Handled

**A. end-of-call-report**
- Extracts: `analysis.summary`, `call.duration`, `call.id`
- Gets `structuredData` (meeting_scheduled, budget, property_type, etc.)
- Resolves lead by `varValues.lead_id` or phone number
- **MUST** trigger HubSpot sidecar for `vapi_call_ended`
- **MUST** pass `whatsappContext` from `varValues.whatsapp_summary`

**B. Booking Detection**
- Checks `structuredData.meeting_scheduled` or `analysis.bookingMade`
- If booking made:
  - Creates Cal.com booking
  - Stores in Supabase `bookings` table
  - Triggers `booking_created` sidecar to HubSpot
  - Returns 200 immediately (async processing)
- If no booking:
  - Awaits sidecar completion before returning

---

### 7. HubSpot CRM Sync (Sidecar)
**File:** `netlify/functions/eshel-hubspot-crm-sync.ts`

#### Authentication
- Header: `x-auro-sidecar-key`
- Must match `process.env.AURO_SIDECAR_KEY`

#### Supported Event Types
- `conversation_note` - General notes
- `booking_created` - Meeting scheduled
- `whatsapp_inbound` - Lead message
- `whatsapp_outbound` - AI response
- `vapi_call_ended` - Voice call completed

#### Vapi Call-Ended Note Format (NON-NEGOTIABLE)

```markdown
📞 AI Call Ended

📱 WhatsApp Conversation (before call):
[WhatsApp context from payload.whatsappContext]

🎙️ Voice Call Summary: [payload.vapi.summary]

📋 Qualification Details:
• Budget: [payload.qualificationData.budget]
• Property Type: [payload.qualificationData.propertyType]
• Preferred Area: [payload.qualificationData.area]
• Status: [payload.qualificationData.status]

⏱️ Duration: [payload.vapi.duration]s
🆔 Call ID: [payload.vapi.callId]
```

#### Booking Created Note Format (NON-NEGOTIABLE)

```markdown
Eshel Consultation Booked – [formattedTime] (Dubai Time) 
about [budget], [propertyType], [area].

Join the meeting: [meetingUrl]

📚 Explore Eshel's 2026 UAE Off-Plan Playbook: https://bit.ly/eshel-prop-uae-playbook
🏠 Explore Eshel's property portfolio: https://www.eshelproperties.com/property-listings
```

#### Data Flow
1. Receives sidecar payload
2. Validates tenant is HubSpot (`crm_type === 'hubspot'`)
3. Resolves or creates HubSpot contact by phone
4. **MUST NOT** update contact properties for qualification data (causes 400 errors)
5. Adds note to contact timeline via `syncLeadNote()`
6. Returns: `{ status: 'ok', contactId, created }`

---

### 8. CRM Router
**File:** `lib/crmRouter.ts`

#### Purpose
Routes CRM operations to appropriate backend (HubSpot only for v1)

#### syncLeadNote Behavior (NON-NEGOTIABLE)
- Upserts HubSpot contact by phone
- **ONLY** updates contact properties:
  - `firstname`, `lastname` (if real name, not placeholder)
  - `email`
  - `phone`
- **DOES NOT** update custom properties (budget_range, property_type, preferred_area, hs_lead_status)
- Adds note to contact via `hubspot.addContactNote()`
- Qualification data appears **ONLY** in note text, not as properties

---

### 9. Notification Orchestrator
**File:** `lib/notificationOrchestrator.ts`

#### Purpose
Unified, deduplicated post-meeting notifications

#### Deduplication Logic (NON-NEGOTIABLE)
1. Check `bookings.meta.whatsapp_confirmation_sent` by `booking_id`
2. If not found, check by `lead_id + meeting_start_iso`
3. If already sent, return `{ deduplicated: true }`
4. If not sent, proceed with notification and record status

#### WhatsApp Confirmation Message (NON-NEGOTIABLE)

```
Hi [FirstName], your call about [projectName] with Eshel Properties has been scheduled.
Date & time: [formattedDate] at [formattedTime] (Dubai Time).
Join the meeting: [meetingUrl]

In the meantime, you can explore Eshel's 2026 UAE Off-Plan Playbook here: https://bit.ly/eshel-prop-uae-playbook
```

#### Tenant-Specific Logic
- Eshel (ID: 2): Uses `TWILIO_ACCOUNT_SID_ESHEL_T2`, `TWILIO_AUTH_TOKEN_ESHEL_T2`
- From number: `ESHEL_T2_WHATSAPP_FROM`
- Brand name: `tenant.name || 'Eshel Properties'`

---

### 10. Cal.com Integration
**File:** `lib/calCom.ts`

#### API
```
POST https://api.cal.com/v2/bookings
Authorization: Bearer {CALCOM_API_KEY}
cal-api-version: 2024-08-13
```

#### Booking Payload
```typescript
{
  eventTypeId: details.eventTypeId,
  start: details.start,  // ISO 8601
  attendee: {
    name: details.name,
    email: details.email,
    phoneNumber: normalizedPhone,
    timeZone: 'Asia/Dubai',
    language: 'en'
  },
  metadata: {
    source: 'Auro Vapi AI'
  }
}
```

#### Response
- `bookingId`: `booking.id || booking.uid`
- `meetingUrl`: `booking.meetingUrl || booking.videoCallUrl` (Google Meet/Zoom)
- `uid`: Booking unique identifier

---

## Data Flow Specifications

### WhatsApp Conversation Summary Flow

```
[WhatsApp Handler]
    │
    ├──▶ Builds summary from last 10 messages
    │
    └──▶ Passes to initiateVapiCall()
              │
              └──▶ Stored in variableValues.whatsapp_summary
                        │
                        ├──▶ Vapi Server URL (assistant.started)
                        │       └──▶ Returns to voice agent (Edgar)
                        │
                        └──▶ Vapi Webhook (end-of-call-report)
                                └──▶ Extracts from varValues
                                        │
                                        └──▶ triggerHubSpotSidecar()
                                                  │
                                                  └──▶ eshel-hubspot-crm-sync.ts
                                                            │
                                                            └──▶ Formatted in note as "📱 WhatsApp Conversation"
```

### Meeting URL Flow

```
[Vapi/Edgar creates booking]
    │
    ├──▶ BOOK_VIEWING or Cal.com API
    │       │
    │       └──▶ Cal.com creates meeting
    │               │
    │               └──▶ Returns meetingUrl (Google Meet)
    │
    └──▶ Stored in Supabase bookings table
              │
              ├──▶ Trigger booking_created sidecar
              │       │
              │       └──▶ HubSpot note includes meetingUrl
              │
              └──▶ Trigger notification orchestrator
                      │
                      └──▶ WhatsApp confirmation includes meetingUrl
```

---

## Environment Variables (Production Required)

### Eshel Twilio (WhatsApp)
- `TWILIO_ACCOUNT_SID_ESHEL_T2`
- `TWILIO_AUTH_TOKEN_ESHEL_T2`
- `ESHEL_T2_WHATSAPP_FROM` (whatsapp:+15558874631)
- `ESHEL_T2_CONTENT_SID` (Template: HX7471...)

### Vapi
- `VAPI_PHONE_NUMBER` or per-tenant config
- `VAPI_ASSISTANT_ID_ESHEL` or tenant row config

### Cal.com
- `CALCOM_API_KEY`

### HubSpot
- `AURO_SIDECAR_KEY`

### Supabase
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### HubSpot Webhook
- `HUBSPOT_CLIENT_SECRET`

---

## Testing Checklist

### Phase 1: HubSpot Integration
- [ ] Create contact in HubSpot with phone +971...
- [ ] Verify webhook fires to eshel-hubspot-webhook.ts
- [ ] Verify WhatsApp template sent within 30 seconds
- [ ] Verify lead created in Supabase with email from HubSpot
- [ ] Verify template message logged as AURO_AI

### Phase 2: WhatsApp Nurturing
- [ ] Reply "Yes" to template
- [ ] Verify nurturing response (not immediate Vapi escalation)
- [ ] Ask about "Dubai South" or "The Pulse"
- [ ] Verify RAG context loaded and specific project facts provided
- [ ] Verify WhatsApp messages appear in HubSpot timeline

### Phase 3: Call Escalation
- [ ] Request "call me now" during nurturing
- [ ] Verify Vapi call initiated
- [ ] Verify call connects to Edgar with full context
- [ ] Complete call, book meeting
- [ ] Verify HubSpot note appears with:
  - [ ] 📞 AI Call Ended header
  - [ ] 📱 WhatsApp Conversation (before call)
  - [ ] 🎙️ Voice Call Summary
  - [ ] 📋 Qualification Details
  - [ ] ⏱️ Duration and Call ID

### Phase 4: Booking & Confirmation
- [ ] Verify Cal.com booking created
- [ ] Verify booking_created note in HubSpot with:
  - [ ] Meeting time, project, budget
  - [ ] Google Meet link
  - [ ] Playbook link: https://bit.ly/eshel-prop-uae-playbook
  - [ ] Portfolio link: https://www.eshelproperties.com/property-listings
- [ ] Verify WhatsApp confirmation received with Meet link and playbook

---

## Non-Negotiable Behaviors

### CRITICAL: No Regression Allowed

1. **Template Exclusion**
   - The initial template message MUST be excluded from call escalation detection
   - Check: `!lastAiText.includes("received your enquiry")`

2. **Email Sync**
   - HubSpot email MUST flow to Supabase lead record
   - Vapi MUST receive email to prevent "customer.email must be an email" errors

3. **WhatsApp Context in Notes**
   - Every `vapi_call_ended` note MUST include WhatsApp conversation history
   - Field: `whatsappContext` in sidecar payload
   - Displayed as: "📱 WhatsApp Conversation (before call):"

4. **Qualification Data in Notes**
   - Budget, property type, area, status MUST appear in note text
   - MUST NOT appear as HubSpot contact properties (causes 400 errors)

5. **Deduplication**
   - WhatsApp confirmations MUST be idempotent
   - Check: `bookings.meta.whatsapp_confirmation_sent` OR `lead_id + meeting_start_iso`

6. **Playbook Link**
   - Must use short link: `https://bit.ly/eshel-prop-uae-playbook`
   - Must appear in WhatsApp confirmations and HubSpot booking notes

7. **Portfolio Link**
   - Must use: `https://www.eshelproperties.com/property-listings`
   - Must appear in HubSpot booking notes

8. **Google Meet Links**
   - Cal.com returns meetingUrl (Google Meet)
   - Must flow to WhatsApp confirmations and HubSpot notes
   - NOT Cal.com URLs in user-facing communications

---

## Future Modification Guidelines

Any changes to this system MUST:

1. **Maintain backward compatibility** with existing HubSpot contacts
2. **Preserve all note formatting** specified above
3. **Keep WhatsApp context flowing** to HubSpot for every call
4. **Not introduce new required HubSpot properties** without migration plan
5. **Maintain idempotency** for all notification triggers
6. **Pass regression tests** against all scenarios in Testing Checklist

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-26 | Phillip Walsh | Initial production specification |

**Status:** LIVE - NO MODIFICATIONS WITHOUT VERSION BUMP AND APPROVAL

---

## Support & Escalation

For questions about this specification:
1. Review code comments in referenced files
2. Check Netlify function logs: `netlify logs:function --function={name}`
3. Verify HubSpot contact timeline for expected notes
4. Test end-to-end flow with checklist above

**End of Specification**
