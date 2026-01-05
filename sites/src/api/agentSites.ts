
export interface Listing {
    id: string;
    title: string;
    towerOrCommunity: string;
    type: "rent" | "sale" | "offplan";
    price: number;
    currency: string;
    beds: number;
    baths: number;
    sizeSqft: number;
    features: string[];
    photos: string[];
    description?: string;
    status: string;
}

export interface SiteStyleProfile {
    sourceUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontHints?: string[];
    layoutHints?: string[];
    toneHints?: string[];
    examplePhrases?: string[];
}

export interface LeadConfig {
    primaryChannel: "whatsapp" | "phone" | "email";
    whatsappNumber: string;
    ctaTexts: {
        primary: string;
    };
}

export interface AgentConfig {
    id: string;
    slug: string;
    name: string;
    company: string;
    designation: string;
    bio?: string;
    profilePhotoUrl?: string;
    logoUrl?: string;
    phone: string;
    email: string;
    listings: Listing[];
    leadConfig: LeadConfig;
    styleProfile?: SiteStyleProfile;
    primaryColor: string;
    secondaryColor: string;
}

export async function getAgentSite(slug: string): Promise<AgentConfig> {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBase}/.netlify/functions/get-agent-site?slug=${slug}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Agent site not found');
        }
        throw new Error('Failed to fetch agent site');
    }

    const raw = await response.json();

    // Map snake_case from DB to camelCase for FE
    return {
        id: raw.id,
        slug: raw.slug,
        name: raw.name,
        company: raw.company,
        designation: raw.designation,
        bio: raw.bio,
        profilePhotoUrl: raw.profile_photo_url,
        logoUrl: raw.logo_url,
        phone: raw.phone,
        email: raw.email,
        listings: raw.listings || [],
        leadConfig: raw.lead_config || {},
        styleProfile: raw.style_profile,
        primaryColor: raw.primary_color,
        secondaryColor: raw.secondary_color
    };
}

export function trackEvent(name: string, properties: any) {
    console.log(`[Metric] ${name}:`, properties);
    // TODO: Wire to backend metrics endpoint
}
