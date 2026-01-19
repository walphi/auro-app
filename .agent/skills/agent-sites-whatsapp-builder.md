---
name: agent-sites-whatsapp-builder
description: Guidelines for the WhatsApp onboarding flow for real estate agent sites.
---

# Agent Sites WhatsApp Builder Skill

This skill encodes the ideal question flow and guardrails for onboarding real estate agents onto the Auro Agent Sites platform via WhatsApp.

## Onboarding Flow: Bio → Branding → Focus

### Phase 1: Bio (Professional Identity)
1.  **Name**: Capture full name.
2.  **RERA/BRN**: Capture and validate the RERA/BRN number (if provided).
3.  **Company**: Capture the brokerage name.
4.  **Designation**: Capture the agent's professional title (e.g., "Senior Consultant").
5.  **Bio**: Capture a short, professional biography for the "About" section.
6.  **Photo**: Request a high-quality professional profile photo. Accept both image uploads and URLs.

### Phase 2: Branding (Visual Identity)
1.  **Style Inspiration**: Request a screenshot or URL of a premium website the agent admires.
    - *Guardrail*: If a URL is provided, analyze the site's aesthetic (don't just scrape content).
    - *Iterative Choice*: Offer to add a second inspiration to synthesize a unique style.
2.  **Colors**: Capture primary and secondary brand colors (hex codes or descriptions).
3.  **Logo**: Request a company logo (optional, allow "skip").

### Phase 3: Focus (Expertise & Content)
1.  **Areas**: Capture specialization areas (e.g., "Palm Jumeirah", "Downtown").
2.  **Property Types**: Capture focus areas (e.g., "Penthouses", "Villas").
3.  **Developers**: Capture preferred developers (e.g., "Emaar", "Ellington").
4.  **Services**: Capture service offerings (e.g., "Sales", "Property Management").
5.  **Listings**: Guide the user to share Bayut/Property Finder URLs or enter details manually.

## Guardrails & Best Practices

- **Validation**: Ensure RERA numbers are reasonably formatted.
- **Media Handling**: Proactively notify the user when an image is received and stored.
- **State Persistence**: Always save progress to `site_conversations.state_data` to allow for session recovery.
- **Tone**: Maintain a professional, encouraging, and efficient tone. Use emojis sparingly but effectively.
- **Preview First**: Always provide a preview URL (e.g., `auroapp.com/sites/slug`) and wait for an "approve" or "publish" command before final build.
