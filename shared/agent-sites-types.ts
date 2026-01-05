export interface Brokerage {
    id: string;                    // UUID
    name: string;                  // "Provident Real Estate"
    slug: string;                  // "provident"
    primaryContactName: string;
    primaryContactEmail: string;
    primaryContactPhone: string;
    numAgents: number;
    plan: "starter" | "professional" | "enterprise";
    createdAt: string;             // ISO timestamp
    updatedAt: string;
}

export interface Agent {
    id: string;                    // UUID
    brokerageId: string | null;    // NULL for solo agents
    phone: string;                 // WhatsApp phone (Bird number contact)
    email: string;
    role: "agent" | "team_lead" | "manager" | "owner";
    status: "pending" | "onboarding" | "active" | "suspended";
    createdAt: string;
    lastActiveAt: string;
}

export type ConfigStatus = "draft" | "ready" | "published";
export type ListingType = "rent" | "sale" | "offplan";
export type ListingStatus = "available" | "sold" | "reserved" | "rented";
export type ListingSource = "manual" | "portal" | "mixed";
export type ThemeVariant = "light" | "darkGold" | "darkBlue" | "minimal";
export type PrimaryChannel = "whatsapp" | "phone" | "email";

export interface Listing {
    id: string;                     // UUID
    title: string;
    towerOrCommunity: string;
    type: ListingType;
    price: number;
    currency: string;               // "AED" | "USD"
    beds: number;
    baths: number;
    sizeSqft: number;
    features: string[];
    photos: string[];               // URLs
    status: ListingStatus;
    handoverInfo?: string;          // For offplan
    description?: string;
    portalUrl?: string;             // Source URL if scraped
    source: ListingSource;
    createdAt: string;
    updatedAt: string;
}

export interface LeadConfig {
    primaryChannel: PrimaryChannel;
    whatsappNumber: string;         // Bird number or agent's personal
    ctaTexts: {
        primary: string;              // "Chat with me on WhatsApp"
        secondary?: string;           // "Schedule a viewing"
    };
}

export interface SiteStyleProfile {
    sourceUrl?: string;             // Inspiration site URL
    primaryColor?: string;          // "#1a365d"
    secondaryColor?: string;        // "#c9a227"
    fontHints?: string[];           // ["serif", "elegant", "Playfair Display"]
    layoutHints?: string[];         // ["hero-full-width", "card-grid", "minimal-nav"]
    toneHints?: string[];           // ["luxury", "professional", "family-friendly"]
    examplePhrases?: string[];      // Sample copy from inspiration site
}

export interface AgentConfig {
    id: string;                     // UUID
    agentId: string;                // FK to agents.id
    brokerageId?: string;           // FK to brokerages.id (optional)
    slug: string;                   // URL slug: "sarah-ahmed"
    status: ConfigStatus;

    // Identity
    name: string;
    designation: string;            // "Senior Property Consultant"
    company: string;                // "Provident Real Estate"
    reraNumber: string;             // "BRN-12345"
    phone: string;
    email: string;
    location: string;               // "Dubai Marina Office"
    languages: string[];            // ["en", "ar", "hi"]
    bio?: string;                   // Agent story/about

    // Branding
    primaryColor: string;
    secondaryColor: string;
    themeVariant: ThemeVariant;
    logoUrl?: string;
    profilePhotoUrl?: string;

    // Focus
    areas: string[];                // ["Dubai Marina", "JBR", "Palm Jumeirah"]
    propertyTypes: string[];        // ["apartment", "villa", "penthouse"]
    developers: string[];           // ["Emaar", "Damac", "Nakheel"]

    // Services
    services: string[];             // ["Buy", "Sell", "Rent", "Property Management"]
    differentiators: string[];      // ["10+ years experience", "Fluent in 5 languages"]

    // Listings
    listings: Listing[];

    // Lead Config
    leadConfig: LeadConfig;

    // Style Profile (from inspiration site)
    styleProfile?: SiteStyleProfile;

    // Build Control
    needsSiteRebuild: boolean;      // True if changes require Claude rebuild
    lastBuiltAt?: string;           // Last successful build timestamp

    // Timestamps
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
}

export type PortalSource = "bayut" | "propertyFinder" | "dubizzle" | "developer" | "other";

export interface ScrapedListingDraft {
    sourceUrl: string;
    source: PortalSource;
    title?: string;
    towerOrCommunity?: string;
    type?: ListingType;
    price?: number;
    currency?: string;
    beds?: number;
    baths?: number;
    sizeSqft?: number;
    features?: string[];
    photos?: string[];
    description?: string;
    agentName?: string;             // Scraped agent info (may differ from our agent)
    scrapedAt: string;
    confidence: number;             // 0-1 confidence score
}

export interface AgentScrapeQuota {
    agentId: string;
    dailyLimit: number;             // Default: 30 URLs/day
    usedToday: number;
    resetAt: string;                // Next midnight UTC
}

