import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Seo } from "../components/Seo.tsx";
import { insightsMeta } from "../data/insights-meta.ts";
import { INSIGHT_CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "../types/content.ts";
import type { InsightCategory } from "../types/content.ts";

const DASHBOARD_KEY = "auro-dash-2026";
const ALL = "all" as const;

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <p className="text-neutral-500 font-mono text-xs">Access denied.</p>
    </div>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.get("key");

  const [activeCategory, setActiveCategory] = useState<InsightCategory | typeof ALL>(ALL);
  const [showDrafts, setShowDrafts] = useState(false);

  if (key !== DASHBOARD_KEY) {
    return (
      <>
        <Seo metaTitle="Dashboard" metaDescription="AURO article dashboard" robots="noindex, nofollow" />
        <AccessDenied />
      </>
    );
  }

  const categories = useMemo(() => {
    const cats = new Set(insightsMeta.map((i) => i.category));
    return Array.from(cats).sort();
  }, []);

  const publishedCount = insightsMeta.filter((i) => i.status !== "draft").length;
  const draftCount = insightsMeta.filter((i) => i.status === "draft").length;

  const filtered = useMemo(() => {
    let list = insightsMeta;
    if (!showDrafts) {
      list = list.filter((i) => i.status !== "draft");
    }
    if (activeCategory !== ALL) {
      list = list.filter((i) => i.category === activeCategory);
    }
    return [...list].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [activeCategory, showDrafts]);

  return (
    <>
      <Seo metaTitle="Dashboard — Published Articles" metaDescription="AURO published article dashboard" robots="noindex, nofollow" />

      <div className="px-6 md:px-10 lg:px-16 pb-16 pt-2 max-w-7xl mx-auto">
        <div className="mb-8 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-neutral-500 uppercase">DASHBOARD</span>
          <h1 className="font-serif text-3xl sm:text-4xl font-light text-[#f4f4f4] mt-3 leading-tight">
            Published Articles
          </h1>
          <div className="flex items-center gap-4 mt-3 text-xs font-mono text-neutral-400">
            <span>{publishedCount} published</span>
            <span className="text-neutral-700">·</span>
            <span>{draftCount} draft</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value as InsightCategory | typeof ALL)}
            className="bg-[#0a0a0a] border border-[#333] text-[#f4f4f4] text-[9px] font-mono uppercase tracking-wider px-3 py-1.5 outline-none focus:border-[#D4FF00]"
          >
            <option value={ALL}>All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {INSIGHT_CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-wider text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDrafts}
              onChange={() => setShowDrafts((s) => !s)}
              className="accent-[#D4FF00]"
            />
            Show drafts
          </label>

          <span className="text-[9px] font-mono text-neutral-600 ml-auto">{filtered.length} articles</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#333] text-neutral-500 text-[9px] uppercase tracking-wider">
                <th className="text-left py-3 pr-3 w-16"></th>
                <th className="text-left py-3 pr-3">Title</th>
                <th className="text-left py-3 pr-3 hidden md:table-cell">Category</th>
                <th className="text-left py-3 pr-3">Status</th>
                <th className="text-left py-3 pr-3">Published</th>
                <th className="text-left py-3 pr-3 hidden lg:table-cell">Updated</th>
                <th className="text-right py-3">Read</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr
                  key={article.slug}
                  className={`border-b border-[#1a1a1a] hover:bg-[#111] transition-colors ${
                    article.status === "draft" ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-3 pr-3">
                    <div className="w-12 h-8 bg-neutral-900 rounded overflow-hidden">
                      {article.heroImage ? (
                        <img
                          src={article.heroImage}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700 text-[7px] font-mono tracking-widest">
                          AURO
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      to={`/insights/${article.slug}`}
                      className="text-[#f4f4f4] hover:text-[#D4FF00] transition-colors leading-tight block max-w-xs truncate"
                    >
                      {article.title}
                    </Link>
                    <span className="text-neutral-600 text-[8px] block mt-0.5 truncate max-w-xs">
                      {article.slug}
                    </span>
                  </td>
                  <td className="py-3 pr-3 hidden md:table-cell text-neutral-400">
                    {INSIGHT_CATEGORY_LABELS[article.category]}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[8px] font-mono uppercase tracking-wider ${
                        article.status === "draft"
                          ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50"
                          : "bg-[#D4FF00]/10 text-[#D4FF00] border border-[#D4FF00]/30"
                      }`}
                    >
                      {article.status === "draft" ? "Draft" : "Published"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-neutral-400 whitespace-nowrap">
                    {new Date(article.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 pr-3 hidden lg:table-cell text-neutral-500 whitespace-nowrap">
                    {article.updatedAt !== article.publishedAt
                      ? new Date(article.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="py-3 text-right text-neutral-500 whitespace-nowrap">
                    {article.readMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-neutral-500 font-mono">No articles match this filter.</p>
          </div>
        )}
      </div>
    </>
  );
}
