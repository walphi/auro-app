import React, { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import { allInsights } from "../data/insights.ts";
import { INSIGHT_CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "../types/content.ts";
import type { InsightCategory, InsightMeta } from "../types/content.ts";

const insightMeta: InsightMeta[] = allInsights
  .map(({ sections, internalLinks, ...meta }) => meta)
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

const ALL = "all" as const;
const ITEMS_PER_PAGE = 9;

export default function Insights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory: InsightCategory | typeof ALL = (searchParams.get("category") as InsightCategory) || ALL;
  const activePage = parseInt(searchParams.get("page") || "1", 10);

  const categories = useMemo(() => {
    const cats = new Set(insightMeta.map((i) => i.category));
    return Array.from(cats);
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === ALL) return insightMeta;
    return insightMeta.filter((i) => i.category === activeCategory);
  }, [activeCategory]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentPage = Math.min(activePage, totalPages || 1);
  const paginatedArticles = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCategoryChange = (cat: InsightCategory | typeof ALL) => {
    if (cat === ALL) {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  const handlePageChange = (page: number) => {
    const params: Record<string, string> = {};
    if (activeCategory !== ALL) params.category = activeCategory;
    params.page = String(page);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Seo
        metaTitle="Insights — Lead Nurturing, AI Marketing & Dubai Real Estate"
        metaDescription="Expert insights on lead nurturing, AI marketing automation, Dubai real estate marketing, off-plan property funnels, and multi-agent booking systems."
        canonicalUrl={canonicalUrl("/insights/")}
        ogType="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Blog",
              headline: "AURO Insights",
              description: "Expert insights on lead nurturing, AI marketing automation, and Dubai real estate.",
              publisher: { "@type": "Organization", name: "AURO" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
                { "@type": "ListItem", position: 2, name: "Insights", item: canonicalUrl("/insights/") },
              ],
            },
          ],
        }}
      />

      <div className="px-6 md:px-10 lg:px-16 pb-8 pt-2 max-w-7xl mx-auto">
        <div className="mb-6 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">04 // INSIGHTS</span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] mt-3 leading-tight">
            Lead Nurturing, AI Marketing & <br />
            <span className="italic text-[#D4FF00]">Dubai Real Estate</span>
          </h1>
          <p className="text-sm text-neutral-300 font-light mt-3 max-w-2xl">
            Research, strategies, and playbooks for turning every inquiry into a qualified meeting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleCategoryChange(ALL)}
            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
              activeCategory === ALL
                ? "bg-[#D4FF00] text-black font-bold"
                : "bg-transparent text-neutral-400 border border-[#333] hover:border-[#D4FF00]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "bg-[#D4FF00] text-black font-bold"
                  : "bg-transparent text-neutral-400 border border-[#333] hover:border-[#D4FF00]"
              }`}
            >
              {INSIGHT_CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedArticles.map((insight) => (
            <Link
              key={insight.slug}
              to={`/insights/${insight.slug}`}
              className="group border border-[#333] bg-[#0a0a0a]/80 hover:border-[#D4FF00] transition-all duration-300 flex flex-col overflow-hidden"
            >
              <div className="h-44 bg-neutral-900 overflow-hidden relative">
                {insight.heroImage ? (
                  <>
                    <img
                      src={insight.heroImage}
                      alt={insight.heroAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full border border-[#D4FF00]/15 pointer-events-none" />
                    <div className="absolute top-4 right-4 w-1 h-1 rounded-full bg-[#D4FF00]/40 pointer-events-none" />
                    <div className="absolute inset-0 bg-[#D4FF00] pointer-events-none [clip-path:polygon(0%_0%,50%_100%,0%_100%)]" />
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#D4FF00]/40" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-700 font-mono text-[9px] uppercase tracking-widest">
                    AURO
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-[#D4FF00] uppercase tracking-wider">
                    {INSIGHT_CATEGORY_LABELS[insight.category]}
                  </span>
                  <span className="text-[8px] font-mono text-neutral-600">{insight.readMinutes} min read</span>
                </div>
                <h2 className="font-serif text-lg text-[#f4f4f4] group-hover:text-[#D4FF00] transition-colors leading-snug">
                  {insight.title}
                </h2>
                <p className="text-xs text-neutral-300 font-light leading-relaxed flex-1">
                  {insight.excerpt}
                </p>
                <div className="flex items-center gap-2 text-[8px] font-mono text-neutral-500 uppercase tracking-wider pt-2 border-t border-[#222]">
                  <span>{new Date(insight.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {insight.keyStat && (
                    <>
                      <span className="text-neutral-700">/</span>
                      <span className="text-[#D4FF00]">{insight.keyStat.value} {insight.keyStat.label}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-8 h-8 text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  currentPage === page
                    ? "bg-[#D4FF00] text-black font-bold"
                    : "bg-transparent text-neutral-400 border border-[#333] hover:border-[#D4FF00]"
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-neutral-500 font-mono">No insights found in this category.</p>
          </div>
        )}
      </div>
    </>
  );
}
