export interface Slide {
  id: string;
  label?: string;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  meta?: string;
  isTitle?: boolean;
}

export const christiesSlides: Slide[] = [
  {
    id: "title",
    isTitle: true,
    title: "Performance & Architecture Optimization Brief",
    subtitle: "Prepared exclusively for Christie's International Real Estate Dubai",
    meta: "Phillip Walsh | Founder, Auro App",
  },
  {
    id: "macro-problem",
    label: "01 // The Multi-Route Leak",
    title: "The Macro Problem: Decentralized Digital Fragmentation",
    subtitle: "Active marketing spend across subdomains is routing high-intent buyers into manual, disconnected, and unmonitored communication channels.",
    bullets: [
      "Data Demolition: Google tracking tokens (gbraid/gclid) are instantly stripped upon the WhatsApp transition, creating absolute attribution blindness.",
      "Brand Erosion: Ultra-high-net-worth investors expecting an immediate, white-glove digital greeting are met with manual latency or generic corporate loops.",
    ],
  },
  {
    id: "drilldown-a",
    label: "02 // The Mervin Joseph Funnel",
    title: "Drilldown A \u2013 The Active Campaign Silo",
    subtitle: "Analysis of the campaigns.christiesrealestatedubai.com subdomain.",
    body: "Roughly 40 active Google Ad campaigns (targeting premium keywords like \u2018villas for sale dubai\u2019 under Campaign ID: 21741244999) are landing on an off-plan/Golden Visa capture page that routes directly to a single manual handler\u2014Senior Property Consultant Mervin Joseph.",
    bullets: [
      "Single Point of Failure: If a top-producing broker is in a viewing, traveling, or asleep, expensive international ad traffic is met with total silence.",
      "Admin Burden: A senior consultant\u2019s highest-value use of time is closing deals face-to-face, not manually sorting through raw, unqualified internet clicks.",
    ],
  },
  {
    id: "drilldown-b",
    label: "03 // The Emaar Heights Project Detour",
    title: "Drilldown B \u2013 The Context-Blind Container",
    subtitle: "Analysis of the properties.christiesrealestatedubai.com/Emaar%20Heights landing page ecosystem.",
    body: "Floating WhatsApp buttons on specific ultra-luxury project pages drop buyers directly into the generic main corporate line (+971 52 142 1000).",
    bullets: [
      "Zero Context Retention: The receiving team gets a blind inbound message. The system does not pass the specific asset metadata (Emaar Heights, 80-20 payment plan, 3-5 bedroom intent).",
      "Manual Triage Delay: Inbound inquiries must be manually read, deciphered, qualified, and manually reassigned, causing massive lead-to-response latency.",
    ],
  },
  {
    id: "crm-black-hole",
    label: "04 // The Salesforce Transparency Void",
    title: "The CRM Black Hole",
    body: "Standard web-to-lead forms or baseline API scripts push flat, static text entries into Salesforce (Name, Phone, Email, Property).",
    bullets: [
      "Brokers are assigned records with zero conversational context, forcing them to call ultra-high-net-worth prospects completely blind.",
      "Outbound follow-ups rely on repeating rigid, cold qualification questions, lowering conversion velocity and frustrating premium buyers.",
    ],
  },
  {
    id: "resolution",
    label: "05 // The Unified Middleware Layer",
    title: "The Architecture Resolution: Auro App",
    subtitle: "Auro App functions as an intelligent, zero-downtime integration engine sitting seamlessly between your multi-subdomain front-ends and your digital ecosystem.",
    bullets: [
      "24/7 Premium Concierge: Instantly engages inbound mobile traffic inside WhatsApp using tailored, context-aware AI interactions.",
      "Attribution Locking: Preserves Google Ads data parameters and explicitly maps them back to your marketing suite.",
      "CRM Enrichment: Injects a complete, transparent psychological profile and structured buyer dossier directly into the Salesforce activity timeline before the broker dials.",
    ],
  },
  {
    id: "proposal",
    label: "06 // The 14-Day Performance Pilot",
    title: "The Actionable Proposal",
    bullets: [
      "Zero Friction: No sweeping architectural overhauls. No coding required from Christie\u2019s internal development or agency teams.",
      "Targeted Validation: Deploy Auro over a single active campaign pipeline (e.g., Mervin\u2019s active funnel or the Emaar Heights landing page) for 14 days.",
      "The Goal: Benchmark and prove the direct conversion lift and data transparency in real time. If it doesn\u2019t perform, the middleware layer is uninstalled cleanly.",
    ],
  },
];
