/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AuroJukebox } from './AuroJukebox';

interface FloatingNavProps {
  isVisible: boolean;
  onNavClick: (stageIdx: number) => void;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
  onLoginClick?: () => void;
  onAudioData: (amplitude: number, active: boolean) => void;
  forcePause?: boolean;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  isVisible,
  onNavClick,
  onMenuToggle,
  isMenuOpen,
  onLoginClick,
  onAudioData,
  forcePause,
}) => {
  const agentCount = useMemo(() => Math.floor(Math.random() * 13) + 4, []);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const threshold = 50;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > threshold && currentScrollY > lastScrollYRef.current) {
        setNavHidden(true);
      } else {
        setNavHidden(false);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] h-14 flex items-center px-6 md:px-[40px] bg-[#0a0a0a]/60 backdrop-blur-xl border-b border-[#333]/20 transition-transform duration-300 ${
        navHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* Logo */}
      <div
        onClick={() => onNavClick(0)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="10"/>
          <path d="m14.31 8 5.74 9.94"/>
          <path d="M9.69 8h11.48"/>
          <path d="m7.38 12 5.74-9.94"/>
          <path d="M9.69 16 3.95 6.06"/>
          <path d="M14.31 16H2.83"/>
          <path d="m16.62 12-5.74 9.94"/>
        </svg>
        <span className="font-serif italic text-2xl tracking-tighter text-[#f1f1f1] select-none font-bold">
          AURO
        </span>
      </div>

      {/* Spacer pushes jukebox + burger to the right */}
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <AuroJukebox onAudioData={onAudioData} agentCount={agentCount} forcePause={forcePause} />

        {/* Hamburger Menu Icon (all screen sizes) */}
        <button
          onClick={onMenuToggle}
          aria-label="Toggle Navigation Menu"
          className="block w-9 h-9 relative cursor-pointer hover:bg-white/[0.06] transition-colors rounded flex items-center justify-center"
        >
          <div className="flex flex-col justify-between h-[12px] w-[18px]">
            <span
              className={`h-[1px] bg-[#f4f4f4] transition-transform duration-300 origin-center ${
                isMenuOpen ? 'rotate-45 translate-y-[5.5px]' : ''
              }`}
            />
            <span
              className={`h-[1px] bg-[#f4f4f4] transition-opacity duration-300 ${
                isMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`h-[1px] bg-[#f4f4f4] transition-transform duration-300 origin-center ${
                isMenuOpen ? '-rotate-45 -translate-y-[5.5px]' : ''
              }`}
            />
          </div>
        </button>
      </div>
    </nav>
  );
};
