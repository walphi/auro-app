import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import { useBreadcrumb } from "../lib/BreadcrumbContext.tsx";
import { allInsights } from "../data/insights.ts";
import { INSIGHT_CATEGORY_LABELS } from "../types/content.ts";
import type { ArticleSection } from "../types/content.ts";

function renderSection(section: ArticleSection, i: number) {
  switch (section.type) {
    case "p":
      return (
        <p key={i} className="text-sm leading-relaxed text-neutral-300 font-light">
          {section.text}
        </p>
      );
    case "h2":
      return (
        <h2 key={i} id={section.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")} className="font-serif text-2xl text-[#f4f4f4] mt-10 mb-4">
          {section.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} className="font-serif text-lg text-[#f4f4f4] mt-8 mb-3">
          {section.text}
        </h3>
      );
    case "quote":
      return (
        <blockquote key={i} className="border-l-2 border-[#D4FF00] pl-4 my-6">
          <p className="text-sm italic text-neutral-300 font-light leading-relaxed">"{section.text}"</p>
          {section.cite && <cite className="text-[10px] font-mono text-neutral-500 mt-2 block not-italic">— {section.cite}</cite>}
        </blockquote>
      );
    case "callout":
      return (
        <div key={i} className="border border-[#D4FF00]/30 bg-[#D4FF00]/5 p-5 my-6">
          <p className="text-[10px] font-mono text-[#D4FF00] uppercase tracking-wider mb-2">{section.title}</p>
          <p className="text-sm text-neutral-300 font-light">{section.text}</p>
        </div>
      );
    case "stat":
      return (
        <div key={i} className="border border-[#333] p-6 my-6 text-center">
          <p className="text-3xl font-serif font-bold text-[#D4FF00]">{section.value}</p>
          <p className="text-xs text-neutral-400 font-mono mt-1 uppercase tracking-wider">{section.label}</p>
        </div>
      );
    case "list":
      return (
        <ul key={i} className="flex flex-col gap-2 my-4">
          {section.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-neutral-300 font-light">
              <span className="text-[#D4FF00] mt-1 shrink-0">▸</span>
              {item}
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol key={i} className="flex flex-col gap-4 my-4">
          {section.items.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-sm text-neutral-300 font-light">
              <span className="w-5 h-5 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/40 flex items-center justify-center text-[9px] font-mono text-[#D4FF00] shrink-0 mt-0.5">
                {j + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    case "scenario":
      return (
        <div key={i} className="border border-[#333] bg-[#0c0c0c] p-4 my-6">
          <p className="text-[8px] font-mono text-[#D4FF00] uppercase tracking-wider mb-3">{section.label}</p>
          <div className="flex flex-col gap-2">
            {section.messages.map((msg, j) => (
              <div key={j} className={`flex flex-col ${msg.from === "INVESTOR" || msg.from === "BUYER" ? "items-end" : "items-start"}`}>
                <span className="text-[7px] font-mono text-neutral-600 mb-0.5">{msg.from}</span>
                <div className={`px-3 py-1.5 text-[11px] max-w-[80%] ${
                  msg.from === "INVESTOR" || msg.from === "BUYER"
                    ? "bg-[#1c2e10]/80 text-[#D4FF00] border border-[#234412]"
                    : "bg-[#111] text-neutral-200 border border-[#222]"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div key={i} className="my-6 divide-y divide-[#222] border-t border-b border-[#222]">
          {section.items.map((item, j) => (
            <div key={j} className="py-4">
              <p className="text-sm font-medium text-white mb-1">{item.q}</p>
              <p className="text-xs text-neutral-300 font-light">{item.a}</p>
            </div>
          ))}
        </div>
      );
    case "metricBlock":
      return (
        <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          {section.metrics.map((metric, j) => (
            <div key={j} className="border border-[#333] p-4 text-center">
              <p className="text-xl font-serif font-bold text-[#D4FF00]">{metric.value}</p>
              <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider mt-1">{metric.label}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div key={i} className="overflow-x-auto my-6 border border-[#333]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#333] bg-[#111]">
                {section.headers.map((h, j) => (
                  <th key={j} className="p-3 text-[#D4FF00] font-bold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, j) => (
                <tr key={j} className="border-b border-[#222] last:border-0">
                  {row.map((cell, k) => (
                    <td key={k} className="p-3 text-neutral-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export default function InsightDetail() {
  const { slug } = useParams<{ slug: string }>();
  const insight = allInsights.find((i) => i.slug === slug);
  const { setState } = useBreadcrumb();

  useEffect(() => {
    if (insight) {
      setState({ category: insight.category, articleTitle: insight.title });
    }
    return () => setState({});
  }, [insight, setState]);

  if (!insight) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
        <p className="text-neutral-500 font-mono text-sm">Insight not found.</p>
        <Link to="/insights" className="text-[#D4FF00] font-mono text-xs underline hover:no-underline">← Back to Insights</Link>
      </div>
    );
  }

  const toc = insight.sections.filter((s): s is ArticleSection & { type: "h2" } => s.type === "h2");

  const faqSection = insight.sections.find((s): s is ArticleSection & { type: "faq"; items: { q: string; a: string }[] } => s.type === "faq");

  const jsonLdGraph: Record<string, any>[] = [
    {
      "@type": "BlogPosting",
      headline: insight.title,
      description: insight.excerpt,
      image: [insight.heroImage],
      datePublished: insight.publishedAt,
      dateModified: insight.updatedAt,
      author: {
        "@type": "Person",
        name: insight.author,
        description: insight.authorRole,
        image: insight.authorImage || undefined,
        sameAs: insight.authorLink || undefined,
        url: insight.authorLink || undefined,
      },
      publisher: {
        "@type": "Organization",
        name: "AURO",
        url: "https://auroapp.com",
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl(`/insights/${insight.slug}/`),
      },
      articleSection: INSIGHT_CATEGORY_LABELS[insight.category],
      wordCount: insight.sections.reduce((acc, s) => "text" in s ? acc + s.text.split(" ").length : acc, 0),
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["h1", "article p:first-of-type"],
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Insights", item: canonicalUrl("/insights/") },
        { "@type": "ListItem", position: 2, name: insight.title, item: canonicalUrl(`/insights/${insight.slug}/`) },
      ],
    },
  ];

  if (faqSection) {
    jsonLdGraph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqSection.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    });
  }

  return (
    <>
      <Seo
        metaTitle={insight.metaTitle}
        metaDescription={insight.metaDescription}
        canonicalUrl={canonicalUrl(`/insights/${insight.slug}/`)}
        ogImage={insight.heroImage}
        ogType="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": jsonLdGraph,
        }}
      />

      <article className="px-6 md:px-10 lg:px-16 py-8 max-w-4xl mx-auto">
        <Link to="/insights" className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-[#D4FF00] transition-colors mb-6">
          ← Back to Insights
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider">
              {INSIGHT_CATEGORY_LABELS[insight.category]}
            </span>
            <span className="text-[9px] font-mono text-neutral-600">{insight.readMinutes} min read</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] leading-tight">
            {insight.title}
          </h1>

          {insight.keyStat && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-2xl font-serif font-bold text-[#D4FF00]">{insight.keyStat.value}</span>
              <span className="text-xs text-neutral-400 font-mono uppercase tracking-wider">{insight.keyStat.label}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-4 text-[10px] font-mono text-neutral-500">
            {insight.authorImage && (
              <img src={insight.authorImage} alt={insight.author} className="w-6 h-6 rounded-full object-cover border border-[#333]" />
            )}
            <span>
              {insight.authorLink ? (
                <a href={insight.authorLink} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-[#D4FF00] transition-colors">
                  {insight.author}
                </a>
              ) : (
                insight.author
              )} — {insight.authorRole}
            </span>
            <span className="text-neutral-700">/</span>
            <span>{new Date(insight.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>

        {insight.heroImage && (
          <div className="relative mb-10 overflow-hidden">
            <div className="border border-[#333]">
              <img
                src={insight.heroImage}
                alt={insight.heroAlt}
                className="w-full h-auto max-h-[400px] object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border border-[#D4FF00]/15 pointer-events-none" />
            <div className="absolute top-12 right-12 w-1.5 h-1.5 rounded-full bg-[#D4FF00]/40 pointer-events-none" />
            <div className="absolute bottom-8 left-8 w-16 h-[1px] bg-gradient-to-r from-[#D4FF00]/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-8 left-8 w-[1px] h-8 bg-gradient-to-b from-[#D4FF00]/20 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[#D4FF00] pointer-events-none [clip-path:polygon(0%_0%,50%_100%,0%_100%)]" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#D4FF00]/40" />
          </div>
        )}

        <div className="border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-5 mb-10" role="complementary" aria-label="Article summary">
          <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider mb-2">Quick Answer</p>
          <p className="text-sm leading-relaxed text-neutral-200 font-light">
            {insight.excerpt}
          </p>
        </div>

        {toc.length > 1 && (
          <nav className="border border-[#333] bg-[#0c0c0c] p-5 mb-10">
            <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider mb-3">Table of Contents</p>
            <ul className="flex flex-col gap-1.5">
              {toc.map((section, i) => (
                <li key={i}>
                  <a
                    href={`#${section.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
                    className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light"
                  >
                    {section.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="flex flex-col gap-2">
          {insight.sections.map((section, i) => renderSection(section, i))}
        </div>

        <div className="mt-12 pt-8 border-t border-[#333]">
          <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider mb-4">Ready to nurture every lead into a booked meeting?</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              onClick={async (e) => {
                e.preventDefault();
                const cal = await (await import("@calcom/embed-react")).getCalApi({ namespace: "30min" });
                cal("modal", { calLink: "auro-app/30min" });
              }}
              className="px-5 py-2 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-[10px] font-mono uppercase tracking-widest font-bold transition-colors cursor-pointer inline-block"
            >
              Request Demo
            </a>
            <Link
              to="/insights"
              className="px-5 py-2 border border-[#333] text-neutral-400 hover:text-[#D4FF00] hover:border-[#D4FF00] text-[10px] font-mono uppercase tracking-widest transition-colors"
            >
              More Insights
            </Link>
          </div>
        </div>

        {insight.internalLinks.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider mr-2 self-center">Related:</span>
            {insight.internalLinks.map((link, i) => (
              <Link
                key={i}
                to={link.to}
                className="px-3 py-1 border border-[#333] text-[9px] font-mono text-neutral-400 hover:text-[#D4FF00] hover:border-[#D4FF00] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
