import React, { useState, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate, ScrollRestoration } from "react-router-dom";
import { FloatingNav } from "./FloatingNav.tsx";
import { MobileOverlay } from "./MobileOverlay.tsx";
import { Breadcrumbs } from "./Breadcrumbs.tsx";
import { Seo } from "./Seo.tsx";
import { BreadcrumbProvider } from "../lib/BreadcrumbContext.tsx";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, canonicalUrl, SITE_ADDRESS, SITE_CONTACT } from "../lib/site.ts";
import { getCalApi } from "@calcom/embed-react";

const sitewideJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/auro-og.png`,
      address: SITE_ADDRESS,
      contactPoint: SITE_CONTACT,
      areaServed: ["Dubai", "UAE", "Middle East"],
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@type": "Organization", name: SITE_NAME },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/insights?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export function SiteLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [audioActive, setAudioActive] = useState(false);

  const handleAudioData = useCallback((amp: number, active: boolean) => {
    setAudioAmplitude(amp);
    setAudioActive(active);
  }, []);

  const handleNavClick = useCallback((stageIdx: number) => {
    if (stageIdx === 0) {
      navigate("/");
    } else if (stageIdx === 1) {
      navigate("/");
    } else if (stageIdx === 2) {
      navigate("/");
    } else if (stageIdx === 3) {
      navigate("/");
    } else if (stageIdx === 5) {
      handleDemoClick();
    }
  }, [navigate]);

  const handleDemoClick = async () => {
    try {
      const cal = await getCalApi({ namespace: "30min" });
      cal("modal", { calLink: "auro-app/30min" });
    } catch {}
  };

  return (
    <div className="relative w-full min-h-screen text-[#e8ece4] bg-black selection:bg-[#D4FF00]/30 selection:text-white">
      <ScrollRestoration />
      <Seo
        metaTitle={SITE_NAME}
        metaDescription={SITE_DESCRIPTION}
        canonicalUrl={canonicalUrl(location.pathname)}
        jsonLd={sitewideJsonLd}
      />

      <div className="sr-only">
        <nav aria-label="Site Navigation">
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/insights">Insights</a></li>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/product-updates">Product Updates</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/solutions">Solutions</a></li>
            <li><a href="/lead-nurturing-definition">Lead Nurturing Definition</a></li>
            <li><a href="/what-is-lead-nurturing">What Is Lead Nurturing</a></li>
            <li><a href="/lead-nurturing-strategy">Lead Nurturing Strategy</a></li>
            <li><a href="/lead-nurturing-automation">Lead Nurturing Automation</a></li>
            <li><a href="/ai-marketing-real-estate">AI Marketing Real Estate</a></li>
            <li><a href="/real-estate-marketing-dubai">Real Estate Marketing Dubai</a></li>
            <li><a href="/booking-automation-dubai-real-estate">Booking Automation Dubai</a></li>
          </ul>
        </nav>
      </div>

      <FloatingNav
        isVisible={true}
        onNavClick={handleNavClick}
        isMenuOpen={isMenuOpen}
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
        onLoginClick={handleDemoClick}
        onAudioData={handleAudioData}
      />

      <MobileOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        items={[
          { label: "00 // HOME", onClick: () => navigate("/") },
          { label: "01 // HOW IT WORKS", onClick: () => navigate("/") },
          { label: "02 // REVENUE", onClick: () => navigate("/") },
          { label: "03 // ABOUT", onClick: () => navigate("/about") },
          { label: "04 // INSIGHTS", onClick: () => navigate("/insights") },
          { label: "05 // FAQ", onClick: () => navigate("/faq") },
          { label: "06 // SOLUTIONS", onClick: () => navigate("/solutions") },
          { label: "07 // CLIENT LOGIN", onClick: () => { window.location.href = "/dashboard"; } },
          { label: "REQUEST EARLY ACCESS", onClick: () => { window.location.href = "/#cta"; }, isCta: true },
        ]}
      />

      <BreadcrumbProvider>
        <Breadcrumbs />
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
      </BreadcrumbProvider>

      <footer className="site-footer z-20 border-t border-[#333] bg-[#0a0a0a] p-[60px_40px_40px]">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4FF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="m14.31 8 5.74 9.94"/>
                <path d="M9.69 8h11.48"/>
                <path d="m7.38 12 5.74-9.94"/>
                <path d="M9.69 16 3.95 6.06"/>
                <path d="M14.31 16H2.83"/>
                <path d="m16.62 12-5.74 9.94"/>
              </svg>
              <span className="font-serif italic text-2xl tracking-tighter text-[#D4FF00] select-none font-bold">AURO</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-500 font-light max-w-[260px]">
              The AI-first lead nurturing and qualification agent for Dubai's leading real estate agencies and developers.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">Platform</div>
            <Link to="/" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Home</Link>
            <Link to="/faq" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// FAQ</Link>
            <Link to="/product-updates" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Product Updates</Link>
            <Link to="/about" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// About</Link>
            <Link to="/solutions" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Solutions</Link>
            <Link to="/dashboard" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Login</Link>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">Resources</div>
            <Link to="/lead-nurturing-definition" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Lead Nurturing</Link>
            <Link to="/insights" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Insights</Link>
            <Link to="/ai-marketing-real-estate" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// AI Marketing</Link>
            <Link to="/real-estate-marketing-dubai" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Dubai Real Estate</Link>
            <Link to="/booking-automation-dubai-real-estate" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-mono">// Booking Automation</Link>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">Connect</div>
            <div className="text-neutral-400 font-mono text-xs cursor-default flex flex-col gap-1.5">
              <span>// Dubai, United Arab Emirates</span>
              <a href="mailto:pw@auroapp.com" className="hover:text-[#D4FF00] transition-colors text-[#D4FF00] underline">pw@auroapp.com</a>
            </div>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto mt-10 pt-6 border-t border-[#333] flex flex-wrap justify-between items-center gap-6">
          <div className="flex gap-4 items-center select-none">
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] shadow-[0_0_8px_#D4FF00]" />
            <span className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 uppercase italic">Status // System Synced</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 tracking-[0.1em] uppercase">© 2026 AURO Technologies. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
