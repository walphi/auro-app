# Voice Call Opener — 30s script

> **Use when:** you've got the **direct mobile / direct WhatsApp** of a confirmed decision-maker (MD / CEO / Founder / Head of Sales / Inside Sales Director). **NEVER use a corporate switchboard or landline — those route to reception first** and the decision-maker won't be the one who answers.
> **Goal:** book a 15-min Cal.com meeting. **Never** lead with price.
>
> **Channel-by-target rules** (see also `developer_whatsapp_opener.md`):
>
> | Target type | Channel #1 | Channel #2 | Channel #3 |
> |---|---|---|---|
> | Brokerage decision-maker | Voice | WhatsApp | LinkedIn |
> | Developer decision-maker | **WhatsApp** | Voice | Email |
> | Global network (Sotheby's / Christie's) | LinkedIn | Voice | Email |
>
> Developers run on WhatsApp — calling their reception phone is borderline rude. Bugs them.

---

## 🎬 The script (memorise, don't read)

> *"Hi {first_name}, this is Phillip Walsh from AURO — do you have 30 seconds?*
>
> *Reason for the call: we built an AI lead-nurturing agent for real estate operations. You're running 750 agents / a large portfolio — we'd love to show you one workflow on a 15-min call that typically saves a team your size around six hours a week. It's free to look at.*
>
> *Can I send you a Cal.com link? {wait - if yes} - great, dropping it in your WhatsApp now. {send Cal.com link to direct number}."*

If they push on price on the call:
> *"Pricing depends on what you're trying to solve — happy to walk through that on the 15-min. The first step is just a look at the system."*

If they ask competitors:
> *"We don't really position against anyone specifically — every operation is different. The 15-min is more about learning what you do, then showing what we solve for ops teams like yours."*

If "not interested":
> *"No problem at all. If anything shifts in Q3, my direct is +971 · I'll drop you a note in October. Thanks for the time."*

---

## ✅ Before you dial checklist

- [ ] Lead's **first name** known
- [ ] **Direct line** in CSV (NOT main switchboard)
- [ ] **One fact about the company** ready as a personalised hook (e.g. "your Forbes Global Properties membership" / "the 750 licensed agents")
- [ ] **Cal.com link** ready to send via WhatsApp: `https://cal.com/auro-app/30min`
- [ ] 5-min buffer in your calendar after the call

## 🎯 Outcomes → next state

| What happened | What you do | New state |
|---|---|---|
| Reached decision-maker, they agreed to look | Send Cal.com via WhatsApp immediately | `CALLED_REACHED` |
| Reached gatekeeper / admin | Ask politely for direct line OR best callback time. Don't push. | `CALLED_GATEKEEPER` |
| Voicemail | WhatsApp the Cal.com link with a short text (see WhatsApp template) | `CALLED_NO_ANSWER` |
| Decision-maker said busy | "When's a good day next week?" — schedule follow-up | `CALLBACK_SCHEDULED` |
| "We already use a CRM" | "Got it — we're a lead-nurturing layer on top of whatever CRM you use. Worth 15 min?" | keep going |
| "Not relevant" / "no" | "No worries, thanks for the time." Move to cold pool | `REJECTED` |

## 🚫 Never say on a call

- ❌ "I'm calling on behalf of AURO" — be human, say "I'm Phillip" first
- ❌ "We automate your agents" — AURO is lead nurturing, not agent replacement
- ❌ "It costs X per month" — NEVER (high-ticket positioning)
- ❌ "I'll send you a brochure" — brochure = dead lead. Send the Cal.com link.
- ❌ Any vendor name they don't know — keep it AURO + auroapp.com only
