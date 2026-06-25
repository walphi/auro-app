import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import { allInsights } from "../data/insights.ts";
import { INSIGHT_CATEGORY_LABELS } from "../types/content.ts";

const SLUG_TITLE_MAP: Record<string, { title: string; excerpt: string }> = {
  "lead-nurturing-definition": {
    title: "Lead Nurturing Definition — What It Is & Why It Matters for Dubai Real Estate",
    excerpt: "A clear definition of lead nurturing and why it is the most important capability for real estate teams converting inbound inquiries into booked meetings.",
  },
  "what-is-lead-nurturing": {
    title: "What Is Lead Nurturing? A Complete Guide for Real Estate Agents",
    excerpt: "Everything you need to know about lead nurturing in real estate: how it works, why it matters, and how AURO automates it for Dubai agencies.",
  },
  "lead-nurturing-strategy": {
    title: "Lead Nurturing Strategy — Building a System That Converts",
    excerpt: "A strategic framework for building a lead nurturing system that turns every inquiry into a qualified meeting opportunity.",
  },
  "lead-nurturing-automation": {
    title: "Lead Nurturing Automation — Scale Your Follow-Up Without Losing Quality",
    excerpt: "How automation transforms lead nurturing from a manual task into a scalable revenue engine for real estate teams.",
  },
  "ai-marketing-real-estate": {
    title: "AI Marketing for Real Estate — The Complete Guide",
    excerpt: "How artificial intelligence is transforming real estate marketing in Dubai, from AI-powered lead nurturing to automated qualification.",
  },
  "ai-marketing-tools-real-estate": {
    title: "AI Marketing Tools for Real Estate — What Works in 2026",
    excerpt: "A comprehensive overview of AI marketing tools available for real estate agents and developers in Dubai and the UAE.",
  },
  "real-estate-marketing-dubai": {
    title: "Real Estate Marketing Dubai — Strategies for 2026",
    excerpt: "Dubai's real estate market demands sophisticated marketing. Learn how AI lead nurturing and automation give agencies a competitive edge.",
  },
  "real-estate-marketing-strategy": {
    title: "Real Estate Marketing Strategy — From Listings to Booked Meetings",
    excerpt: "Build a complete real estate marketing strategy that converts online interest into in-person meetings and closed deals.",
  },
  "off-plan-properties-dubai-marketing": {
    title: "Off-Plan Properties Dubai Marketing — A Complete Guide",
    excerpt: "How to market off-plan properties in Dubai effectively using AI-powered lead nurturing and automated qualification.",
  },
  "luxury-real-estate-marketing-dubai": {
    title: "Luxury Real Estate Marketing Dubai — Strategies for High-Net-Worth Buyers",
    excerpt: "Marketing luxury real estate in Dubai requires a different approach. Learn how AI nurtures high-net-worth leads toward conversion.",
  },
  "booking-automation-dubai-real-estate": {
    title: "Booking Automation Dubai Real Estate — The Future of Lead Qualification",
    excerpt: "How booking automation and AI qualification are transforming the way Dubai real estate teams convert leads into meetings.",
  },
  "multi-agent-lead-nurturing": {
    title: "Multi-Agent Lead Nurturing — AI Orchestration at Scale",
    excerpt: "How AURO's multi-agent system orchestrates lead nurturing across pools, channels, and follow-up sequences for maximum conversion.",
  },
};

const slugToInsight = (slug: string) => allInsights.find((i) => i.slug === slug);

interface StaticSeoPageProps {
  slug: string;
}

export default function StaticSeoPage({ slug }: StaticSeoPageProps) {
  const meta = SLUG_TITLE_MAP[slug];
  const insight = slugToInsight(slug);

  const title = meta?.title || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const excerpt = meta?.excerpt || "";

  return (
    <>
      <Seo
        metaTitle={title}
        metaDescription={excerpt}
        canonicalUrl={insight ? canonicalUrl(`/insights/${insight.slug}/`) : canonicalUrl(`/${slug}/`)}
        ogType="article"
        robots={insight ? "noindex, follow" : "index, follow"}
      />

      <div className="px-6 md:px-10 lg:px-16 py-8 max-w-4xl mx-auto min-h-[50vh]">
        <Link to="/insights" className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-[#D4FF00] transition-colors mb-6">
          ← Back to Insights
        </Link>

        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-light text-[#f4f4f4] leading-tight">
            {title}
          </h1>
          <p className="text-sm text-neutral-300 font-light mt-4 max-w-2xl">
            {excerpt}
          </p>
        </div>

        {insight && (
          <div className="mb-8">
            <Link
              to={`/insights/${insight.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#D4FF00]/30 bg-[#D4FF00]/5 text-[#D4FF00] text-[10px] font-mono uppercase tracking-wider hover:bg-[#D4FF00] hover:text-black transition-colors"
            >
              Read Full Article →
            </Link>
          </div>
        )}

        <div className="border-t border-[#333] pt-8 mt-8">
          <h2 className="font-serif text-xl text-[#f4f4f4] mb-4">Related Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allInsights
              .filter((i) => i.slug !== slug)
              .slice(0, 4)
              .map((i) => (
                <Link
                  key={i.slug}
                  to={`/insights/${i.slug}`}
                  className="border border-[#333] p-4 hover:border-[#D4FF00] transition-colors"
                >
                  <p className="text-[8px] font-mono text-[#D4FF00] uppercase tracking-wider mb-1">
                    {INSIGHT_CATEGORY_LABELS[i.category]}
                  </p>
                  <p className="text-xs text-[#f4f4f4] font-medium">{i.title}</p>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