export type SectionType =
    | "hero"
    | "about"
    | "services"
    | "focusAreas"
    | "listingsGrid"
    | "testimonials"
    | "contact"
    | "faq"
    | "ctaBand"
    | "stats"
    | "developers";

export type LanguageCode = "en" | "ar";

export interface HeroContent {
    headline: string;
    subheadline: string;
    backgroundImage?: string;
    primaryCTA: { text: string; action: string };
    secondaryCTA?: { text: string; action: string };
}

export interface AboutContent {
    title: string;
    paragraphs: string[];
    photo?: string;
    highlights?: string[];
}

export interface ServiceCard {
    title: string;
    description: string;
    icon: string;                   // Icon name or URL
}

export interface ServicesContent {
    title: string;
    subtitle?: string;
    cards: ServiceCard[];
}

export interface FocusAreaItem {
    name: string;
    description: string;
    image?: string;
}

export interface FocusAreasContent {
    title: string;
    subtitle?: string;
    areas: FocusAreaItem[];
}

export interface ListingsGridContent {
    title: string;
    subtitle?: string;
    groupBy?: "type" | "area" | "none";
    sortBy?: "price" | "newest" | "featured";
    showFilters: boolean;
    emptyMessage?: string;
}

export interface Testimonial {
    quote: string;
    name: string;
    role?: string;
    photo?: string;
}

export interface TestimonialsContent {
    title: string;
    testimonials: Testimonial[];
}

export interface ContactContent {
    title: string;
    description?: string;
    whatsappCTA: string;
    showForm: boolean;
    formFields?: string[];
    locationInfo?: {
        address: string;
        mapEmbed?: string;
    };
}

export interface FAQItem {
    question: string;
    answer: string;
}

export interface FAQContent {
    title: string;
    items: FAQItem[];
}

export interface CTABandContent {
    headline: string;
    subtext?: string;
    buttonText: string;
    buttonAction: string;
}

export interface StatsContent {
    title?: string;
    stats: Array<{
        value: string;
        label: string;
    }>;
}

export interface DevelopersContent {
    title: string;
    subtitle?: string;
    developers: Array<{
        name: string;
        logo?: string;
        description?: string;
    }>;
}

export type SectionContent =
    | HeroContent
    | AboutContent
    | ServicesContent
    | FocusAreasContent
    | ListingsGridContent
    | TestimonialsContent
    | ContactContent
    | FAQContent
    | CTABandContent
    | StatsContent
    | DevelopersContent;

export interface Section<T extends SectionContent = SectionContent> {
    id: string;
    type: SectionType;
    order: number;
    visible: boolean;
    content: {
        en: T;
        ar?: T;
    };
}

export interface AgentSiteDocument {
    id: string;                     // UUID
    agentId: string;
    configId: string;               // FK to agentconfigs.id
    slug: string;
    version: number;
    languageCodes: LanguageCode[];

    meta: {
        pageTitle: {
            en: string;
            ar?: string;
        };
        metaDescription: {
            en: string;
            ar?: string;
        };
        canonicalUrl?: string;
        ogImage?: string;
    };

    theme: {
        primaryColor: string;
        secondaryColor: string;
        variant: ThemeVariant;
        logoUrl?: string;
    };

    sections: Section[];

    // Runtime data (not generated by Claude)
    listings: Listing[];            // Passed through from AgentConfig

    generatedAt: string;
    generatedBy: string;            // Model name: "claude-3.5-sonnet-20241022"
    tokenUsage?: {
        input: number;
        output: number;
    };
}

export interface AgentDomain {
    id: string;
    agentId: string;
    domain: string;                // "mybrand.com"
    status: "pending_dns" | "pending_ssl" | "active" | "error";
    isPrimary: boolean;            // If true, this is the canonical URL
    verifiedAt?: string;
    sslIssuedAt?: string;
    createdAt: string;
}

export interface EnterpriseLead {
    id: string;
    agentId: string;                // Referring agent
    brokerageName?: string;
    numAgents?: number;
    decisionMakerName?: string;
    decisionMakerEmail?: string;
    decisionMakerPhone?: string;
    source: "whatsapp_prompt" | "site_footer" | "site_banner" | "manual" | "auto_trigger";
    triggerReason?: string;         // e.g., "team_size_3+", "corporate_email", "multi_site"
    notes?: string;
    status: "new" | "contacted" | "qualified" | "converted" | "lost";
    priority: "low" | "medium" | "high";
    createdAt: string;
    updatedAt: string;
}

export interface SiteConversation {
    id: string;
    agentId: string;
    currentState: string;        // "COLLECT_NAME", "LISTINGS_LOOP", etc.
    stateData: any;              // Temporary data being collected
    lastMessageAt: string;
    createdAt: string;
}
