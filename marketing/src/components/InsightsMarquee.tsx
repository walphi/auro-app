import React from "react";
import { Link } from "react-router-dom";
import { allInsights } from "../data/insights.ts";
import { INSIGHT_CATEGORY_LABELS } from "../types/content.ts";
import type { Insight } from "../types/content.ts";

const latestInsights = allInsights
  .slice()
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

function HeroCard({ insight }: { insight: Insight }) {
  return (
    <Link
      to={`/insights/${insight.slug}`}
      className="block w-full h-[240px] sm:h-[320px] lg:h-[380px] group"
    >
      <div className="relative w-full h-full border border-[#333] overflow-hidden group-hover:border-[#D4FF00] transition-all duration-500">
        <img
          src={insight.heroImage}
          alt={insight.heroAlt}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
          <span className="inline-block text-[8px] font-mono text-[#D4FF00] uppercase tracking-[0.3em] bg-[#0a0a0a]/70 px-2 py-1 mb-4">
            {INSIGHT_CATEGORY_LABELS[insight.category]}
          </span>
          <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#f4f4f4] leading-tight font-light max-w-3xl">
            {insight.title}
          </h3>
          <p className="text-sm leading-relaxed text-neutral-300/80 font-light mt-3 max-w-2xl line-clamp-2">
            {insight.excerpt}
          </p>
          <span className="inline-block text-[8px] font-mono text-[#D4FF00] uppercase tracking-[0.3em] mt-5 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            Read article →
          </span>
        </div>
      </div>
    </Link>
  );
}

function CompactCard({ insight }: { insight: Insight }) {
  return (
    <Link
      to={`/insights/${insight.slug}`}
      className="block [perspective:1000px] w-full h-full group"
    >
      <div className="relative w-full h-full [transform-style:preserve-3d] transition-transform duration-700 group-hover:[transform:rotateY(180deg)]">
        {/* Front */}
        <div className="backface-hidden border border-[#333] overflow-hidden group-hover:border-[#D4FF00] transition-all duration-300 flex flex-col bg-[#0a0a0a] h-full">
          <div className="h-[80px] sm:h-[100px] shrink-0 overflow-hidden bg-neutral-900">
            <img
              src={insight.heroImage}
              alt={insight.heroAlt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
          <div className="p-3 flex flex-col gap-1.5 flex-1 min-h-0">
            <span className="text-[7px] font-mono text-[#D4FF00] uppercase tracking-[0.3em]">
              {INSIGHT_CATEGORY_LABELS[insight.category]}
            </span>
            <h3 className="font-serif text-sm text-[#f4f4f4] leading-snug line-clamp-2 flex-1">
              {insight.title}
            </h3>
            <span className="text-[7px] font-mono text-[#D4FF00] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Read →
            </span>
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] border border-[#D4FF00] bg-[#0a0a0a] p-4 flex flex-col justify-center items-center overflow-hidden">
          <p className="text-xs text-neutral-300 font-light text-center leading-relaxed line-clamp-6">
            {insight.excerpt}
          </p>
          <span className="text-[7px] font-mono text-[#D4FF00] uppercase tracking-[0.3em] mt-3">
            Read full article →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function InsightsMarquee() {
  const [hero, ...rest] = latestInsights;
  const clusterCards = rest.slice(0, 4);
  const restCards = rest.slice(4, 12);

  return (
    <section className="border-t border-b border-[#333] bg-[#0a0a0a] py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        {/* Heading */}
        <div className="text-center opacity-0 translate-y-5 mb-8 lg:mb-10" data-reveal>
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">
            05 // LATEST INSIGHTS
          </span>
          <p className="text-neutral-300 font-serif italic text-xl sm:text-2xl mt-2 select-none">
            Research, strategies, and playbooks
          </p>
        </div>

        {/* Hero + 2x2 cluster (desktop side-by-side) */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6">
          <div className="w-full md:w-[65%] opacity-0 translate-y-5" data-reveal data-delay="1">
            <HeroCard insight={hero} />
          </div>
          <div className="w-full md:w-[35%] grid grid-cols-2 md:grid-rows-2 gap-4 md:h-full">
            {clusterCards.map((insight, i) => (
              <div
                key={insight.slug}
                className="opacity-0 translate-y-5"
                data-reveal
                data-delay={`${Math.min(i + 2, 4)}`}
              >
                <CompactCard insight={insight} />
              </div>
            ))}
          </div>
        </div>

        {/* Rest grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {restCards.map((insight, i) => (
            <div
              key={insight.slug}
              className="opacity-0 translate-y-5"
              data-reveal
              data-delay={`${Math.min(i + 1, 4)}`}
            >
              <CompactCard insight={insight} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-8 lg:mt-10">
          <Link
            to="/insights/"
            className="inline-block px-4 py-2 border border-[#333] text-[9px] font-mono text-neutral-400 hover:text-[#D4FF00] hover:border-[#D4FF00] uppercase tracking-wider transition-all duration-300"
          >
            View all insights →
          </Link>
        </div>
      </div>
    </section>
  );
}
