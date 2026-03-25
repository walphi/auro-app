# Production Readiness Audit: Tenant 1 (Provident)

**Date:** 2026-02-20
**Scope:** Vapi, Twilio, DidLogic, Gemini, Bitrix, Supabase, Cal.com integration.

---

## 1. Production-Readiness Checklist

### Security & Authentication
- [ ] **Secure `vapi.ts` Webhook:** Implement Vapi signature verification (or at least a secret token check) to prevent unauthorized POSTs spoofing calls.
- [ ] **Secure `send-meeting-confirmation.ts`:** **CRITICAL.** Currently appears open to the public. Add `x-auro-key` or similar shared secret validation immediately.
- [ ] **Twilio Signature Validation:** Ensure `whatsapp.ts` validates that requests actually come from Twilio (X-Twilio-Signature).
- [ ] **Least Privilege Database Access:** Verify Supabase client in functions uses a role with minimum necessary permissions (currently uses `SUPABASE_SERVICE_ROLE_KEY` which is full admin).

### Logging & Privacy
- [ ] **PII Redaction:** Logs currently output full phone numbers, names, and transcript contents. Implement a redaction helper for `console.log`.
- [ ] **Structured Logging:** Move from `console.log` string interpolation to structured JSON logging for better observability in Netlify/Datadog.
- [ ] **Log Retention:** Ensure logs in Netlify/Supabase have an expiration policy to comply with data privacy laws (e.g., GDPR/local regulations if applicable).

### Reliability & Error Handling
- [ ] **Bitrix Webhook Idempotency:** Ensure `provident-bitrix-webhook.ts` handles duplicate webhooks gracefully (Bitrix often retries on timeout).
- [ ] **Dead Letter Queue (DLQ):** If Cal.com or Bitrix APIs fail, failed payloads should be stored (e.g., in a Supabase `failed_events` table) for retry.
- [ ] **Vapi Fallback:** If `vapi.ts` fails to trigger the Bitrix webhook, is there a background job to sweep and retry?
- [ ] **Timeouts:** Netlify functions have a 10s (or 26s) limit. specific `whatsapp.ts` flows (RAG + Gemini) might exceed this. Ensure strict timeouts are enforced to avoid hanging requests.

### Tenant Isolation
- [ ] **Strict Tenant ID Enums:** Move away from magic number `tenant.id === 1`. Use a configuration constant or Enum.
- [ ] **Database Row Level Security (RLS):** Ensure explicit `tenant_id` filters are applied on *every* database query (Leads, Messages).
- [ ] **Hard Contract Monitoring:** Automated alerts if the "Hard Contract" conditions (e.g., Cal.com booking without Bitrix update) are violated.

### Rate Limits & Billing
- [ ] **Twilio Rate Limiting:** Handle WhatsApp rate limits (marketing conversations vs utility).
- [ ] **Gemini Quotas:** Catch `429 Too Many Requests` from Gemini and fail gracefully (e.g., fallback to simple rule-based response).
- [ ] **Vapi Cost Controls:** Set max duration limits on Vapi calls to prevent runaway billing on stuck calls.

---

## 2. Current State Assessment

| Category | Item | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Auth** | Bitrix Webhook Security | ✅ Satisfied | Checks `x-auro-key` / query param against env vars. |
| **Auth** | Vapi Webhook Security | 🔴 **Missing** | `vapi.ts` accepts any POST request. |
| **Auth** | Meeting Confirmation API | 🔴 **Critical** | `send-meeting-confirmation.ts` has no auth checks. |
| **Logging** | Visibility | ⚠️ Partial | Extensive logs exist, but they are unstructured and contain PII. |
| **Logic** | Hard Contract Compliance | ✅ Satisfied | Logic explicitly prioritizes Tenant 1 requirements (Cal.com + Bitrix + WhatsApp). |
| **Logic** | Call Escalation | ✅ Satisfied | `isExplicitCallRequest` and escalation logic are robust. |
| **Isolation** | Tenant Separation | ⚠️ Risky | Relies on code checks (`if tenant.id === 1`). No DB-level enforcement visible in these files. |
| **Reliability**| Error Handling | ⚠️ Partial | `try-catch` blocks exist, but no retry mechanism for failed external API calls (Cal.com/Bitrix). |

---

## 3. Go-Live Risk Report

### Top 5 Risks & Mitigations

#### 1. Unauthorized WhatsApp Spam (Critical)
**Risk:** The `send-meeting-confirmation.ts` endpoint is unauthenticated. A malicious actor could discover this URL and send fake meeting confirmations to arbitrary numbers using your Twilio credentials, causing reputation damage and billing spikes.
**Mitigation:** Immediately add `x-auro-key` validation (same as `provident-bitrix-webhook.ts`) to this function.

#### 2. Spoofed Vapi Calls
**Risk:** `vapi.ts` does not verify the requester. run-away costs or fake data injection could occur if someone POSTs fake "call-ended" events.
**Mitigation:** Verify `x-vapi-secret` (if available) or add a shared secret query parameter to the webhook URL configured in Vapi dashboard.

#### 3. Bitrix Sync Failures (Silent Failures)
**Risk:** If the Bitrix API is down or times out when `triggerBitrixBookingWebhook` is called, the deal update is lost forever. The "Contract" fails.
**Mitigation:** Wrap the Bitrix call in a retry utility with exponential backoff (up to 3 times). Log definitive failures to a `sync_failures` table for manual reconciliation.

#### 4. PII Leakage in Logs
**Risk:** Full names, phone numbers, and conversation transcripts are being logged to Netlify console (and likely persisted). This violates privacy best practices.
**Mitigation:** Implement a `logger.info(msg, meta)` helper that automatically masks E.164 phone numbers and truncates transcripts before printing.

#### 5. "Magic Number" fragility
**Risk:** The codebase is littered with `if (tenant.id === 1)`. If Provident's ID changes or a second enterprise tenant is added, the logic becomes unmaintainable and prone to regression (applying Provident logic to others).
**Mitigation:** Move tenant-specific flags to the `Tenant` configuration object (e.g., `tenant.flags.enforce_hard_contract`, `tenant.integrations.bitrix_webhook_url`).

---

## 4. Recommendations for Immediate Action

1.  **Lock down `send-meeting-confirmation.ts`** today.
2.  **Add PII redaction** to the logging helper before high-volume traffic starts.
3.  **Implement a `failed_syncs` table** in Supabase to catch dropped Bitrix webhooks.
