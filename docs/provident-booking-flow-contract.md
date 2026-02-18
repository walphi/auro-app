# Provident (Tenant 1) Booking & Notification Flow – Hard Contract

Tenant: **1 (Provident)**  
Owner: **Auro App**  
Scope: WhatsApp → Morgan (Vapi) → Cal.com → Bitrix → WhatsApp + Email notifications

> This document defines non‑negotiable behavior and tests for the Provident flow.  
> Any change that violates this contract is a regression.

---

## 1. Critical Outcomes (Must Always Happen)

For **every successful Morgan booking** for tenant 1:

1. **Cal.com booking**
   - A booking is created in Cal.com with:
     - Correct `start` in Dubai time (ISO, `+04:00`).
     - Correct attendee: `name`, `email`, `phoneNumber`, `timeZone: "Asia/Dubai"`, `language: "en"`.
     - Metadata including: `lead_id`, `tenant_id: "1"`, `budget`, `property_type`, `preferred_area`, `call_id`.
   - Example (2026‑02‑18 11:06 run):
     - `start: "2026-02-20T14:00:00+04:00"`
     - `meetingUrl: "https://meet.google.com/jhh-mzvw-fvd"`.[file:1056]

2. **Bitrix webhook + deal update**
   - `/netlify/functions/provident-bitrix-webhook` receives a **non‑empty POST** with JSON body containing:
     - `event: "BOOKING_CREATED"`
     - `bitrixId` (deal ID)
     - `lead_id`
     - `tenant_id: 1`
     - `phone` (E.164, `+9715…`)
     - `summary` (human-readable call + booking summary)
     - `transcript` (full call transcript text)
     - `booking.id`, `booking.start`, `booking.meetingUrl`, `booking.eventTypeId`
     - `structured.meetingscheduled: true`
     - `structured.meetingstartiso` (same as `booking.start`)
     - `structured.budget`, `property_type`, `preferred_area`.[file:1056]
   - Bitrix logs show:
     - `[BitrixBookingWebhook] Processing BOOKING_CREATED for BitrixID ...`
     - `Deal ... updated successfully`
     - `Add deal comment response: { result: <id>, ... }`.[file:1056]

3. **Post-call Auro summary**
   - After the call, the Auro summary process:
     - Posts a structured summary comment back to the same Bitrix deal, with harvested fields:
       - `preferred_area`, `meeting_scheduled`, `first_name`, `last_name`, `email`, `budget`, `property_type`, `phone`, `meeting_start_iso`.[file:1056]

4. **Post‑booking WhatsApp confirmation**
   - A WhatsApp message is sent to the lead’s WhatsApp number via the Provident Messaging Service.
   - Logs in `vapi.ts` must include:
     - `[MeetingConfirmation] Sending direct WhatsApp confirmation for tenant 1, lead=<leadId> to=<phone>`
     - `[WhatsApp Helper] Sending confirmation via Messaging Service: { to: '+9715...', messagingServiceSid: 'MG533f60...', bodyPreview: 'Your call about [Project Name] with Provident Real Estate has been scheduled.\nDate & time: [Day], [Month] [Date] at [Time] (Dubai Time)...' }`
     - `[Twilio] sendTextMessage success: { sid: 'SM...', status: 'accepted', to: 'whatsapp:+9715...' }`
     - `[WhatsApp Helper] Sent successfully. SID=SM...`.[file:1056]
   - The message body must include:
     - Project name (e.g. “The Edit at d3”).
     - Date and time in Dubai time.
     - Meeting URL (Cal.com / Google Meet).
     - Optional: link to Provident PDF / guide.

5. **Post‑booking email confirmation**
   - (If configured) An email is sent to the attendee with the booking time and link (as in the 2026‑02‑18 run).[file:1056]

If any of the above fail for tenant 1, the change is a **blocking regression**.

---

## 2. Files Covered by This Contract

Any change to **any** of these requires re‑running the regression checks in Section 4:

- `netlify/functions/whatsapp.ts`
- `netlify/functions/vapi.ts`
- `netlify/functions/provident-bitrix-webhook.ts`
- Cal.com integration helpers (booking creation, phone normalization)
- WhatsApp/Twilio helper modules used by this flow
- Email notification helpers used by this flow

---

## 3. Hard Rules

### 3.1 Webhook & Auth

1. `/netlify/functions/provident-bitrix-webhook`:
   - Must remain at the same path.
   - Must continue accepting authenticated `POST` requests with `BOOKING_CREATED` payloads.
   - Must log:
     - `[BitrixWebhook] Incoming request: POST /.netlify/functions/provident-bitrix-webhook | Body size: ...`
     - `[Webhook] Raw body (JSON): {...}` (for debugging/tracing).[file:1056]

