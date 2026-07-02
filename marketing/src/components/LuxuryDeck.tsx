import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Slide } from "../data/christiesSlides.ts";

interface LuxuryDeckProps {
  slides: Slide[];
}

const BURGUNDY = "#7a1a1a";

export default function LuxuryDeck({ slides }: LuxuryDeckProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [showThankYou, setShowThankYou] = useState(false);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLast = current === slides.length - 1;
  const slide = slides[current];

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      setDirection(index > current ? "forward" : "back");
      setCurrent(index);
      setShowThankYou(false);
    },
    [current, slides.length]
  );

  const next = useCallback(() => {
    if (isLast) {
      setShowThankYou(true);
      return;
    }
    setDirection("forward");
    setCurrent((p) => Math.min(p + 1, slides.length - 1));
  }, [isLast, slides.length]);

  const prev = useCallback(() => {
    if (showThankYou) {
      setShowThankYou(false);
      setCurrent(slides.length - 1);
      return;
    }
    setDirection("back");
    setCurrent((p) => Math.max(p - 1, 0));
  }, [showThankYou, slides.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0) next();
      else prev();
    }
  };

  return (
    <div
      ref={containerRef}
      className="christies-deck min-h-dvh bg-[#fcfaf7] flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        .christies-deck [data-animate] {
          animation: slideFade 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) both;
        }
        @keyframes slideFade {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .christies-deck [data-slide-in="forward"] {
          animation: slideInRight 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) both;
        }
        .christies-deck [data-slide-in="back"] {
          animation: slideInLeft 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) both;
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(36px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-36px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .dot-active { background-color: ${BURGUNDY}; }
        .dot-inactive { background-color: transparent; border: 2px solid ${BURGUNDY}; opacity: 0.35; }
      `}</style>

      {/* Header bar */}
      <header className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5 border-b border-[#7a1a1a]/10">
        <a href="/" className="flex items-center gap-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BURGUNDY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m14.31 8 5.74 9.94" />
            <path d="M9.69 8h11.48" />
            <path d="m7.38 12 5.74-9.94" />
            <path d="M9.69 16 3.95 6.06" />
            <path d="M14.31 16H2.83" />
            <path d="m16.62 12-5.74 9.94" />
          </svg>
          <span className="font-serif italic text-lg tracking-tight text-[#1a1a1a] select-none">AURO</span>
        </a>
        <span className="text-[10px] font-sans text-[#4a4a4a] tracking-wider uppercase select-none">
          Christie&rsquo;s Brief
        </span>
      </header>

      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-8 sm:py-12">
        <div className="w-full max-w-3xl mx-auto">
          {showThankYou ? (
            <div data-animate className="text-center">
              <div className="flex items-center justify-center gap-4 mb-8">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BURGUNDY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m14.31 8 5.74 9.94" />
                  <path d="M9.69 8h11.48" />
                  <path d="m7.38 12 5.74-9.94" />
                  <path d="M9.69 16 3.95 6.06" />
                  <path d="M14.31 16H2.83" />
                  <path d="m16.62 12-5.74 9.94" />
                </svg>
                <svg viewBox="0 0 300 92.61" className="h-7 w-auto fill-[#1a1a1a]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                  <path d="M183.41,85.67v-.71h92.64v.71h-92.64Z" />
                  <g>
                    <path d="M124.84,91.14v-11.51h4.35c3.6,0,6.26,1.48,6.26,5.47,0,3.61-2.78,6.04-6.68,6.04h-3.92ZM128.67,89.86c2.28,0,4.76-1.16,4.76-4.54,0-2.69-1.52-4.42-4.43-4.42h-2.4v8.41c0,.44.22.55.53.55h1.55Z" />
                    <path d="M137.78,87.02v-7.38h1.76v7.14c0,1.79.7,3.32,2.74,3.32,2.23,0,2.86-1.52,2.86-3.55v-6.92h1.65v7.06c0,3.07-1.62,4.69-4.59,4.69s-4.43-1.5-4.43-4.36Z" />
                    <path d="M150.57,91.14v-11.51h3.46c1.88,0,3.99.38,3.99,2.47,0,1.62-1.55,2.39-2.28,2.63v.07c1.55.07,3.12.95,3.12,2.8,0,1.52-1.09,3.55-4.35,3.55h-3.94ZM153.67,84.46c1.23,0,2.56-.48,2.56-1.93,0-1.35-.9-1.79-2.56-1.79h-1.35v3.72h1.35ZM154.04,90.05c1.3,0,2.75-.46,2.75-2.25s-1.35-2.3-2.92-2.3h-1.55v4.07c0,.41.24.48.55.48h1.18Z" />
                    <path d="M168.57,91.23l-.14-.09-1.31-3.6h-4.62l-1.45,3.6-.14.09-1.35-.14,4.89-11.73h1.35l4.5,11.73-1.74.14ZM165.35,82.74c-.19-.49-.36-1.01-.41-1.47h-.07c-.07.46-.29,1.04-.48,1.5l-1.47,3.63h3.77l-1.35-3.67Z" />
                    <path d="M172.32,91.14v-11.51h1.76v11.51h-1.76Z" />
                  </g>
                  <path d="M23.98,85.67v-.71h91.91v.71H23.98Z" />
                  <g>
                    <g>
                      <rect x="24.06" y="48.19" width="1.84" height="11.68" />
                      <path d="M38.62,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.72.9.81,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.23Z" />
                      <polygon points="48.15 49.52 48.15 59.87 46.31 59.87 46.31 49.52 41.91 49.52 41.91 48.19 52.53 48.19 52.53 49.52 48.15 49.52" />
                      <path d="M61.81,59.87h-7.22v-11.69h7.01v1.32h-5.16v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.02l-.2,1.32Z" />
                      <path d="M71.82,59.96l-.13-.09-4.91-6.06h.62c1.54,0,3-.61,3-2.32,0-1.82-1.32-2.18-3.06-2.18h-1.07v10.56h-1.84v-11.69h3.57c2,0,4.38.43,4.38,3,0,1.78-1.38,2.86-2.89,3.24l4.56,5.4-2.23.14Z" />
                      <path d="M85.18,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.71.9.8,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.23Z" />
                      <path d="M94.45,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.31,1.06-.5,1.52l-1.53,3.69h3.95l-1.41-3.72ZM97.83,59.96l-.14-.08-1.38-3.65h-4.85l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                      <polygon points="105.01 49.52 105.01 59.87 103.17 59.87 103.17 49.52 98.77 49.52 98.77 48.19 109.39 48.19 109.39 49.52 105.01 49.52" />
                      <rect x="111.49" y="48.19" width="1.84" height="11.68" />
                      <path d="M121.84,49.12c-1.86,0-3.95,1.04-3.95,4.92s1.95,4.85,3.97,4.85,3.97-1.14,3.97-4.85-2-4.92-3.99-4.92M121.86,60.15c-3.54,0-5.97-2.1-5.97-6.11s2.97-6.18,5.97-6.18c3.22,0,5.97,1.89,5.97,6.18,0,3.53-2.68,6.11-5.97,6.11" />
                      <path d="M139.46,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.72.9.8,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.24Z" />
                      <path d="M148.74,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.31,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM152.11,59.96l-.14-.08-1.38-3.65h-4.84l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                      <path d="M177.36,59.96l-.13-.09-4.91-6.06h.62c1.54,0,3.01-.61,3.01-2.32,0-1.82-1.32-2.18-3.06-2.18h-1.08v10.56h-1.84v-11.69h3.57c2.01,0,4.38.43,4.38,3,0,1.78-1.38,2.86-2.9,3.24l4.56,5.4-2.24.14Z" />
                      <path d="M188.87,59.87h-7.22v-11.69h7v1.32h-5.16v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.02l-.19,1.32Z" />
                      <path d="M196.39,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.3,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM199.77,59.96l-.14-.08-1.38-3.65h-4.84l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                      <path d="M210.79,59.87h-7.22v-11.69h1.84v9.82c0,.45.23.55.55.55h5.03l-.2,1.32Z" />
                      <path d="M224.85,59.87h-7.22v-11.69h7.01v1.32h-5.17v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.56.55h5.02l-.2,1.32Z" />
                      <path d="M230.08,60.12c-1.16,0-2.27-.26-3.16-.73l.54-1.33c.57.35,1.62.74,2.74.74,1.25,0,2.7-.54,2.7-1.92,0-1.2-1.05-1.76-2.06-2.18l-1.46-.62c-1.22-.52-2.31-1.35-2.31-2.87,0-2.08,2.04-3.31,4.13-3.31,1.12,0,2.05.26,2.89.69l-.63,1.4c-.52-.36-1.48-.78-2.46-.78-1.39,0-2.23.59-2.23,1.52s.8,1.39,1.89,1.87l1.59.69c1.2.52,2.4,1.53,2.4,3.05,0,2.37-2.2,3.77-4.56,3.77" />
                      <polygon points="242.12 49.52 242.12 59.87 240.28 59.87 240.28 49.52 235.88 49.52 235.88 48.19 246.5 48.19 246.5 49.52 242.12 49.52" />
                      <path d="M251.52,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.3,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM254.9,59.96l-.14-.08-1.38-3.65h-4.85l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                      <polygon points="262.08 49.52 262.08 59.87 260.24 59.87 260.24 49.52 255.84 49.52 255.84 48.19 266.46 48.19 266.46 49.52 262.08 49.52" />
                      <path d="M275.74,59.87h-7.22v-11.69h7.01v1.32h-5.17v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.03l-.2,1.32Z" />
                      <path d="M163.2,59.87h-7.22v-11.69h1.84v9.82c0,.45.23.55.55.55h5.02l-.2,1.32Z" />
                    </g>
                    <path d="M22.02,40.23c5.73,0,10-1.57,13.33-1.42l3.14-9.07h-1.08c-3.14,5.78-7.6,9.16-13.57,9.16-9.16,0-15.83-7.84-15.83-17.98,0-11.17,5.49-18.38,14.65-18.38,6.03,0,10.78,3.09,13.82,9.46h1.08l-1.57-10.24h-.88c-.39.74-.93.98-1.71.98-1.42,0-4.51-1.52-10.93-1.52-12.25,0-21.46,8.09-21.46,19.99,0,10.68,9.75,19.01,21.02,19.01M41.08,39.35h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46v-11.22h20.63v11.22c0,3.58-.83,4.26-5.39,4.46v.98h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v10.73s-20.63,0-20.63,0v-10.73c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM86.5,39.35h17.15v-.98c-5.83-.19-6.37-.64-6.37-4.95v-10.14c1.86.74,4.36,1.18,6.66,1.23l2.55,3.38c6.42,8.63,10.53,11.96,16.27,11.96v-.93c-2.55-.59-4.02-3.14-10.05-11.17l-3.18-4.26c4.07-1.42,7.3-4.46,7.3-9.51,0-4.16-2.65-9.16-14.16-9.16-2.65,0-7.84.25-16.17.25v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM97.28,22.4V6.22c1.22-.15,2.4-.2,3.63-.2,8.38,0,10.29,4.26,10.29,8.04,0,4.9-3.18,8.67-10.34,8.67-1.32,0-2.55-.1-3.58-.34M124.86,39.35h16.17v-.98c-4.56-.2-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM144.95,30.73l1.47,8.97h.83c.49-.78,1.18-1.03,1.86-1.03,1.76,0,4.7,1.57,8.97,1.57,6.86,0,11.66-3.92,11.66-9.75,0-12.1-19.01-11.56-19.01-19.65,0-2.84,2.16-5.39,6.32-5.39s7.64,2.01,10.29,7.4h1.08l-1.27-8.18h-.83c-.29.64-.78.88-1.47.88-1.71,0-4.21-1.37-8.03-1.37-6.03,0-10.34,3.38-10.34,8.67,0,10.88,18.72,11.07,18.72,19.75,0,3.53-2.79,6.37-7.3,6.37-4.31,0-9.26-2.64-11.86-8.23h-1.08ZM173.18,13.82h1.08c2.4-5.64,4.85-7.06,12.69-7.06h1.18v27.15c0,3.58-.83,4.26-5.39,4.46v.98h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V6.76s.88,0,.88,0c8.09,0,10.58,1.42,12.99,7.06h1.08l-1.42-9.26h-.78c-.64.69-1.37.98-3.82.98h-23.22c-2.45,0-3.19-.29-3.82-.98h-.78l-1.42,9.26ZM210.32,39.35h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM229.72,39.35h16.71c6.32,0,9.41.15,12.35.39l3.09-8.62h-1.08c-3.43,5.88-6.47,6.96-13.82,6.96h-1.08c-4.56,0-5.39-.88-5.39-4.46v-11.37s.68,0,.68,0c10.88,0,11.91.44,12.79,5.34h.98v-11.47h-.98c-.69,4.17-1.96,4.75-11.76,4.75h-1.71V6.37s4.8,0,4.8,0c7.05,0,9.7,1.13,12.1,6.32h1.08l-1.47-7.65h-27.29v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98Z" />
                  </g>
                </svg>
              </div>
              <h2 className="font-serif italic text-4xl sm:text-5xl font-light text-[#1a1a1a] mb-4">
                Thank You
              </h2>
              <p className="text-[#4a4a4a] font-sans text-sm sm:text-base max-w-md mx-auto mb-6 leading-relaxed">
                Prepared for Christie&rsquo;s International Real Estate Dubai.
              </p>
              <p className="text-[#7a1a1a] font-sans text-xs tracking-wider uppercase mb-10">
                Presented by Phillip Walsh &mdash; Founder, Auro App
              </p>
              <a
                href="/"
                className="inline-block px-6 py-2.5 bg-[#7a1a1a] text-white font-sans text-xs uppercase tracking-widest hover:bg-[#5e1414] transition-colors no-underline"
              >
                Return to AURO
              </a>
            </div>
          ) : (
            <div key={slide.id} data-slide-in={direction} className="select-none">
              {/* Title slide */}
              {slide.isTitle ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-5 mb-10">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={BURGUNDY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m14.31 8 5.74 9.94" />
                      <path d="M9.69 8h11.48" />
                      <path d="m7.38 12 5.74-9.94" />
                      <path d="M9.69 16 3.95 6.06" />
                      <path d="M14.31 16H2.83" />
                      <path d="m16.62 12-5.74 9.94" />
                    </svg>
                    <svg viewBox="0 0 300 92.61" className="h-9 w-auto fill-[#1a1a1a]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                      <path d="M183.41,85.67v-.71h92.64v.71h-92.64Z" />
                      <g>
                        <path d="M124.84,91.14v-11.51h4.35c3.6,0,6.26,1.48,6.26,5.47,0,3.61-2.78,6.04-6.68,6.04h-3.92ZM128.67,89.86c2.28,0,4.76-1.16,4.76-4.54,0-2.69-1.52-4.42-4.43-4.42h-2.4v8.41c0,.44.22.55.53.55h1.55Z" />
                        <path d="M137.78,87.02v-7.38h1.76v7.14c0,1.79.7,3.32,2.74,3.32,2.23,0,2.86-1.52,2.86-3.55v-6.92h1.65v7.06c0,3.07-1.62,4.69-4.59,4.69s-4.43-1.5-4.43-4.36Z" />
                        <path d="M150.57,91.14v-11.51h3.46c1.88,0,3.99.38,3.99,2.47,0,1.62-1.55,2.39-2.28,2.63v.07c1.55.07,3.12.95,3.12,2.8,0,1.52-1.09,3.55-4.35,3.55h-3.94ZM153.67,84.46c1.23,0,2.56-.48,2.56-1.93,0-1.35-.9-1.79-2.56-1.79h-1.35v3.72h1.35ZM154.04,90.05c1.3,0,2.75-.46,2.75-2.25s-1.35-2.3-2.92-2.3h-1.55v4.07c0,.41.24.48.55.48h1.18Z" />
                        <path d="M168.57,91.23l-.14-.09-1.31-3.6h-4.62l-1.45,3.6-.14.09-1.35-.14,4.89-11.73h1.35l4.5,11.73-1.74.14ZM165.35,82.74c-.19-.49-.36-1.01-.41-1.47h-.07c-.07.46-.29,1.04-.48,1.5l-1.47,3.63h3.77l-1.35-3.67Z" />
                        <path d="M172.32,91.14v-11.51h1.76v11.51h-1.76Z" />
                      </g>
                      <path d="M23.98,85.67v-.71h91.91v.71H23.98Z" />
                      <g>
                        <g>
                          <rect x="24.06" y="48.19" width="1.84" height="11.68" />
                          <path d="M38.62,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.72.9.81,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.23Z" />
                          <polygon points="48.15 49.52 48.15 59.87 46.31 59.87 46.31 49.52 41.91 49.52 41.91 48.19 52.53 48.19 52.53 49.52 48.15 49.52" />
                          <path d="M61.81,59.87h-7.22v-11.69h7.01v1.32h-5.16v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.02l-.2,1.32Z" />
                          <path d="M71.82,59.96l-.13-.09-4.91-6.06h.62c1.54,0,3-.61,3-2.32,0-1.82-1.32-2.18-3.06-2.18h-1.07v10.56h-1.84v-11.69h3.57c2,0,4.38.43,4.38,3,0,1.78-1.38,2.86-2.89,3.24l4.56,5.4-2.23.14Z" />
                          <path d="M85.18,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.71.9.8,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.23Z" />
                          <path d="M94.45,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.31,1.06-.5,1.52l-1.53,3.69h3.95l-1.41-3.72ZM97.83,59.96l-.14-.08-1.38-3.65h-4.85l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                          <polygon points="105.01 49.52 105.01 59.87 103.17 59.87 103.17 49.52 98.77 49.52 98.77 48.19 109.39 48.19 109.39 49.52 105.01 49.52" />
                          <rect x="111.49" y="48.19" width="1.84" height="11.68" />
                          <path d="M121.84,49.12c-1.86,0-3.95,1.04-3.95,4.92s1.95,4.85,3.97,4.85,3.97-1.14,3.97-4.85-2-4.92-3.99-4.92M121.86,60.15c-3.54,0-5.97-2.1-5.97-6.11s2.97-6.18,5.97-6.18c3.22,0,5.97,1.89,5.97,6.18,0,3.53-2.68,6.11-5.97,6.11" />
                          <path d="M139.46,60.06l-6.88-8.81c-.2-.26-.45-.59-.57-.9h-.09c0,.25.02.73.02,1.18v8.34h-1.54v-11.63l1.97-.14.14.09,5.79,7.62c.18.24.72.9.8,1.23h.07c0-.31-.02-.9-.02-1.31v-7.53h1.54v11.88h-1.24Z" />
                          <path d="M148.74,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.31,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM152.11,59.96l-.14-.08-1.38-3.65h-4.84l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                          <path d="M177.36,59.96l-.13-.09-4.91-6.06h.62c1.54,0,3.01-.61,3.01-2.32,0-1.82-1.32-2.18-3.06-2.18h-1.08v10.56h-1.84v-11.69h3.57c2.01,0,4.38.43,4.38,3,0,1.78-1.38,2.86-2.9,3.24l4.56,5.4-2.24.14Z" />
                          <path d="M188.87,59.87h-7.22v-11.69h7v1.32h-5.16v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.02l-.19,1.32Z" />
                          <path d="M196.39,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.3,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM199.77,59.96l-.14-.08-1.38-3.65h-4.84l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                          <path d="M210.79,59.87h-7.22v-11.69h1.84v9.82c0,.45.23.55.55.55h5.03l-.2,1.32Z" />
                          <path d="M224.85,59.87h-7.22v-11.69h7.01v1.32h-5.17v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.56.55h5.02l-.2,1.32Z" />
                          <path d="M230.08,60.12c-1.16,0-2.27-.26-3.16-.73l.54-1.33c.57.35,1.62.74,2.74.74,1.25,0,2.7-.54,2.7-1.92,0-1.2-1.05-1.76-2.06-2.18l-1.46-.62c-1.22-.52-2.31-1.35-2.31-2.87,0-2.08,2.04-3.31,4.13-3.31,1.12,0,2.05.26,2.89.69l-.63,1.4c-.52-.36-1.48-.78-2.46-.78-1.39,0-2.23.59-2.23,1.52s.8,1.39,1.89,1.87l1.59.69c1.2.52,2.4,1.53,2.4,3.05,0,2.37-2.2,3.77-4.56,3.77" />
                          <polygon points="242.12 49.52 242.12 59.87 240.28 59.87 240.28 49.52 235.88 49.52 235.88 48.19 246.5 48.19 246.5 49.52 242.12 49.52" />
                          <path d="M251.52,51.34c-.2-.5-.39-1.02-.43-1.49h-.07c-.05.47-.3,1.06-.5,1.52l-1.54,3.69h3.95l-1.41-3.72ZM254.9,59.96l-.14-.08-1.38-3.65h-4.85l-1.52,3.65-.14.08-1.41-.14,5.13-11.94h1.39l4.74,11.94-1.82.14Z" />
                          <polygon points="262.08 49.52 262.08 59.87 260.24 59.87 260.24 49.52 255.84 49.52 255.84 48.19 266.46 48.19 266.46 49.52 262.08 49.52" />
                          <path d="M275.74,59.87h-7.22v-11.69h7.01v1.32h-5.17v3.46h4.61v1.33h-4.61v3.71c0,.45.23.55.55.55h5.03l-.2,1.32Z" />
                          <path d="M163.2,59.87h-7.22v-11.69h1.84v9.82c0,.45.23.55.55.55h5.02l-.2,1.32Z" />
                        </g>
                        <path d="M22.02,40.23c5.73,0,10-1.57,13.33-1.42l3.14-9.07h-1.08c-3.14,5.78-7.6,9.16-13.57,9.16-9.16,0-15.83-7.84-15.83-17.98,0-11.17,5.49-18.38,14.65-18.38,6.03,0,10.78,3.09,13.82,9.46h1.08l-1.57-10.24h-.88c-.39.74-.93.98-1.71.98-1.42,0-4.51-1.52-10.93-1.52-12.25,0-21.46,8.09-21.46,19.99,0,10.68,9.75,19.01,21.02,19.01M41.08,39.35h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46v-11.22h20.63v11.22c0,3.58-.83,4.26-5.39,4.46v.98h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v10.73s-20.63,0-20.63,0v-10.73c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM86.5,39.35h17.15v-.98c-5.83-.19-6.37-.64-6.37-4.95v-10.14c1.86.74,4.36,1.18,6.66,1.23l2.55,3.38c6.42,8.63,10.53,11.96,16.27,11.96v-.93c-2.55-.59-4.02-3.14-10.05-11.17l-3.18-4.26c4.07-1.42,7.3-4.46,7.3-9.51,0-4.16-2.65-9.16-14.16-9.16-2.65,0-7.84.25-16.17.25v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM97.28,22.4V6.22c1.22-.15,2.4-.2,3.63-.2,8.38,0,10.29,4.26,10.29,8.04,0,4.9-3.18,8.67-10.34,8.67-1.32,0-2.55-.1-3.58-.34M124.86,39.35h16.17v-.98c-4.56-.2-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM144.95,30.73l1.47,8.97h.83c.49-.78,1.18-1.03,1.86-1.03,1.76,0,4.7,1.57,8.97,1.57,6.86,0,11.66-3.92,11.66-9.75,0-12.1-19.01-11.56-19.01-19.65,0-2.84,2.16-5.39,6.32-5.39s7.64,2.01,10.29,7.4h1.08l-1.27-8.18h-.83c-.29.64-.78.88-1.47.88-1.71,0-4.21-1.37-8.03-1.37-6.03,0-10.34,3.38-10.34,8.67,0,10.88,18.72,11.07,18.72,19.75,0,3.53-2.79,6.37-7.3,6.37-4.31,0-9.26-2.64-11.86-8.23h-1.08ZM173.18,13.82h1.08c2.4-5.64,4.85-7.06,12.69-7.06h1.18v27.15c0,3.58-.83,4.26-5.39,4.46v.98h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V6.76s.88,0,.88,0c8.09,0,10.58,1.42,12.99,7.06h1.08l-1.42-9.26h-.78c-.64.69-1.37.98-3.82.98h-23.22c-2.45,0-3.19-.29-3.82-.98h-.78l-1.42,9.26ZM210.32,39.35h16.17v-.98c-4.56-.19-5.39-.88-5.39-4.46V10.49c0-3.58.83-4.26,5.39-4.46v-.98h-16.17v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98ZM229.72,39.35h16.71c6.32,0,9.41.15,12.35.39l3.09-8.62h-1.08c-3.43,5.88-6.47,6.96-13.82,6.96h-1.08c-4.56,0-5.39-.88-5.39-4.46v-11.37s.68,0,.68,0c10.88,0,11.91.44,12.79,5.34h.98v-11.47h-.98c-.69,4.17-1.96,4.75-11.76,4.75h-1.71V6.37s4.8,0,4.8,0c7.05,0,9.7,1.13,12.1,6.32h1.08l-1.47-7.65h-27.29v.98c4.56.2,5.39.88,5.39,4.46v23.42c0,3.58-.83,4.26-5.39,4.46v.98Z" />
                      </g>
                    </svg>
                  </div>
                  <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-light text-[#1a1a1a] leading-[1.1] mb-6">
                    {slide.title}
                  </h1>
                  <p className="text-[#4a4a4a] font-sans text-sm sm:text-base max-w-lg mx-auto mb-8 leading-relaxed">
                    {slide.subtitle}
                  </p>
                  <div className="border-t border-[#7a1a1a]/20 pt-6 max-w-sm mx-auto">
                    <p className="text-[#7a1a1a] font-sans text-xs tracking-wider uppercase">
                      {slide.meta}
                    </p>
                  </div>
                </div>
              ) : (
                /* Content slides */
                <div className="max-w-2xl mx-auto">
                  {slide.label && (
                    <p className="text-[#7a1a1a] font-sans text-[10px] tracking-[0.25em] uppercase mb-4">
                      {slide.label}
                    </p>
                  )}
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-light text-[#1a1a1a] leading-[1.15] mb-5">
                    {slide.title}
                  </h2>
                  {slide.subtitle && (
                    <p className="text-[#4a4a4a] font-sans text-sm sm:text-base leading-relaxed mb-5 italic">
                      {slide.subtitle}
                    </p>
                  )}
                  {slide.body && (
                    <p className="text-[#4a4a4a] font-sans text-sm sm:text-base leading-relaxed mb-5">
                      {slide.body}
                    </p>
                  )}
                  {slide.bullets && slide.bullets.length > 0 && (
                    <ul className="flex flex-col gap-3">
                      {slide.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-3 text-[#4a4a4a] font-sans text-sm leading-relaxed">
                          <span className="text-[#7a1a1a] mt-1 shrink-0 text-lg leading-none">&bull;</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      <footer className="border-t border-[#7a1a1a]/10 px-6 sm:px-10 lg:px-16 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {!showThankYou ? (
              slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === current ? "dot-active scale-110" : "dot-inactive"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))
            ) : (
              <span className="text-[10px] font-sans text-[#7a1a1a] uppercase tracking-wider">Done</span>
            )}
          </div>

          {/* Counter */}
          <span className="text-[10px] font-sans text-[#4a4a4a] tracking-wider uppercase">
            {showThankYou ? "End" : `Slide ${current + 1} of ${slides.length}`}
          </span>

          {/* Prev / Next */}
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              disabled={current === 0 && !showThankYou}
              className={`text-[10px] font-sans uppercase tracking-widest px-4 py-1.5 transition-all duration-200 cursor-pointer ${
                current === 0 && !showThankYou
                  ? "text-[#4a4a4a]/20 cursor-not-allowed"
                  : "text-[#4a4a4a] hover:text-[#7a1a1a]"
              }`}
              aria-label="Previous slide"
            >
              Previous
            </button>
            {showThankYou ? (
              <a
                href="/"
                className="text-[10px] font-sans uppercase tracking-widest px-5 py-1.5 bg-[#7a1a1a] text-white hover:bg-[#5e1414] transition-colors no-underline"
              >
                Return
              </a>
            ) : (
              <button
                onClick={next}
                className="text-[10px] font-sans uppercase tracking-widest px-5 py-1.5 bg-[#7a1a1a] text-white hover:bg-[#5e1414] transition-colors cursor-pointer"
                aria-label={isLast ? "Finish presentation" : "Next slide"}
              >
                {isLast ? "Finish" : "Next"}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
