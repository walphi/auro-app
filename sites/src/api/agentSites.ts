
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
    status: string;
    agentId: string;
}

// Types for AI-generated site document
export interface DesignSystem {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        muted: string;
    };
    fonts: {
        heading: string;
        body: string;
    };
    spacing: {
        sectionPadding: string;
        containerMaxWidth: string;
    };
}

export interface NavItem {
    label: string;
    path: string;
    type: 'page' | 'link' | 'button';
    action?: string;
}

export interface Section {
    id?: string;
    type: string;
    content: Record<string, any>;
}

export interface Page {
    id: string;
    title: string;
    meta?: {
        description?: string;
    };
    sections: Section[];
}

export interface SiteDocument {
    site: {
        name: string;
        tagline?: string;
        designSystem: DesignSystem;
    };
    nav: {
        items: NavItem[];
    };
    pages: Page[];
    listings?: Listing[];
}

export interface AgentSiteResponse {
    config: AgentConfig;
    document: SiteDocument | null;
}

function mapConfigFromRaw(raw: any): AgentConfig {
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
        secondaryColor: raw.secondary_color,
        status: raw.status,
        agentId: raw.agent_id
    };
}

export async function getAgentSite(slug: string): Promise<AgentConfig> {
    const response = await getAgentSiteWithDocument(slug);
    return response.config;
}

export async function getAgentSiteWithDocument(slug: string): Promise<AgentSiteResponse> {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBase}/.netlify/functions/get-agent-site?slug=${slug}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Agent site not found');
        }
        if (response.status === 403) {
            throw new Error('Not published yet');
        }
        throw new Error('Failed to fetch agent site');
    }

    const raw = await response.json();

    // API now returns { config, document } where document is the row
    const config = mapConfigFromRaw(raw.config);
    const document = raw.document ? raw.document.document : null;

    return { config, document };
}

export function trackEvent(name: string, properties: any) {
    console.log(`[Metric] ${name}:`, properties);
    // TODO: Wire to backend metrics endpoint
}
