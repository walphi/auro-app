import React from "react";
import { Link, useLocation } from "react-router-dom";
import { canonicalUrl } from "../lib/site.ts";
import type { InsightCategory } from "../types/content.ts";
import { INSIGHT_CATEGORY_LABELS } from "../types/content.ts";
import { useBreadcrumb } from "../lib/BreadcrumbContext.tsx";

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const params = new URLSearchParams(location.search);
  const { state } = useBreadcrumb();
  const category = state.category || (params.get("category") as InsightCategory) || undefined;

  const items: { label: string; href?: string }[] = [{ label: "Home", href: "/" }];

  if (segments.length === 0) {
    items.push({ label: "Home" });
  } else if (segments[0] === "insights") {
    items.push({ label: "Insights", href: "/insights" });
    if (category) {
      const catLabel = INSIGHT_CATEGORY_LABELS[category] || category;
      items.push({ label: catLabel, href: `/insights?category=${category}` });
    }
    if (state.articleTitle) {
      items.push({ label: state.articleTitle });
    }
  } else if (segments[0] === "faq") {
    items.push({ label: "FAQ" });
  } else if (segments[0] === "product-updates") {
    items.push({ label: "Product Updates" });
  } else {
    segments.forEach((seg, i) => {
      const label = seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const href = i < segments.length - 1 ? `/${segments.slice(0, i + 1).join("/")}` : undefined;
      items.push({ label, href });
    });
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
      .filter((it) => it.href || it.label !== items[items.length - 1]?.label)
      .map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        ...(item.href ? { item: canonicalUrl(item.href) } : {}),
      })),
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      <nav aria-label="Breadcrumb" className="px-6 md:px-10 lg:px-16 pt-16 pb-2">
        <ol className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-neutral-500">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-neutral-700">/</span>}
              {item.href ? (
                <Link to={item.href} className="hover:text-[#D4FF00] transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={i === items.length - 1 ? "text-[#D4FF00]" : ""}>
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
