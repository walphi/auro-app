
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
        logoUrl?: string;
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
    console.log('[api/agentSites] Raw response:', raw);

    const config = mapConfigFromRaw(raw.config);
    let document: SiteDocument | null = null;

    try {
        if (raw.document) {
            const docRow = raw.document;
            console.log('[api/agentSites] Mapping docRow:', docRow);

            // The document structure in DB might be slightly different than our FE interface
            // We map it here robustly
            document = {
                site: {
                    name: docRow.meta?.brand?.name || docRow.site?.name || config.name,
                    logoUrl: docRow.meta?.brand?.logoUrl || docRow.site?.logoUrl || config.logoUrl,
                    designSystem: {
                        colors: {
                            primary: docRow.meta?.designSystem?.primaryColor || docRow.theme?.primaryColor || '#1a1a1a',
                            secondary: docRow.meta?.designSystem?.secondaryColor || docRow.theme?.secondaryColor || '#c9a227',
                            accent: docRow.meta?.designSystem?.accentColor || docRow.theme?.accentColor || '#c9a55c',
                            background: docRow.meta?.designSystem?.backgroundColor || docRow.theme?.backgroundColor || '#ffffff',
                            text: docRow.meta?.designSystem?.textColor || docRow.theme?.textColor || '#1a1a1a',
                            muted: docRow.meta?.designSystem?.mutedColor || docRow.theme?.mutedColor || '#888888',
                        },
                        fonts: {
                            heading: docRow.meta?.designSystem?.typography?.headingFont || docRow.theme?.typography?.headingFont || 'Playfair Display',
                            body: docRow.meta?.designSystem?.typography?.bodyFont || docRow.theme?.typography?.bodyFont || 'Inter',
                        },
                        spacing: {
                            sectionPadding: '80px',
                            containerMaxWidth: '1200px'
                        }
                    }
                },
                nav: {
                    // Try docRow.nav.items then docRow.sections
                    items: docRow.nav?.items || docRow.sections?.map((s: any) => ({
                        label: s.title,
                        path: s.path || (s.id === 'home' ? '/' : `/${s.id}`),
                        type: 'page'
                    })) || []
                },
                pages: docRow.pages || docRow.sections?.map((s: any) => ({
                    id: s.id,
                    title: s.title,
                    meta: {
                        description: s.metaDescription || s.meta?.description
                    },
                    sections: s.sections || []
                })) || [],
                listings: docRow.listings
            };
            console.log('[api/agentSites] Successfully mapped document:', document);
        }
    } catch (err) {
        console.error('[api/agentSites] Error mapping document:', err);
    }

    return { config, document };
}

export function trackEvent(name: string, properties: any) {
    console.log(`[Metric] ${name}:`, properties);
    // TODO: Wire to backend metrics endpoint
}
