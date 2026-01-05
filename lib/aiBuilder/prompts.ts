import { AgentConfig, SiteStyleProfile } from '../../shared/agent-sites-types';

export const SYSTEM_PROMPT = `
You are the Auro Agent Site Builder. Your task is to generate a complete, valid JSON AgentSiteDocument based on the provided AgentConfig and SiteStyleProfile.

STRICT REQUIREMENTS:
1. Output MUST be ONLY valid JSON. No markdown backticks, no preamble, no postamble.
2. Adhere strictly to the AgentSiteDocument TypeScript interface.
3. Content must be professional, luxury-oriented, and tailored to the Dubai real estate market.
4. Copywriting should be persuasive and trust-building.
5. All IDs for listings must match the provided listing IDs exactly.
6. Localize content appropriately if multiple languages are requested.
7. Copyright protection: Do not use trademarked marketing slogans from other brokerages.

SCHEMA REFERENCE:
The JSON must follow the AgentSiteDocument structure:
{
  "agentId": "string",
  "configId": "string",
  "slug": "string",
  "version": number,
  "languageCodes": ["en" | "ar"],
  "meta": { "title": "string", "description": "string", "keywords": [] },
  "theme": { "primaryColor": "string", "secondaryColor": "string", "fontFamily": "string" },
  "sections": [
    { "id": "string", "type": "SectionType", "content": { ... } }
  ],
  "listings": []
}
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
` : 'STYLE PREFERENCES: Use a modern, high-end Dubai real estate aesthetic.';

    return `
GENERATE SITE FOR: ${agentConfig.name}
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

REQUIRED SECTIONS:
1. hero
2. about
3. services
4. focusAreas
5. listingsGrid
6. testimonials (generate realistic placeholders based on their profile)
7. contact
8. ctaBand

Generate the JSON document now.
`;
}