2. Auth:
   - The auth secret must be passed from `vapi.ts` to the webhook in at least one of:
     - `?key=...` query parameter.
     - `x-auro-key` header.
     - `X-Webhook-Key` header.
   - The webhook must validate against one of the configured env vars (`AURO_PROVIDENT_WEBHOOK_KEY`, `BITRIX_WEBHOOK_KEY`, or `VAPI_WEBHOOK_SECRET`) and log:
     - On success: `[BitrixWebhook] Success status=200`.
     - On failure: `[Webhook] Unauthorized access attempt. Received key: ...` (this indicates a regression and must not occur in production runs).[file:1056]

### 3.2 Call intent & escalation (WhatsApp → Vapi)

1. Explicit call requests (tenant 1)  
   For messages like:
   - `"call me now"`
   - `"could someone call me now"`
   - `"can you call me now"`
   - `"please call me now"`
   - `"give me a call"`
   - `"call me please"`
   - `"i want a call"`
   - `"phone me"`
   - `"speak to a person"`
   - `"can you call"`
   the handler in `whatsapp.ts` must:
   - Detect them via `isExplicitCallRequest`.
   - Set the escalation condition to true (independent of offer window).
   - Immediately:
     - Log: `[IntentDetection] Escalating to Vapi call: positive call-confirmation detected.`
     - Call the Vapi outbound call initiator.
     - Set `skipGemini = true` so the message does **not** go back through Gemini-only chat.[file:1056]

2. Offer confirmation path  
   - If the last AI message explicitly offered a call and the user responds positively (e.g. “Yes”, “Sure”, “Ok, call me”), within the recency window, escalation must also trigger and log the same `[IntentDetection] Escalating...` line.

3. Negative intent  
   - `isNegative` must **not** treat “now” as “no” or otherwise block explicit call requests.
   - Only true negative replies (e.g. “no”, “no thanks”, “don’t call”, “stop calling”) should prevent escalation.

4. No regression of pre‑call WhatsApp  
   - When escalation triggers, WhatsApp must still send the pre‑call message:
     - e.g. “Great! I’m connecting you with an off-plan specialist now. You’ll receive a call in just a moment.”

### 3.3 No silent behavior changes

- Any change to:
  - WhatsApp templates (pre‑call or post‑booking),
  - Bitrix payload structure,
  - Cal.com phone normalization or booking metadata,
  - Call-intent conditions,
must be:
  - Documented in the PR and in the Changelog (Section 5).
  - Re‑validated with the regression checklist.

---

## 4. Regression Checklist (Run Before Merging)

For **every** PR that touches files in Section 2:

### 4.1 Automated contract test

- Run:
  - `npx tsx test_bitrix_webhook_contract.ts`
- This must assert that:
  - `/netlify/functions/provident-bitrix-webhook` receives a `BOOKING_CREATED` POST with non‑empty JSON.
  - JSON includes non‑empty `lead_id`, `phone`, `structured.meetingstartiso`.
  - HTTP status is `200`.

### 4.2 Live tenant‑1 booking test

Using a real WhatsApp + Morgan session for tenant 1:

1. Trigger:
   - Start via WhatsApp, escalate to a Morgan call, book a meeting (like the 2026‑02‑18 test: Friday, 2 PM).

2. Verify Cal.com:
   - Booking exists with the expected start time, attendee, metadata, and meeting URL.

3. Verify Bitrix logs (Netlify for `provident-bitrix-webhook`):
   - `Incoming request: POST ... Body size: ...`
   - `Raw body (JSON): {"event":"BOOKING_CREATED", ...}`
   - `[BitrixBookingWebhook] Processing BOOKING_CREATED for BitrixID ...`
   - `[BitrixClient] Deal ... updated successfully`
   - `Add deal comment response: { result: ..., ... }`

4. Verify WhatsApp logs (Netlify for `vapi.ts`):
   - `[MeetingConfirmation] Sending direct WhatsApp confirmation for tenant 1, lead=... to=+9715...`
   - `[WhatsApp Helper] Sent successfully. SID=SM...`

5. Verify WhatsApp device:
   - Pre‑call escalation message received.
   - Post‑booking confirmation received with correct project name, date/time, and link.

6. (Optional) Verify email:
   - Confirmation email received with matching date/time and link.

### 4.3 PR log snapshot

- In the PR description, include:
  - The key Bitrix webhook log block from the live test.
  - The `[MeetingConfirmation]` and `[WhatsApp Helper]` log lines from the same test.
  - The Cal.com booking `id` and `start` from the live test.

If any step fails, **do not merge**.

---

## 5. Changelog

- **2026‑02‑18** – Initial hard contract defined based on successful 11:06 AM run:
  - Cal.com booking 16064987 created for Fri 20 Feb 2026, 14:00 GST.
  - Bitrix deal 1060275 updated via `BOOKING_CREATED` webhook.
  - WhatsApp meeting confirmation sent with template:
    - “Your call about The Edit at d3 with Provident Real Estate has been scheduled. Date & time: Friday, February 20 at 2:00 PM (Dubai Time). Join the meeting: https://meet.google.com/jhh-mzvw-fvd …”
  - Pre‑call escalation and Auro summary both confirmed working.[file:1056]

