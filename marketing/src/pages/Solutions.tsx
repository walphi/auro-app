import React from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import { getCalApi } from "@calcom/embed-react";
import {
  Zap,
  MessageSquare,
  BrainCircuit,
  UserCheck,
  Database,
  Lock,
} from "lucide-react";

const steps = [
  {
    num: 1,
    icon: Zap,
    title: "Lead Inbound",
    detail: "Ads, Portals, Website",
  },
  {
    num: 2,
    icon: MessageSquare,
    title: "Instant Greeting",
    detail: "WhatsApp < 2s Response",
  },
  {
    num: 3,
    icon: BrainCircuit,
    title: "AI Qualification",
    detail: "Budget, Intent, Timeline",
    highlighted: true,
  },
  {
    num: 4,
    icon: UserCheck,
    title: "Scoring & Filtering",
    detail: "Qualified vs. Unqualified",
  },
  {
    num: 5,
    icon: Database,
    title: "CRM Sync & Handover",
    detail: "Agent Takes Over",
  },
];

export default function Solutions() {
  const handleDemoClick = async () => {
    try {
      const cal = await getCalApi({ namespace: "30min" });
      cal("modal", { calLink: "auro-app/30min" });
    } catch {}
  };

  return (
    <>
      <Seo
        metaTitle="Solutions — AURO Lead Nurturing & Qualification"
        metaDescription="See how AURO transforms a chaotic flood of leads into a streamlined pipeline of qualified investors with multi-agent AI qualification."
        canonicalUrl={canonicalUrl("/solutions/")}
      />

      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#D4FF00]/[0.015] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#D4FF00]/[0.01] blur-[120px]" />
      </div>

      <div className="px-6 md:px-10 lg:px-16 py-8 max-w-6xl mx-auto relative z-10">
        {/* Hero */}
        <div className="mb-14 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">06 // SOLUTIONS</span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] mt-3 leading-tight">
            Visualize Your Efficiency:<br />
            <span className="italic text-[#D4FF00]">The AURO Qualification Journey</span>
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light mt-4 max-w-2xl">
            See how AURO transforms a chaotic flood of leads into a streamlined pipeline of qualified investors.
          </p>
        </div>

        {/* 5-Step Process */}
        <section className="mb-16">
          <div className="relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-4 relative">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isHighlighted = step.highlighted;

                return (
                  <div
                    key={step.num}
                    className="flex flex-col items-center text-center opacity-0 translate-y-5"
                    style={{ animation: `reveal 0.9s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.15}s forwards` }}
                  >
                    <div
                      className={`flex items-center justify-center relative ${
                        isHighlighted
                          ? "w-20 h-20 border-2 border-[#D4FF00] bg-[#0a0a0a] shadow-[0_0_30px_-10px_#D4FF00] scale-110"
                          : "w-16 h-16 border border-[#333] bg-[#0a0a0a]/80"
                      }`}
                    >
                      <span
                        className={`absolute -top-2 -right-2 w-5 h-5 bg-[#D4FF00] text-black text-[8px] font-mono font-bold flex items-center justify-center ${
                          isHighlighted ? "scale-110" : ""
                        }`}
                      >
                        {step.num}
                      </span>
                      <Icon className={`${isHighlighted ? "w-6 h-6" : "w-5 h-5"} text-[#D4FF00]`} />
                    </div>
                    <h3
                      className={`font-serif mt-3 ${
                        isHighlighted ? "text-base text-white" : "text-sm text-white"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1 leading-relaxed max-w-[120px]">
                      {step.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Multi-Agent AI Architecture */}
            <div
              className="border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 opacity-0 translate-y-5"
              style={{ animation: `reveal 0.9s cubic-bezier(0.16,1,0.3,1) 0.6s forwards` }}
            >
              <div className="w-10 h-10 border border-[#D4FF00]/30 bg-[#D4FF00]/10 flex items-center justify-center mb-5">
                <BrainCircuit className="w-5 h-5 text-[#D4FF00]" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light text-white mb-3">
                Multi-Agent AI Architecture
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300 font-light mb-5">
                AURO isn't just a chatbot. It's a system of specialized AI agents working together. One agent handles language translation, another manages objection handling, and a third focuses purely on financial qualification.
              </p>
              <ul className="flex flex-col gap-2.5">
                {[
                  "Context-aware conversations (remembers previous chats)",
                  "RAG (Retrieval-Augmented Generation) for project knowledge",
                  "Sentiment analysis to detect hot leads",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 font-light">
                    <span className="text-[#D4FF00] mt-0.5 shrink-0">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2: Enterprise-Grade Security */}
            <div
              className="border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 opacity-0 translate-y-5"
              style={{ animation: `reveal 0.9s cubic-bezier(0.16,1,0.3,1) 0.8s forwards` }}
            >
              <div className="w-10 h-10 border border-[#D4FF00]/30 bg-[#D4FF00]/10 flex items-center justify-center mb-5">
                <Lock className="w-5 h-5 text-[#D4FF00]" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light text-white mb-3">
                Enterprise-Grade Security
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300 font-light mb-5">
                We understand that your lead data is your most valuable asset. AURO is built with enterprise security standards to ensure your data never leaves your control.
              </p>
              <ul className="flex flex-col gap-2.5">
                {[
                  "End-to-End Encryption",
                  "GDPR & UAE Data Privacy Compliant",
                  "Role-Based Access Control",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 font-light">
                    <span className="text-[#D4FF00] mt-0.5 shrink-0">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_1s_forwards]">
          <h2 className="font-serif text-2xl sm:text-3xl font-light text-white mb-6">
            Ready to automate your qualification?
          </h2>
          <button
            onClick={handleDemoClick}
            className="px-6 py-2.5 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-[10px] sm:text-xs font-mono uppercase tracking-widest cursor-pointer transition-all duration-300 font-bold"
          >
            Request Demo
          </button>
        </div>
      </div>
    </>
  );
}
