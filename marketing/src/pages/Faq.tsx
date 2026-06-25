import React, { useState } from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";

const faqs = [
  { q: "What exactly is AURO?", a: "AURO is an AI-first lead nurturing and qualification agent for real estate teams. It engages every inquiry, follows up intelligently, qualifies intent, and helps convert conversations into booked meetings." },
  { q: "How does AURO improve lead quality?", a: "AURO asks structured questions around budget, timing, and interest, then nurtures each lead until the sales team only receives prospects who are genuinely worth their time." },
  { q: "How is AURO different from a standard chatbot?", a: "A chatbot responds. AURO nurtures. It remembers context, follows up over time, and guides each lead through a real sales journey instead of just answering questions." },
  { q: "Which channels does AURO integrate with?", a: "AURO can work across WhatsApp, websites, landing pages, and other inbound lead sources, keeping the nurturing journey connected." },
  { q: "How secure is our lead data?", a: "AURO is built with enterprise-grade security and designed to protect confidential lead and project data throughout the engagement process." },
  { q: "How long does it take to implement AURO?", a: "Implementation is designed to be fast and structured, with setup, training, and integration handled as a guided onboarding process." },
  { q: "Does AURO replace our existing CRM?", a: "No. AURO enhances your existing stack by qualifying and nurturing leads before handing them into your CRM with full context." },
  { q: "What is lead nurturing and how does AURO approach it?", a: "Lead nurturing is the process of building relationships with prospects at every stage of the sales journey. AURO automates this with intelligent follow-ups, contextual re-engagement, and persistent qualification so no lead falls through the cracks." },
  { q: "What is the investment required to get started?", a: "AURO begins with a one-time setup fee, followed by an ongoing service model for continued support, updates, and optimization." },
  { q: "How quickly will we see ROI?", a: "Because AURO improves speed-to-lead, nurturing consistency, and meeting conversion, teams typically see value through better efficiency and more qualified opportunities entering the pipeline." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function Faq() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <>
      <Seo
        metaTitle="FAQ — AURO Lead Nurturing & Qualification"
        metaDescription="Frequently asked questions about AURO's AI-first lead nurturing, qualification, WhatsApp integration, CRM handover, and Dubai real estate automation."
        canonicalUrl={canonicalUrl("/faq/")}
        jsonLd={faqJsonLd}
      />

      <div className="px-6 md:px-10 lg:px-16 py-8 max-w-4xl mx-auto">
        <div className="mb-10 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">05 // FAQ</span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] mt-3 leading-tight">
            Everything You Need To Know About <span className="italic text-[#D4FF00]">AURO</span>
          </h1>
          <p className="text-sm text-neutral-300 font-light mt-3 max-w-2xl">
            Frequently asked questions about the AURO platform, lead nurturing, qualification, and how it works for Dubai real estate.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[#222] border-t border-b border-[#222]">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full flex justify-between items-center text-left py-1 text-white hover:text-[#D4FF00] transition-colors cursor-pointer group"
                >
                  <span className="text-xs sm:text-sm font-sans tracking-wide font-normal pr-4 flex items-center gap-3">
                    <span className="text-[9px] font-mono text-neutral-500 tracking-normal select-none">
                      {String(idx + 1).padStart(2, "0")}.
                    </span>
                    {faq.q}
                  </span>
                  <svg
                    className={`w-4 h-4 shrink-0 text-neutral-600 group-hover:text-[#D4FF00] transition-transform duration-300 ${isOpen ? "rotate-90 text-[#D4FF00]" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-[200px] opacity-100 mt-2.5 pb-2" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-xs text-neutral-300 font-light leading-relaxed pl-8 max-w-[760px]">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-wider mb-4">Still have questions?</p>
          <a
            href="/"
            onClick={async (e) => {
              e.preventDefault();
              const cal = await (await import("@calcom/embed-react")).getCalApi({ namespace: "30min" });
              cal("modal", { calLink: "auro-app/30min" });
            }}
            className="px-6 py-2.5 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-[10px] font-mono uppercase tracking-widest font-bold transition-colors cursor-pointer inline-block"
          >
            Book a Demo
          </a>
        </div>
      </div>
    </>
  );
}
