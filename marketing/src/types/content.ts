export type InsightCategory =
  | "lead-nurturing"
  | "lead-nurturing-definition"
  | "lead-nurturing-strategy"
  | "lead-nurturing-automation"
  | "ai-marketing"
  | "real-estate-marketing"
  | "dubai-luxury-real-estate"
  | "off-plan-dubai"
  | "developer-funnels"
  | "booking-automation"
  | "multi-agent-systems"
  | "sales-nurturing"
  | "playbooks"
  | "experiments"
  | "product-updates"
  | "case-studies"
  | "faq-explainers";

export type ArticleSection =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title: string; text: string }
  | { type: "stat"; value: string; label: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "scenario"; label: string; messages: { from: "INVESTOR" | "BUYER" | "AGENT" | "AURO"; text: string }[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "metricBlock"; metrics: { label: string; value: string }[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface Insight {
  slug: string;
  title: string;
  excerpt: string;
  category: InsightCategory;
  author: string;
  authorRole: string;
  authorImage?: string;
  authorLink?: string;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  heroImage: string;
  heroAlt: string;
  keyStat: { value: string; label: string };
  metaTitle: string;
  metaDescription: string;
  sections: ArticleSection[];
  internalLinks: { label: string; to: string }[];
}

export type InsightMeta = Omit<Insight, "sections" | "internalLinks">;

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  "lead-nurturing": "Lead Nurturing",
  "lead-nurturing-definition": "Lead Nurturing",
  "lead-nurturing-strategy": "Lead Nurturing Strategy",
  "lead-nurturing-automation": "Lead Nurturing Automation",
  "ai-marketing": "AI Marketing",
  "real-estate-marketing": "Real Estate Marketing",
  "dubai-luxury-real-estate": "Dubai Luxury Real Estate",
  "off-plan-dubai": "Off-Plan Dubai",
  "developer-funnels": "Developer Funnels",
  "booking-automation": "Booking Automation",
  "multi-agent-systems": "Multi-Agent Systems",
  "sales-nurturing": "Sales Nurturing",
  "playbooks": "Playbooks",
  "experiments": "Experiments",
  "product-updates": "Product Updates",
  "case-studies": "Case Studies",
  "faq-explainers": "FAQ",
};

export const CATEGORY_DESCRIPTIONS: Record<InsightCategory, string> = {
  "lead-nurturing": "Deep dives into lead nurturing strategies, definitions, and best practices for real estate.",
  "lead-nurturing-definition": "Clear definitions and fundamentals of lead nurturing in modern sales.",
  "lead-nurturing-strategy": "Strategic frameworks for building effective lead nurturing campaigns.",
  "lead-nurturing-automation": "How automation transforms lead nurturing into a revenue engine.",
  "ai-marketing": "AI-powered marketing tools and strategies transforming real estate sales.",
  "real-estate-marketing": "Comprehensive marketing approaches for the Dubai real estate market.",
  "dubai-luxury-real-estate": "Insights into Dubai's luxury property market and high-net-worth buyer behavior.",
  "off-plan-dubai": "Off-plan property investment strategies and marketing in Dubai.",
  "developer-funnels": "Sales funnel strategies for Dubai property developers.",
  "booking-automation": "Automating meeting booking and lead qualification for real estate teams.",
  "multi-agent-systems": "Multi-agent AI orchestration for lead nurturing at scale.",
  "sales-nurturing": "Sales-focused nurturing techniques that convert leads into meetings.",
  "playbooks": "Actionable playbooks and templates for real estate sales teams.",
  "experiments": "A/B tests, experiments, and data-driven insights from AURO deployments.",
  "product-updates": "AURO product releases, feature updates, and evolution.",
  "case-studies": "Real-world results and success stories from AURO customers.",
  "faq-explainers": "Frequently asked questions about AURO, lead nurturing, and AI qualification.",
};
