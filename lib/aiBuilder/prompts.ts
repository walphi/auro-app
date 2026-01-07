
import { AgentConfig, SiteStyleProfile } from '../../shared/agent-sites-types';

export const SYSTEM_PROMPT = `
You are the Auro Agent Site Builder. Your task is to generate a complete, valid JSON AgentSiteDocument based on the provided AgentConfig and Style Preferences.

STRICT REQUIREMENTS:
1. Output MUST be ONLY valid JSON. No markdown backticks, no preamble, no postamble.
2. Design for a LUXURY Dubai real estate audience (Eden House style). Minimalist, high-end, elegant.
3. Generate a MULTI-PAGE structure: Home, About, Listings, Contact.
4. Copywriting must be persuasive, professional, and trust-building.
5. Return a single JSON object matching the schema below.

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

  const styleHints = styleProfile ? `
STYLE PREFERENCES:
- Primary Color: ${styleProfile.primaryColor}
- Secondary Color: ${styleProfile.secondaryColor}
- Font Hints: ${styleProfile.fontHints?.join(', ')}
- Tone: ${styleProfile.toneHints?.join(', ')}
- Layout: ${styleProfile.layoutHints?.join(', ')}
- Example Phrases to mimic: ${styleProfile.examplePhrases?.join('; ')}
` : 'STYLE PREFERENCES: Use a modern, high-end Dubai real estate aesthetic (Eden House style). Use "luxury" theme hints.';

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

INSTRUCTIONS:
1. Create a "Home" page with a high-impact Hero section (full-bleed image style), a brief About teaser, Featured properties, and a strong CTA band.
2. Create an "About" page with detailed bio, services, and testimonials.
3. Create a "Listings" page with a grid.
4. Create a "Contact" page with a focused form and location info.
5. Use "Eden House" style hints: generous whitespace, elegant serif headings, minimal UI elements.

Generate the JSON document now.
`;
}
