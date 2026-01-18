# WhatsApp Off-Plan Nurturing Skill

## Purpose & Scope
This skill optimizes WhatsApp conversations for leads inquiring about Dubai off-plan properties. It guides the `flow-specialist` agent to qualify leads effectively and move them toward a high-value commitment (a 30-minute consultation or a direct call).

- **Context**: Multi-tenant environment using `public.tenants` for configuration.
- **Goal**: Standardized, high-conversion qualification flow.
- **Variables utilized**: `tenant.system_prompt_identity`, `tenant.booking_cal_link`, `tenant.rag_client_id`.

---

## Conversation Design

### 1. Opening & Personalization
- **Action**: Always acknowledge the specific listing or area the user mentioned.
- **Template**: "Hi [Name], I saw your interest in the [Property Name] at [Area]. It’s a fantastic [Off-Plan/Ready] project. I’d love to help you get the latest pricing and availability."

### 2. The Qualification Cluster ("The Big 5")
To qualify an off-plan lead, ensure the following fields are captured (prioritize 1-2 per message):

1.  **Budget**: "What is your comfortable budget range for this investment (e.g., in AED or USD)?"
2.  **Area/Community**: "Are you specifically looking at [Area], or are you open to other high-yield communities like [Downtown/Creek Beach]?"
3.  **Property Type**: "Are you looking for an apartment, townhouse, or a luxury villa?"
4.  **Timeframe**: "How soon are you looking to secure a unit? (This month, 3-6 months, or just starting to explore?)"
5.  **Financing**: "Will this be a cash purchase, or would you be looking for mortgage options? (If mortgage, are you already pre-approved?)"

### 3. Trust Building & Positioning
- **Action**: Use `tenant.system_prompt_identity` to establish authority.
- **Strategy**: Share a brief market insight from RAG while asking a qualification question. 
- *Example*: "Units in [Area] have seen a [X]% capital appreciation recently. Does that align with your investment goals, or is this for personal use?"

### 4. Commitment Step (The Close)
Once 3 out of 5 qualification points are known, or if the lead shows high intent:

- **Path A (Self-Serve)**: "I’d suggest a 30-minute consultation with our Senior Off-Plan Specialist to walk through the payment plans. You can pick a slot here: [tenant.booking_cal_link]"
- **Path B (Live Handoff)**: "Would you like me to have one of our experts call you right now to discuss the floor plans?" (Trigger `INITIATE_CALL` if YES).

### 5. Re-engagement & Follow-up
- **Quiet Leads**: If a lead stops responding, follow up after 24 hours with a value-add: "Hi [Name], I just received an updated payment plan for [Project]. Would you like me to send it over?"
- **"Just Browsing"**: Pivot to education. "No problem! I can send you our Dubai Off-Plan Market Report for [Current Month] to help with your research."

---

## Behavior Rules

1.  **Ask, Don't Interrogate**: Maximum of 2 questions per message.
2.  **The Mirror Principle**: Reflect back what the user said before moving to the next question. ("Since you're looking for a luxury villa in Palm Jumeirah...")
3.  **Intent Priority**: If a lead asks "Can someone call me?", skip all remaining qualification points and trigger `INITIATE_CALL` immediately.
4.  **No Hard-Coding**: Never use "Provident". Always use the `tenant.system_prompt_identity` variable.
5.  **Data Persistence**: Ensure all captured fields (budget, area, etc.) are updated in the `leads` table via `UPDATE_LEAD`.

---

## Integration Details

- **Agents**: Used by `flow-specialist` to govern `netlify/functions/whatsapp.ts`.
- **Workflows**:
    - `/onboard-tenant`: Must verify `booking_cal_link` is set to enable this flow.
    - `/test-flow <tenant_id>`: Should simulate an off-plan inquiry to verify the sequence.

---

## Testing & Iteration

- **Test Scenario**: Simulate a lead from social media inquiring about "Emaar Beachfront".
- **A/B Testing**: Test if asking "Budget" or "Location" first leads to higher completion rates.
- **Feedback Loop**: Review `lead_intents_log` for `offplan_interest` to see where leads drop off.
