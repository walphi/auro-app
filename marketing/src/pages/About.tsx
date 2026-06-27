import React from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import { getCalApi } from "@calcom/embed-react";

export default function About() {
  const handleDemoClick = async () => {
    try {
      const cal = await getCalApi({ namespace: "30min" });
      cal("modal", { calLink: "auro-app/30min" });
    } catch {}
  };

  return (
    <>
      <Seo
        metaTitle="About — AURO Lead Nurturing & Qualification"
        metaDescription="Learn how AURO was founded by seasoned real estate marketing veterans to solve lead qualification chaos for Dubai's elite real estate agencies and developers."
        canonicalUrl={canonicalUrl("/about/")}
      />

      <div className="px-6 md:px-10 lg:px-16 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">07 // ABOUT AURO</span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#f4f4f4] mt-3 leading-tight">
            The AURO Story:<br />
            Transforming Lead Qualification<br />
            in Elite Real Estate
          </h1>
        </div>

        {/* The Challenge We Solve */}
        <section className="mb-14 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="border-l-2 border-[#D4FF00] pl-4 mb-6">
            <span className="text-[9px] font-mono tracking-[0.3em] text-[#D4FF00] uppercase">The Challenge We Solve</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light">
            At AURO, we understand the singular challenge facing luxury real estate agencies and top-tier developers in the UAE: the chaos of overwhelming lead volume masking the scarcity of truly qualified buyers.
          </p>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light mt-4">
            Premium brands invest millions into generating interest, yet their most valuable resource — the time of their expert sales agents — is spent manually sifting through unqualified inquiries, often drowning in the high volume of traffic from the market's favourite communication channel. This inefficient process creates a massive bottleneck that costs millions in lost commissions and missed opportunities for off-plan and ready property sales.
          </p>
        </section>

        {/* Driven by Deep Market Expertise */}
        <section className="mb-14 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Profile Image Area */}
            <div className="md:col-span-1">
              <div className="aspect-square bg-neutral-900 border border-[#333] flex items-center justify-center text-neutral-700 font-mono text-[9px] uppercase tracking-widest overflow-hidden">
                <img
                  src="https://auroapp.com/phillip-profile.jpg"
                  alt="Phillip — AURO Founder"
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <span className="absolute hidden">Founder Photo</span>
              </div>
              <a
                href="https://www.linkedin.com/in/phillipdwalsh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[10px] font-mono text-neutral-400 hover:text-[#D4FF00] transition-colors mt-3"
              >
                View LinkedIn Profile →
              </a>
            </div>

            {/* Founder Text */}
            <div className="md:col-span-2 flex flex-col justify-center">
              <div className="text-[9px] font-mono tracking-[0.3em] text-[#D4FF00] uppercase mb-3">
                Driven by Deep Market Expertise
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-light text-white mb-4 italic">
                Phillip — AURO Founder
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300 font-light">
                AURO was founded not by mere technologists, but by seasoned industry veterans who have lived this pain.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300 font-light mt-3">
                Phillip, drawing on his executive experience as Marketing Director for top firms including Sotheby's Realty (UAE & UK), Betterhomes Head of Marketing and Automation, and Unique Properties Head of Marketing, brings a unique understanding of the complexities of high-stakes real estate marketing in the UAE.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300 font-light mt-3">
                He recognizes the precise moment a lead goes cold, the need for immediate, 24/7 engagement, and the critical importance of handing off only financially verified, ready-to-buy prospects to an agent.
              </p>
            </div>
          </div>
        </section>

        {/* Our Solution */}
        <section className="mb-10 opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="border-l-2 border-[#D4FF00] pl-4 mb-6">
            <span className="text-[9px] font-mono tracking-[0.3em] text-[#D4FF00] uppercase">Our Solution: Intelligent 24/7 Automation</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light mb-8">
            AURO was created to solve this problem by deploying sophisticated Multi-Agent AI directly into the heart of the sales process.
          </p>

          {/* Value Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="border border-[#333] bg-[#0a0a0a]/80 p-5 text-center">
              <div className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-widest mb-2">Reduce</div>
              <h3 className="font-serif text-lg text-white font-light mb-1">Qualification Time</h3>
              <p className="text-[10px] text-neutral-300 font-light leading-relaxed">
                Drastically cut the time it takes to convert a raw inquiry into a sales-ready lead.
              </p>
            </div>
            <div className="border border-[#333] bg-[#0a0a0a]/80 p-5 text-center">
              <div className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-widest mb-2">Operate</div>
              <h3 className="font-serif text-lg text-white font-light mb-1">24/7</h3>
              <p className="text-[10px] text-neutral-300 font-light leading-relaxed">
                Ensure every lead, whether received at 2 PM or 2 AM, receives an instant, intelligent response.
              </p>
            </div>
            <div className="border border-[#333] bg-[#0a0a0a]/80 p-5 text-center">
              <div className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-widest mb-2">Master</div>
              <h3 className="font-serif text-lg text-white font-light mb-1">The Market Tool</h3>
              <p className="text-[10px] text-neutral-300 font-light leading-relaxed">
                Run critical qualification conversations seamlessly via WhatsApp, where most high-intent inquiries begin.
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light">
            AURO automates the triage, filtering, and scoring, allowing your expert agents to focus exclusively on closing transactions, not chasing dead ends. We don't just generate leads; we manufacture sales-ready opportunities.
          </p>
        </section>

        {/* CTA */}
        <div className="text-center opacity-0 translate-y-5 animate-[reveal_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]">
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
