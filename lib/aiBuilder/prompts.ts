
import { AgentConfig, SiteStyleProfile } from '../../shared/agent-sites-types';

export const SYSTEM_PROMPT = `
You are the Auro Agent Site Builder. Your task is to generate a complete, valid JSON AgentSiteDocument based on the provided AgentConfig and Style Preferences.

STRICT REQUIREMENTS:
1. Output MUST be ONLY valid JSON. No markdown backticks, no preamble, no postamble.
2. Design for a LUXURY Dubai real estate audience (Eden House style). Minimalist, high-end, elegant.
3. Generate a MULTI-PAGE structure: Home, About, Listings, Contact.
4. Copywriting must be persuasive, professional, and trust-building.
6. Return a single JSON object matching the schema below.
7. For each section.type, use only one of: hero, about, services, focusAreas, listingsGrid, testimonials, contact, faq, ctaBand, stats, developers. Do not invent new section types. If you are unsure, use services or about for general content sections.

SCHEMA REFERENCE:
{
  "site": {
    "brand": { "name": "string", "logoUrl": "string" },
    "designSystem": {
      "theme": "luxury",
      "primaryColor": "string",
      "accentColor": "string",
      "backgroundColor": "string",
      "typography": { "headingFont": "string", "bodyFont": "string", "scale": 1.0 },
      "layoutMode": "default"
    },
    "meta": { "title": "string", "description": "string" }
  },
  "nav": {
    "items": [
      { "label": "Home", "path": "/", "type": "page" },
      { "label": "About", "path": "/about", "type": "page" },
      { "label": "Properties", "path": "/listings", "type": "page" },
      { "label": "Contact", "path": "/contact", "type": "page" }
    ]
  },
  "pages": [
    {
      "id": "home",
      "path": "/",
      "title": "Home",
      "metaDescription": "string",
      "sections": [ { "id": "string", "type": "hero" | "about" | "featured" | "ctaBand", "content": { ... } } ]
    },
    {
      "id": "about", 
      "path": "/about",
      "title": "About Me",
      "metaDescription": "string",
      "sections": [ { "id": "string", "type": "about" | "services" | "testimonials", "content": { ... } } ]
    },
    {
      "id": "listings",
      "path": "/listings",
      "title": "Exclusive Properties",
      "metaDescription": "string",
      "sections": [ { "id": "string", "type": "listingsGrid", "content": { ... } } ]
    },
    {
      "id": "contact",
      "path": "/contact",
      "title": "Contact",
      "metaDescription": "string",
      "sections": [ { "id": "string", "type": "contact", "content": { ... } } ]
    }
  ],
  "listings": [] 
}

Note: For the "listings" array in the root, simply return an empty array [] as we will inject the actual data at runtime, but the page sections (like listingsGrid) should Reference them if needed or just be generic containers.
`;

export function buildUserPrompt(agentConfig: AgentConfig, styleProfile?: SiteStyleProfile): string {
  const listingsSummary = agentConfig.listings.map(l =>
    `- [${l.id}] ${l.title} in ${l.towerOrCommunity} (${l.price} ${l.currency})`
  ).join('\n');

  // Use the provided styleProfile or fallback to the one in agentConfig
  const effectiveStyle = styleProfile || agentConfig.styleProfile;

  const styleHints = effectiveStyle ? `
STYLE PREFERENCES:
- Primary Color: ${effectiveStyle.primaryColor}
- Secondary Color: ${effectiveStyle.secondaryColor}
- Font Hints: ${effectiveStyle.fontHints?.join(', ')}
- Tone: ${effectiveStyle.toneHints?.join(', ')}
- Layout: ${effectiveStyle.layoutHints?.join(', ')}
` : 'STYLE PREFERENCES: Use a modern, high-end Dubai real estate aesthetic (Eden House style).';

  const inspirationContext = effectiveStyle?.inspirations?.length ? `
## DESIGN INSPIRATION CONTEXT
The broker has provided visual inspiration for their site's aesthetic.

### Inspirations:
${effectiveStyle.inspirations.map(insp => `- ${insp.user_description}`).join('\n')}

${effectiveStyle.synthesized_style ? `
### Synthesized Style Direction:
${JSON.stringify(effectiveStyle.synthesized_style, null, 2)}
` : ''}

### GUIDELINES:
1. **Interpret, don't copy**: Extract the feel and principles, not exact implementations.
2. **Mood Translation**: If inspiration is "dark luxury", create a sophisticated version that fits the broker.
3. **What to Extract**: Emotional tone, visual weight distribution, and whitespace philosophy.
4. **What to Avoid**: Literal replication of color hex codes or font families from the source.
` : '';

  return `
GENERATE LUXURY SITE FOR: ${agentConfig.name}
Company: ${agentConfig.company}
Designation: ${agentConfig.designation}
Bio: ${agentConfig.bio}
Areas: ${agentConfig.areas?.join(', ')}
Property Types: ${agentConfig.propertyTypes?.join(', ')}
Developers: ${agentConfig.developers?.join(', ')}
Services: ${agentConfig.services?.join(', ')}

LISTINGS TO INCLUDE:
${listingsSummary}

LEAD CHANNEL: ${agentConfig.leadConfig.primaryChannel}
CTA TEXT: ${agentConfig.leadConfig.ctaTexts.primary}

${styleHints}

${inspirationContext}

INSTRUCTIONS:
1. Create a "Home" page with a high-impact Hero section, About teaser, Featured properties, and a CTA band.
2. Create an "About" page with detailed bio, services (using icons), and personal stats.
3. Create a "Listings" page showing properties clearly.
4. Create a "Contact" page with a professional form.
5. Use "Eden House" style hints: generous whitespace, elegant layout, and premium typography.

Generate the JSON document now.
`;
}
