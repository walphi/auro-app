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
                <img
                  src="/images/christies-logo.png"
                  alt="Christie's International Real Estate"
                  className="h-7 sm:h-9 w-auto object-contain"
                />
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
                    <img
                      src="/images/christies-logo.png"
                      alt="Christie's International Real Estate"
                      className="h-9 sm:h-11 w-auto object-contain"
                    />
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
