import React, { useEffect, useState, useRef } from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";

const WHATSAPP_URL =
  "https://wa.me/12098994972?text=Hi%20there%2C%20I%27d%20like%20to%20learn%20more%2C%20please%3F";

export default function WhatsAppAgent() {
  const [countdown, setCountdown] = useState(5);
  const redirected = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const redirect = setTimeout(() => {
      if (!redirected.current) {
        redirected.current = true;
        window.open(WHATSAPP_URL, "_blank");
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, []);

  const handleOpenWhatsApp = () => {
    if (!redirected.current) {
      redirected.current = true;
      window.open(WHATSAPP_URL, "_blank");
    }
  };

  return (
    <>
      <Seo
        metaTitle="Chat with AURO on WhatsApp"
        metaDescription="Talk to AURO — your AI lead nurturing and qualification agent."
        canonicalUrl={canonicalUrl("/agents/")}
        robots="noindex, nofollow"
      />

      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
        {/* AURO Logo */}
        <div className="mb-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D4FF00"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m14.31 8 5.74 9.94" />
            <path d="M9.69 8h11.48" />
            <path d="m7.38 12 5.74-9.94" />
            <path d="M9.69 16 3.95 6.06" />
            <path d="M14.31 16H2.83" />
            <path d="m16.62 12-5.74 9.94" />
          </svg>
        </div>

        <h1 className="font-serif italic text-3xl sm:text-4xl text-[#f4f4f4] font-light mb-4">
          Chat with AURO on WhatsApp
        </h1>

        <p className="text-sm text-neutral-300 font-light max-w-md mb-8 leading-relaxed">
          Your AI lead nurturing and qualification agent is ready to help.
          You&rsquo;ll be redirected to WhatsApp in a moment.
        </p>

        <button
          onClick={handleOpenWhatsApp}
          className="px-8 py-3 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-xs font-mono uppercase tracking-widest cursor-pointer transition-all duration-300 mb-6"
        >
          Open WhatsApp
        </button>

        <p className="text-[10px] font-mono text-neutral-500">
          Redirecting in {countdown}s&hellip;
        </p>

        <p className="text-[10px] font-mono text-neutral-600 mt-6">
          Not redirected?{" "}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D4FF00] hover:underline"
          >
            Click here
          </a>
        </p>
      </div>
    </>
  );
}
