# Auro App — Outbound Sales Operating System

> **Goal:** Get meetings on **Phillip Walsh's** calendar with decision-makers (MD / CEO / Founder / Head of Sales) at the world's leading real estate brokerages, developers, and luxury networks — for **AURO** (`https://auroapp.com`).
>
> **Doctrine:** Decision-makers only. No main switchboards. No admins. Manual voice call is channel #1. **Never disclose price or budget in outreach** — high-ticket positioning is part of the brand.
>
> **Reference proof:** Phillip personally cold-called the MD of **Christie's International Real Estate Dubai** via a number he found on their site. It booked a meeting. That is the template.

---

## 📦 What's in this folder

| File | Purpose |
|---|---|
| `master_leads.csv` | 30+ companies with verified data + decision-maker search status |
| `templates/voice_call_opener.md` | First-touch phone script (~30s) — Cal.com CTA, no price |
| `templates/whatsapp_miss_followup.md` | WhatsApp message sent within 60 min of voice miss |
| `templates/linkedin_dm.md` | LinkedIn direct message for non-callable leads |
| `templates/email_followup.md` | Email follow-up after voice or WhatsApp acknowledgement |
| `state.json` | Live state machine per lead (don't edit by hand — see "Daily cadence" below) |

---

## 🎯 The End-to-End Pipeline

```
RESEARCH  →  DM IDENTIFIED  →  CONTACTED  →  INTERESTED  →  MEETING BOOKED  →  MET  →  OPPORTUNITY  →  WON / LOST
   ▲             │                  │               │                  │
   │             ▼                  ▼               ▼                  ▼
 curl + grep   manual: name,    voice call   warm reply →         Cal.com link
 (batch)       direct line,    → WhatsApp    send Cal.com +       → confirm on
               mobile,         → LinkedIn    templated email       Phillip's Cal
               LinkedIn URL    → email
```

Success metric: **meetings on Phillip's calendar**, not leads in a spreadsheet.

---

## 📞 10/Day Cadence — The Daily Loop

Target: **50 outreach/week** (Mon–Fri, 10/day). Realistic split:

- **5 voice calls** (channel #1 — Christie's model)
- **3 WhatsApp messages** (after missed voice, or as primary when no direct line)
- **2 LinkedIn DMs** (for non-callable decision-makers)

### Morning routine (15 min)
1. Open `state.json` — today's 10 leads are pre-prioritised by `due_status`
2. Each row has a 1-line briefing (name · title · phone · hook)
3. Start dialing. Log every outcome in the row immediately

### After each touch
Append to that lead's row: `last_touch`, `last_outcome`, `next_action_due`

### State machine (per lead)

| State | Meaning | Next action |
|---|---|---|
| `NEW` | Company on list, DM not found yet | curl/LinkedIn for MD name + direct line |
| `DM_ID_FOUND` | Decision-maker name + line confirmed | Schedule for voice call |
| `CALLED_NO_ANSWER` | Voice went to voicemail | WhatsApp within 60 min |
| `CALLED_REACHED` | Spoke with decision-maker | Send Cal.com + email follow-up |
| `WA_SENT` | WhatsApp delivered | Wait 48 hrs, then LinkedIn if cold |
| `LI_SENT` | LinkedIn DM delivered | Wait 72 hrs, then email follow-up |
| `INTERESTED` | Prospect asked for pricing/details | Phillip calls within 24 hrs |
| `MEETING_BOOKED` | Cal.com filled by prospect | Send WhatsApp confirmation to Phillip's +971 number |
| `MET` | Meeting happened | Log outcome · next steps · follow-up due |
| `REJECTED` | Not interested / wrong fit | Move to `cold_pool`, retry in 90 days |
| `BOUNCED` | Number disconnected / no LinkedIn | Replace with secondary source |

---

## 🚫 The Anti-Patterns — What This System Will Never Do

1. **No mass mailing** — every outreach is to a single named person
2. **No price in the message** — even if they ask. "Happy to walk you through that on a call" only
3. **No "info@" emails** — fact: 0% of `info@` emails have ever booked a meeting at AURO. Decision-makers only.
4. **No automated AI voice by default** — Phillip calls manually (VAPI is a backup if volume must scale to 100+/week)
5. **No follow-up spam** — max 3 touches per lead before re-queueing for 90-day retry
6. **No "AI will replace your agents" pitch** — AURO is a lead nurturing agent, not a replacement. Wrong positioning kills the meeting.

---

## 🤝 How Phillip + This Automation Split the Work

| Who | Does what |
|---|---|
| **Automation (this system)** | Research · find DM by name + direct line · prep 1-page briefing · schedule · log outcomes · alert via WhatsApp |
| **Phillip** | Make the call · decide on price · send the Cal.com to warm leads · close |

---

## 🎯 Primary Target — DEVELOPERS (not brokerages)

**Why developers beat brokerages for AURO outreach:**

1. **Institutional budgets.** A 200-employee dev ops team signs for AI tooling; a 700-agent brokerage treats it as a line item competing with their existing lead-gen spend.
2. **WhatsApp-native sales floors.** Developer inside-sales teams coordinate broker leads in WhatsApp groups — they already understand the workflow AURO augments.
3. **Recurring revenue model.** Developers launch project after project — they have the same alerting / nurture need every quarter. Brokerages are one-off.
4. **Reachable by name + direct.** Chief Sales Officers / Inside Sales Directors publish their bios at Cityscape Global and MIPIM — direct mobile + WhatsApp are usually findable.
5. **Decision cycle is faster.** Tier-1 developers have procurement processes; mid-tier ones can sign in 2 weeks. Brokerages often cycle 6-12 weeks.

**Brokerages are kept as a SECONDARY tier** in the master CSV — call them only if the target developer outreach pipeline slows.

---

## 📞 Building a Verifiable Direct-Line for a Developer

There is no public list. Tactics in priority order:

1. **Conference speaker bios** — Cityscape Global Dubai, IPS Dubai, MIPIM Cannes, Big 5 Saudi. Speakers always publish their mobile. Required reading.
2. **Annual Report / Sustainability Report** — every public dev lists leadership with names + bios. Their CEO mobile is sometimes in there.
3. **LinkedIn "leadership" / "meet the team" page** — search "[Company name] leadership" on LinkedIn. Many devs publish bios publicly.
4. **Property Finder / Bayut / Dubizzle verified-agent profiles** — these carry the BD's mobile + WhatsApp ID.
5. **Channel broker WhatsApp groups** — most devs have channel-broker WhatsApp groups. Joining one gives you names + numbers of inside-sales managers.
6. **Switchboard workaround** — call the corporate number, **ask directly** "Hi I need to leave a message for Mr Alabbar" — the receptionist often gives you name spelling which you then LinkedIn-search for their personal mobile. Half the time you get their direct extension too.
7. **Industry publications** — Forbes MENA 30 under 30, Construction Week awards, MEED magazine. Bios carry mobile.

**The critical anti-pattern: NEVER use the corporate switchboard number as the "direct line" in the CSV.** Reception will not put you through. That number is for incoming customer service. Always aim for: mobile / WhatsApp / verified LinkedIn → direct DM.

---

## ❌ Three anti-patterns this system will never repeat

1. **No switchboard numbers as "DM direct line."** A landline is never a decision-maker's direct line. Reception routes it back to queues. Always verify type (= mobile / WhatsApp / LinkedIn-DM-able).
2. **No brokerages-only defaults.** Historically we built a CSV of UAE brokerages — but developers are the real fit. Brokerage outreach is secondary.
3. **No "phone-call-first" default for developers.** They live in WhatsApp. Calling them on switchboards is the wrong opener.

---

## 🔌 Existing infrastructure to plug into

- **Twilio WhatsApp** sender is wired up — templates go through `localhost:5500/send`
- **VAPI** is configured (`/lib/calCom.ts`, `/lib/vapi*`) — can be enabled per-lead if needed (call `node test_vapi_main_local.ts` for status)
- **Cal.com** = `https://cal.com/auro-app/30min` (already live on auroapp.com — verified July 2026)
- **Whales WhatsApp alert** to **+97150****0121** for MEETING_BOOKED transitions

---

## 🏃 Quick-start — what to do RIGHT NOW

1. Open `master_leads.csv` → filter to `target_priority = HIGH` and `phillip_has_dm != YES`
2. For each: find a verifiable direct channel via conferences / LinkedIn / annual reports
3. Start WhatsApp — send the `developer_whatsapp_opener.md` template
4. After each touch: log `state` in the CSV row immediately
5. When a meeting is booked → system sends WhatsApp to +97150****0121 → you prep

**The pitch is still one sentence:**

> *"Worth a 15-min look? AURO is an AI lead-nurturing agent for real estate ops teams — we built it for teams your size, would love to show you 1 workflow."*

That is it. No more.
