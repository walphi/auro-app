# WhatsApp — Voice-Miss Follow-up

> **Use when:** you called the decision-maker direct line and it went to voicemail (or no answer within 4 rings). Send within **60 minutes** of the missed call — context is still warm.

---

## 📱 The message (≤ 4 lines, single column)

```
Hi {first_name} — just tried you now.
Quick context:
I'm Phillip from AURO (auroapp.com) — we're an
AI lead-nurturing agent for global real estate ops.

Worth a 15-min look? → https://cal.com/auro-app/30min
No pressure either way.
```

---

## ✅ When to send

- **Within 60 min** of the missed call (warm context)
- Skip if the voicemail already invited a callback ("call me back anytime")
- Send **as text** not as PDF/image — keeps the read-rate high

## 🚫 Never send

- ❌ Length > 4 lines — pros don't read WhatsApp walls
- ❌ Audio notes to B2B senior decision-makers
- ❌ Multiple cal.com reminders in the same thread
- ❌ Pricing language ("from $X")

## 🎯 Outcomes → next state

| What happened | New state | Next action |
|---|---|---|
| **Replied with interest** ("OK / when works") | `INTERESTED` | Send Cal.com + log → Phillip calls within 24 hrs |
| **Replied with "send details"** | `INTERESTED` | Send Cal.com + ONE sentence no-price framing |
| **Replied polite decline** ("not now") | `WHATSAPP_REJECTED` | Re-queue 90-day follow-up |
| **No reply after 48 hrs** | `WA_NO_REPLY` | LinkedIn DM after 72 hrs (see LinkedIn template) |

---

## 🛠 How to send (existing infrastructure)

There are existing tools in `~/Downloads/2025/Auro App/` to send WhatsApp:

- `_check-wa.cjs` — check sender configuration
- `_send-test-wa.cjs` — template for outbound testing
- localhost:5500/send or `sendWhatsApp` helper (working as of July 2026 per Hermes memory)

> **Quick command-line send** (from `Auro App/`):
> ```bash
> node _send-test-wa.cjs "{E164_phone}" "Hi Simon — just tried you now. ..."
> ```
