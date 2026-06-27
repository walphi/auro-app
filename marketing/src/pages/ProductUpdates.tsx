import React from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";

const updates = [
  {
    version: "AURO 2.0",
    date: "2026-03-15",
    title: "Multi-Agent Qualification & Persistent Nurturing",
    description: "AURO 2.0 introduces multi-agent orchestration, persistent follow-up across channels, and intelligent CRM handoff with full conversation context.",
    features: [
      "Multi-agent pool with dynamic routing",
      "Persistent nurturing engine with smart re-engagement",
      "CRM handover with full transcript and qualification score",
      "WhatsApp-native rich messaging support",
      "Real-time qualification dashboard",
    ],
    tag: "Major Release",
  },
  {
    version: "AURO 1.5",
    date: "2026-01-20",
    title: "Context Engine & Follow-Up Automation",
    description: "Enhanced context awareness and automated follow-up sequences that adapt to lead behavior and engagement patterns.",
    features: [
      "Context-aware conversation memory across sessions",
      "Automated follow-up sequences with adaptive timing",
      "Lead scoring based on intent signals",
      "Cal.com native booking integration",
    ],
    tag: "Feature Update",
  },
  {
    version: "AURO 1.0",
    date: "2025-11-01",
    title: "Initial Launch — AI Lead Qualification for WhatsApp",
    description: "The first release of AURO focused on instant WhatsApp lead engagement and structured qualification for Dubai real estate.",
    features: [
      "Instant WhatsApp response automation",
      "Structured budget, timeline, and intent qualification",
      "Basic lead nurturing sequences",
      "CRM sync integration",
      "White-glove onboarding & setup",
    ],
    tag: "Initial Release",
  },
];

export default function ProductUpdates() {
  return (
    <>
      <Seo
        metaTitle="Product Updates — AURO Release Notes"
        metaDescription="AURO product updates, feature releases, and version history for the AI-first lead nurturing and qualification platform."
        canonicalUrl={canonicalUrl("/product-updates/")}
      />

      <div className="px-6 md:px-10 lg:px-16 py-8 max-w-4xl mx-auto">
        <div className="mb-10 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">PRODUCT UPDATES</span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] mt-3 leading-tight">
            AURO Release Notes
          </h1>
          <p className="text-sm text-neutral-300 font-light mt-3 max-w-2xl">
            Track the evolution of AURO's lead nurturing and qualification platform.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[#333]" />

          {updates.map((update, idx) => (
            <div key={idx} className="relative pl-12 pb-12 last:pb-0">
              <div className="absolute left-[10px] top-1 w-[11px] h-[11px] rounded-full bg-[#0a0a0a] border-2 border-[#D4FF00] z-10" />

              <div className="border border-[#333] bg-[#0a0a0a]/80 p-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider border border-[#D4FF00]/30 px-2 py-0.5">
                    {update.tag}
                  </span>
                  <span className="text-[9px] font-mono text-neutral-500">{update.version}</span>
                  <span className="text-[9px] font-mono text-neutral-600">{new Date(update.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                </div>

                <h2 className="font-serif text-xl text-[#f4f4f4] mb-2">{update.title}</h2>
                <p className="text-xs text-neutral-300 font-light mb-4">{update.description}</p>

                <ul className="flex flex-col gap-1.5">
                  {update.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-[11px] text-neutral-300 font-mono">
                      <span className="text-[#D4FF00] shrink-0">▸</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border border-[#333] bg-[#0a0a0a]/80 p-6 text-center">
          <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider mb-2">Stay Updated</p>
          <p className="text-xs text-neutral-300 font-light mb-4">Get the latest AURO features and updates delivered to your inbox.</p>
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
        </div>
      </div>
    </>
  );
}
