import React, { useEffect, useState } from "react";
import { Seo } from "../components/Seo.tsx";

export default function ContactDemo() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cal = await (await import("@calcom/embed-react")).getCalApi({ namespace: "30min" });
        cal("modal", { calLink: "auro-app/30min" });
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();
  }, []);

  return (
    <>
      <Seo
        metaTitle="Book a Demo | AURO"
        metaDescription="Schedule a demo of AURO — the AI-first lead nurturing and qualification platform for Dubai real estate."
        canonicalUrl="https://auroapp.com/contact/demo/"
        ogType="website"
        robots="index, follow"
      />
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        {!loaded ? (
          <p className="text-neutral-400 font-mono text-sm">Opening booking calendar...</p>
        ) : (
          <>
            <p className="text-neutral-300 font-mono text-sm mb-4">
              If the booking window doesn't appear, click below:
            </p>
            <button
              onClick={async () => {
                const cal = await (await import("@calcom/embed-react")).getCalApi({ namespace: "30min" });
                cal("modal", { calLink: "auro-app/30min" });
              }}
              className="px-6 py-3 border border-[#D4FF00]/30 bg-[#D4FF00]/5 text-[#D4FF00] text-[10px] font-mono uppercase tracking-wider hover:bg-[#D4FF00] hover:text-black transition-colors"
            >
              Book a Demo
            </button>
          </>
        )}
      </div>
    </>
  );
}
