# Developer WhatsApp — FIRST TOUCH (not follow-up)

> **Why this exists:** Developers run on WhatsApp. Their inside-sales teams live in WhatsApp groups coordinating channel-partner leads, agent payouts, and launch leads. So for developers, **WhatsApp IS the primary outreach channel** — not the miss-followup it is for brokerages.
>
> "Hi, just tried you now" doesn't work here — we don't pretend we touched the phone first. We go straight to WhatsApp.

---

## 📱 The first-touch message (≤ 5 lines, single column)

```
Hi {first_name} — Phillip here, founder of AURO
(auroapp.com).

We built an AI lead-nurturing agent for real estate
ops teams. You run {size_signal — e.g. 5K+ units
across multiple projects} — usually saves those
teams ~6 hrs/week on lead routing.

Worth a 15-min look? → https://cal.com/auro-app/30min
```

---

## Variant for channel-partner / inside sales heads

Same message but the hook line changes:

> *"Your channel-partner pipeline across 200+ brokers"*
> *"The lead-routing from listing → broker to buyer"*
> *"Launch-week lead qualification"*

---

## ✅ Before sending

- [ ] Recipient's **mobile is verified WhatsApp** — if it's the same number that picks up a phone call, that's the right one
- [ ] **Personalised hook** = one fact about their pipeline / size / launch cadence
- [ ] One Cal.com link: `https://cal.com/auro-app/30min`
- [ ] Do NOT include the AURO deck PDF — it's pinned to AURO's website, send the link if they ask
- [ ] Do NOT include pricing language

---

## 🚫 Anti-patterns

- ❌ Audio notes to B2B — pros don't listen to 60 seconds of voice on WhatsApp
- ❌ Long walls of text — 5 lines max
- ❌ Multiple Cal.com reminders in one thread — once is enough
- ❌ Generic "we're an AI company that helps real estate" copy without their size fact
- ❌ "Just following up on this" — never say it. Next message should have NEW value, not request acknowledgement.

---

## 🎯 Outcomes → next state

| Response | State |
|---|---|
| "Yes, when works?" | `INTERESTED` → send Cal.com + email follow-up |
| "Tell me more" | `INTERESTED` → one-sentence no-price framing + Cal.com |
| "Not relevant / not now" | `WHATSAPP_REJECTED` → re-queue 90-day retry |
| No reply in 72 hrs | `WA_NO_REPLY` → LinkedIn DM (different channel = different stroke) |
| Read-but-no-reply after 7 days | `READ_COLD` → resurface at next industry event |

---

## 🔌 How to actually send

Existing Twilio sender is wired up — see `_send-test-wa.cjs` in `~/Downloads/2025/Auro App/`.

Minimum WhatsApp send command (from `Auro App/` directory):

```bash
node _send-test-wa.cjs "{E164 FORMAT}" "Hi Robert — Phillip here, ..."
```

E.164 format = country code + number, no spaces, no dashes.

For **bulk-sending centralised** by city/region (so you do all 5 Dubai developers Monday, 5 Riyadh devs Tuesday etc.), build a tiny script:

```bash
# pseudo: takes .csv → for each row with status NEW → sends WhatsApp
```

For now we do this **manually, one at a time** so you can spot whales and compose personalisation.

---

## ⚡ What makes DEVELOPER WhatsApp different from BROKERAGE WhatsApp

| Brokerage DM | Developer DM |
|---|---|
| Decision-maker wears many hats — slow to respond | Inside-sales floor lives in WhatsApp — fast responders |
| Voice territory (whatsapp = backup) | WhatsApp territory (voice = escalation) |
| Cold-call to MD = expected behaviour | Cold-call to CEO = can feel invasive |
| Cadence: 24-hr gaps | Cadence: 4-6 hrs gaps (matches their workflow) |
| Builder projects short-lived > channel partner permanent | Sales team is the permanent buyer relationship |
