/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { getCalApi } from "@calcom/embed-react";
import { 
  Settings, 
  Send, 
  Check, 
  Lock, 
  Mail, 
  ChevronRight, 
  Play, 
  X, 
} from 'lucide-react';
import { CameraKeyFrame, StageParams } from './types';
import { OasisCanvas } from './components/OasisCanvas';
import { SettingsPanel } from './components/SettingsPanel';
import { FloatingNav } from './components/FloatingNav';
import { MobileOverlay } from './components/MobileOverlay';
import InsightsMarquee from './components/InsightsMarquee';

const defaultSingleParams: StageParams = {
  fogStart: 6.5,
  fogEnd: 12.0,
  fogIntensity: 1.0,
  fogR: 0,
  fogG: 0,
  fogB: 0,
  grassDensity: 1.0,
  bladeWidth: 4.0,
  bladeTipWidth: 0.19,
  bladeHeight: 1.6,
  bladeHeightVar: 0.5,
  bladeLean: 1.1,
  windSpeed: 1.3,
  windAmplitude: 0.21,
  noiseAmp: 1.85,
  noiseFreq: 0.3,
  noise2Amp: 0.2,
  noise2Freq: 15.0,
  mouseRadius: 6.1,
  mouseStrength: 4.0,
  outerRadius: 9.4,
  outerStrength: 1.45,
  camSphereRadius: 15.0,
  camSphereStrength: 5.9,
  bladeBaseR: 0.055,
  bladeBaseG: 0.118,
  bladeBaseB: 0.016,
  bladeTipR: 0.784,
  bladeTipG: 0.722,
  bladeTipB: 0.251,
  goldenTipR: 0.831,
  goldenTipG: 0.722,
  goldenTipB: 0.22,
  greenTipR: 0.29,
  greenTipG: 0.478,
  greenTipB: 0.078,
  midR: 0.176,
  midG: 0.306,
  midB: 0.055,
  colorVar: 0.93,
};

const initialStageParams: StageParams[] = [
  // Hero (0)
  {
    ...defaultSingleParams,
    bladeBaseR: 0.00439,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.57758,
    bladeTipG: 0.47932,
    bladeTipB: 0.05126,
    goldenTipR: 0.65837,
    goldenTipG: 0.47932,
    goldenTipB: 0.03954,
    greenTipR: 0.06847,
    greenTipG: 0.19461,
    greenTipB: 0.00699,
    midR: 0.02624,
    midG: 0.07618,
    midB: 0.00439,
  },
  // Manifesto (1)
  {
    ...defaultSingleParams,
    bladeBaseR: 0.00439,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.57758,
    bladeTipG: 0.47932,
    bladeTipB: 0.05126,
    goldenTipR: 0.65837,
    goldenTipG: 0.47932,
    goldenTipB: 0.03954,
    greenTipR: 0.06847,
    greenTipG: 0.19461,
    greenTipB: 0.00699,
    midR: 0.02624,
    midG: 0.07618,
    midB: 0.00439,
  },
  // Pillars (2)
  {
    ...defaultSingleParams,
    bladeBaseR: 0,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.89803,
    bladeTipG: 0.80392,
    bladeTipB: 0.80392,
    goldenTipR: 0.66274,
    goldenTipG: 0.28627,
    goldenTipB: 0.03921,
    greenTipR: 0.19215,
    greenTipG: 0.15294,
    greenTipB: 0.00784,
    midR: 0.0745,
    midG: 0.00784,
    midB: 0.00392,
    colorVar: 1,
  },
  // Stats (3)
  {
    ...defaultSingleParams,
    fogStart: 0,
    fogEnd: 12.5,
    bladeHeight: 2,
    bladeHeightVar: 1,
    bladeLean: 0,
    windSpeed: 1.3,
    windAmplitude: 0.21,
    bladeBaseR: 0.00439,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.57758,
    bladeTipG: 0.47932,
    bladeTipB: 0.05126,
    goldenTipR: 0.65837,
    goldenTipG: 0.47932,
    goldenTipB: 0.03954,
    greenTipR: 0.06847,
    greenTipG: 0.19461,
    greenTipB: 0.00699,
    midR: 0.02624,
    midG: 0.07618,
    midB: 0.00439,
  },
  // Quote (4)
  {
    ...defaultSingleParams,
    bladeBaseR: 0.00439,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.57758,
    bladeTipG: 0.47932,
    bladeTipB: 0.05126,
    goldenTipR: 0.65837,
    goldenTipG: 0.47932,
    goldenTipB: 0.03954,
    greenTipR: 0.06847,
    greenTipG: 0.19461,
    greenTipB: 0.00699,
    midR: 0.02624,
    midG: 0.07618,
    midB: 0.00439,
  },
  // CTA (5)
  {
    ...defaultSingleParams,
    fogStart: 7,
    bladeTipWidth: 0.27,
    bladeHeight: 0.9,
    bladeHeightVar: 0,
    bladeLean: 0,
    bladeBaseR: 0.00439,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.57758,
    bladeTipG: 0.47932,
    bladeTipB: 0.05126,
    goldenTipR: 0.65837,
    goldenTipG: 0.47932,
    goldenTipB: 0.03954,
    greenTipR: 0.06847,
    greenTipG: 0.19461,
    greenTipB: 0.00699,
    midR: 0.02624,
    midG: 0.07618,
    midB: 0.00439,
  },
  // Footer (6)
  {
    ...defaultSingleParams,
    fogStart: 2,
    fogEnd: 10,
    bladeHeight: 2,
    bladeHeightVar: 0,
    bladeLean: 0,
    windSpeed: 1.3,
    windAmplitude: 0.21,
    bladeBaseR: 0,
    bladeBaseG: 0.01298,
    bladeBaseB: 0.00121,
    bladeTipR: 0.32941,
    bladeTipG: 0.30588,
    bladeTipB: 0.05098,
    goldenTipR: 0.65882,
    goldenTipG: 0.47843,
    goldenTipB: 0.03921,
    greenTipR: 0.06666,
    greenTipG: 0.19607,
    greenTipB: 0.00784,
    midR: 0,
    midG: 0,
    midB: 0,
  },
];

const faqData = [
  {
    q: "What exactly is AURO?",
    a: "AURO is an AI-first lead nurturing and qualification agent for real estate teams. It engages every inquiry, follows up intelligently, qualifies intent, and helps convert conversations into booked meetings."
  },
  {
    q: "How does AURO improve lead quality?",
    a: "AURO asks structured questions around budget, timing, and interest, then nurtures each lead until the sales team only receives prospects who are genuinely worth their time."
  },
  {
    q: "How is AURO different from a standard chatbot?",
    a: "A chatbot responds. AURO nurtures. It remembers context, follows up over time, and guides each lead through a real sales journey instead of just answering questions."
  },
  {
    q: "Which channels does AURO integrate with?",
    a: "AURO can work across WhatsApp, websites, landing pages, and other inbound lead sources, keeping the nurturing journey connected."
  },
  {
    q: "How secure is our lead data?",
    a: "AURO is built with enterprise-grade security and designed to protect confidential lead and project data throughout the engagement process."
  },
  {
    q: "How long does it take to implement AURO?",
    a: "Implementation is designed to be fast and structured, with setup, training, and integration handled as a guided onboarding process."
  },
  {
    q: "Does AURO replace our existing CRM?",
    a: "No. AURO enhances your existing stack by qualifying and nurturing leads before handing them into your CRM with full context."
  },
  {
    q: "How often is the AI updated and maintained?",
    a: "AURO is continuously maintained and improved so the nurturing flows, qualification logic, and performance stay aligned with business needs."
  },
  {
    q: "What is the investment required to get started?",
    a: "AURO begins with a one-time setup fee, followed by an ongoing service model for continued support, updates, and optimization."
  },
  {
    q: "How quickly will we see ROI?",
    a: "Because AURO improves speed-to-lead, nurturing consistency, and meeting conversion, teams typically see value through better efficiency and more qualified opportunities entering the pipeline."
  }
];

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
  isForm?: boolean;
}

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0);

  // Playground Options
  const [skyColors, setSkyColors] = useState({
    top: '#000000',
    midHigh: '#000000',
    midLow: '#000000',
    horizon: '#000000',
  });
  const [groundColor, setGroundColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [globalDofEnabled, setGlobalDofEnabled] = useState(true);
  const [fpsOverlayVisible, setFpsOverlayVisible] = useState(false);
  const [fps, setFps] = useState(0);

  // Editor states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<'scroll' | 'edit'>('scroll');
  const [activeStage, setActiveStage] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [windBurstTrigger, setWindBurstTrigger] = useState(0);

  // Audio Jukebox state
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [audioActive, setAudioActive] = useState(false);

  const handleAudioData = useCallback((amp: number, active: boolean) => {
    setAudioAmplitude(amp);
    setAudioActive(active);
  }, []);

  // Modal / Interaction States
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Login variables
  const [workEmail, setWorkEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginStep, setLoginStep] = useState<'idle' | 'auth' | 'success'>('idle');

  // Interactive WhatsApp Chat simulation state
  const [conversations, setConversations] = useState<ChatMessage[]>([
    { sender: 'ai', text: "Hello! I noticed you're interested in the Palm Jumeirah Villa. Are you looking for investment or personal use?" }
  ]);
  const [chatOptions, setChatOptions] = useState<string[]>([
    "Investment. What's the expected ROI?",
    "Personal use. Is there a private beach?"
  ]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement>(null);
  const [activeChats] = useState(() => Math.floor(Math.random() * 2000) + 500);

  // Scroll camera keyframes
  const [cameraPath, setCameraPath] = useState<CameraKeyFrame[]>([
    { stage: 'Hero', scroll: 0.0, posX: -2.8, posY: 7.2, posZ: 19.6, lookX: 0.5, lookY: 1.5, lookZ: 0.4, focusDist: 22.0, autoFocus: true, dofEnabled: true, focalLength: 10.0, bokehScale: 12.5, afSpeed: 5.0, afMin: 1.0, afMax: 40.0 },
    { stage: 'Manifesto', scroll: 0.14, posX: 0, posY: 2.2, posZ: 14.0, lookX: 0, lookY: -2.0, lookZ: 0, focusDist: 15.0, autoFocus: true, dofEnabled: true, focalLength: 8.0, bokehScale: 10.0, afSpeed: 5.0, afMin: 1.0, afMax: 30.0 },
    { stage: 'Pillars', scroll: 0.28, posX: 7.5, posY: 10.9, posZ: 15.8, lookX: 0, lookY: 0.0, lookZ: 0.7, focusDist: 10.0, autoFocus: true, dofEnabled: true, focalLength: 6.0, bokehScale: 8.0, afSpeed: 5.0, afMin: 0.5, afMax: 20.0 },
    { stage: 'Stats', scroll: 0.43, posX: -8.0, posY: 6.8, posZ: 21.6, lookX: 0, lookY: 0.2, lookZ: 0, focusDist: 7.0, autoFocus: true, dofEnabled: true, focalLength: 5.0, bokehScale: 10.0, afSpeed: 5.0, afMin: 0.5, afMax: 15.0 },
    { stage: 'Quote', scroll: 0.57, posX: -1.0, posY: 5.3, posZ: 25.0, lookX: -1.2, lookY: 3.0, lookZ: 0, focusDist: 5.0, autoFocus: true, dofEnabled: true, focalLength: 4.0, bokehScale: 14.0, afSpeed: 6.0, afMin: 1.1, afMax: 21.5 },
    { stage: 'CTA', scroll: 0.78, posX: -1.6, posY: 2.4, posZ: 0.0, lookX: -1.2, lookY: -2.0, lookZ: 0.0, focusDist: 16.4, autoFocus: true, dofEnabled: false, focalLength: 20.0, bokehScale: 18.0, afSpeed: 19.0, afMin: 2.8, afMax: 12.5 },
    { stage: 'Footer', scroll: 1.0, posX: 0, posY: 15.0, posZ: 0.0, lookX: -5, lookY: 3.0, lookZ: -5, focusDist: 9.8, autoFocus: true, dofEnabled: true, focalLength: 13.8, bokehScale: 0.0, afSpeed: 17.5, afMin: 1.2, afMax: 9.0 },
  ]);

  const [stageParams, setStageParams] = useState<StageParams[]>(initialStageParams);

  // Core Scroll Tracker
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollable = docHeight - winHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Cal.com booking configuration
  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", {
        cssVarsPerTheme: {
          light: { "cal-brand": "#0a0a0a" },
          dark: { "cal-brand": "#D4FF00" },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  // Scroll to top on fresh load
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    const html = document.documentElement;
    const body = document.body;
    const origScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    const forceScrollToTop = () => {
      window.scrollTo(0, 0);
      html.scrollTop = 0;
      body.scrollTop = 0;
    };
    forceScrollToTop();
    requestAnimationFrame(forceScrollToTop);
    setTimeout(() => {
      forceScrollToTop();
      html.style.scrollBehavior = origScrollBehavior;
    }, 60);
  }, []);

  // IntersectionObserver for Staggered Element Fade-Ins
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.getAttribute('data-delay') || '0';
            el.classList.add('revealed');
            // Explicit CSS transition delays
            if (delay === '1') el.style.transitionDelay = '0.08s';
            else if (delay === '2') el.style.transitionDelay = '0.18s';
            else if (delay === '3') el.style.transitionDelay = '0.3s';
            else if (delay === '4') el.style.transitionDelay = '0.45s';
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -10% 0px' }
    );

    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle hash-based navigation on mount (e.g. /#cta from sub-pages)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#")) {
      const el = document.querySelector(hash) as HTMLElement;
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      }
    }
  }, []);

  // Sync scroll positions with canvas stages
  useEffect(() => {
    const calculatedStage = Math.min(6, Math.floor(scrollProgress * 7));
    setActiveStage(calculatedStage);
  }, [scrollProgress]);

  // Keyboard shortcut for settings playground
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
    }
  }, [conversations, isChatTyping]);

  // Sync scroll values with actual DOM sections positions
  const syncCameraPathToDOM = () => {
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollable = docHeight - winHeight;
    if (scrollable <= 0) return;

    setCameraPath((prevPath) => {
      return prevPath.map((kf, i) => {
        const section = document.querySelector(`.section[data-stage="${i}"]`) as HTMLElement;
        if (section) {
          const sectionTop = section.offsetTop;
          const relativeScroll = Math.min(1.0, Math.max(0.0, sectionTop / scrollable));
          return { ...kf, scroll: i === prevPath.length - 1 ? 1.0 : relativeScroll };
        }
        return kf;
      });
    });
  };

  useEffect(() => {
    setTimeout(syncCameraPathToDOM, 500);
    window.addEventListener('resize', syncCameraPathToDOM);
    return () => window.removeEventListener('resize', syncCameraPathToDOM);
  }, []);

  const handleNavClick = (stageIdx: number) => {
    const targetSection = document.querySelector(`.section[data-stage="${stageIdx}"]`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleWindBurst = () => {
    setWindBurstTrigger((prev) => prev + 1);
  };

  // WhatsApp Simulator Interaction Handler
  const handleChatOptionClick = (option: string) => {
    // 1. Add user message
    setConversations(prev => [...prev, { sender: 'user', text: option }]);
    setChatOptions([]);
    setIsChatTyping(true);

    // 2. Trigger AI response with delay simulating real human-agent thinking behavior
    setTimeout(() => {
      setIsChatTyping(false);
      if (option.includes("ROI")) {
        setConversations(prev => [...prev, {
          sender: 'ai',
          text: "Based on current market trends on the Palm Jumeirah, we're projecting 8-10% net ROI. Would you like to see the complete financial brochure and payment breakdown?"
        }]);
        setChatOptions([
          "Yes, send me the financial breakdown.",
          "I have a specific budget. Can we filter?"
        ]);
      } else if (option.includes("private beach")) {
        setConversations(prev => [...prev, {
          sender: 'ai',
          text: "Absolutely! The villa portfolio features 150m of uninterrupted private sand shoreline, dual infinity pools, and Burj Al Arab views. Which layout suits you better: 4-Bedroom Villa or 6-Bedroom Mansion?"
        }]);
        setChatOptions([
          "4-Bedroom Villa suite layout",
          "6-Bedroom Mansion luxury layout"
        ]);
      } else if (option.includes("financial breakdown") || option.includes("filter") || option.includes("Villa") || option.includes("Mansion")) {
        setConversations(prev => [...prev, {
          sender: 'ai',
          text: "Excellent. I will compile our digital brief, 5-year ROI forecasts, and exclusive payment schedules for you. Please enter your email or WhatsApp number so I can sync your secure folder:"
        }]);
        // Render a input field straight inside the thread!
        setConversations(prev => [...prev, {
          sender: 'ai',
          text: "",
          isForm: true
        }]);
        setChatFinished(true);
      }
    }, 1200);
  };

  const handleInlineChatSubmit = (value: string) => {
    if (!value) return;
    // Replace the form placeholder with actual response
    setConversations(prev => {
      const filtered = prev.filter(m => !m.isForm);
      return [
        ...filtered,
        { sender: 'user', text: `Sync ID: ${value}` },
        { sender: 'ai', text: `Verification Authorized. early-access slot for Dubai Real Estate has been locked and synced to CRM. Thank you, ${value}! An AURO strategist will reach out on WhatsApp in 2 minutes. 🌴` }
      ];
    });
  };

  // Client Login simulated flow
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workEmail) return;
    setLoginStep('auth');
    setTimeout(() => {
      setLoginStep('success');
    }, 1500);
  };

  return (
    <div className="relative w-full min-h-screen text-[#e8ece4] bg-black selection:bg-[#D4FF00]/30 selection:text-white">
      {/* Scroll Progress Bar indicator */}
      <div
        id="progressBar"
        className="fixed top-0 left-0 h-[2px] bg-[#D4FF00] z-[200] transition-[width] duration-75"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      {/* Floating Header Nav */}
      <FloatingNav
        isVisible={scrollProgress > 0.05}
        onNavClick={handleNavClick}
        isMenuOpen={isMenuOpen}
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
        onLoginClick={() => setIsLoginOpen(true)}
        onAudioData={handleAudioData}
        forcePause={isVideoOpen}
      />

      {/* Mobile Navigation Drawer Overlay */}
      <MobileOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        items={[
          { label: "00 // HOME", onClick: () => handleNavClick(0) },
          { label: "01 // HOW IT WORKS", onClick: () => handleNavClick(2) },
          { label: "02 // REVENUE", onClick: () => handleNavClick(3) },
          { label: "03 // ABOUT", onClick: () => { window.location.href = "/about"; } },
          { label: "04 // INSIGHTS", onClick: () => { window.location.href = "/insights"; } },
          { label: "05 // FAQ", onClick: () => { window.location.href = "/faq"; } },
          { label: "06 // SOLUTIONS", onClick: () => { window.location.href = "/solutions"; } },
          { label: "07 // CLIENT LOGIN", onClick: () => setIsLoginOpen(true) },
          { label: "REQUEST EARLY ACCESS", onClick: () => handleNavClick(5), isCta: true },
        ]}
      />

      {/* Settings Playground Toggle Button */}
      <button
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        aria-label="Toggle Designer Playground"
        className={`hidden fixed bottom-5 right-5 z-[200] w-9 h-9 rounded-full bg-black/80 backdrop-blur-md border flex items-center justify-center pointer-events-auto transition-all duration-300 hover:scale-105 cursor-pointer ${
          isSettingsOpen
            ? 'border-[#D4FF00]/60 text-[#D4FF00] rotate-45'
            : 'border-[#333] text-neutral-500 hover:text-[#D4FF00]'
        }`}
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Translucent Settings Playground Dashboard Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        groundColor={groundColor}
        setGroundColor={setGroundColor}
        skyColors={skyColors}
        setSkyColors={setSkyColors}
        globalDofEnabled={globalDofEnabled}
        setGlobalDofEnabled={setGlobalDofEnabled}
        fpsOverlayVisible={fpsOverlayVisible}
        setFpsOverlayVisible={setFpsOverlayVisible}
        fps={fps}
        cameraPath={cameraPath}
        setCameraPath={setCameraPath}
        stageParams={stageParams}
        setStageParams={setStageParams}
        editingMode={editingMode}
        setEditingMode={setEditingMode}
        activeStage={activeStage}
        setActiveStage={setActiveStage}
      />

      {/* 3D WebGL / WebGPU Canvas */}
      <OasisCanvas
        scrollProgress={scrollProgress}
        cameraPath={cameraPath}
        stageParams={stageParams}
        activeStage={activeStage}
        editingMode={editingMode}
        skyColors={skyColors}
        groundColor={groundColor}
        backgroundColor={backgroundColor}
        globalDofEnabled={globalDofEnabled}
        onFpsUpdate={setFps}
        windBurstTrigger={windBurstTrigger}
        audioAmplitude={audioAmplitude}
        audioActive={audioActive}
      />

      {/* Scrollable Editorial Content */}
      <div id="scroll-container" className="relative z-10 pointer-events-none transition-transform duration-500 will-change-transform">
        
        {/* Section 0: HERO (Split Layout with App Copy and Live WhatsApp Agent Simulator) */}
        <section className="section hero min-h-screen flex flex-col justify-center pt-[6vh] pb-[4vh] px-4 md:px-10 lg:px-16" data-stage="0">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center w-full">
            
            {/* Left Side: Pitch and Copy */}
            <div className="lg:col-span-7 flex flex-col gap-4 text-left items-start">
              
              {/* Soft Tag */}
              <div 
                className="opacity-0 translate-y-7 inline-flex items-center gap-2 px-3 py-1 bg-[#D4FF00]/10 border border-[#D4FF00]/30 text-[#D4FF00] font-mono text-[10px] tracking-[0.2em] uppercase select-none rounded-none"
                data-reveal
                data-delay="1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] animate-ping" />
                AURO 2.0 is Live
              </div>

              {/* Title Headings */}
              <div className="opacity-0 translate-y-10 flex flex-col select-none" data-reveal data-delay="2">
                <h1 className="text-[3rem] sm:text-[4.25rem] md:text-[5rem] leading-[0.85] font-black uppercase tracking-[-0.03em] text-[#f4f4f4]">
                  Nurture Every Lead Into A <br />
                  <span className="font-serif italic text-[#D4FF00] font-light normal-case tracking-normal">Booked Meeting</span>
                </h1>
              </div>

              {/* Core Pitch Paragraph */}
              <p 
                className="opacity-0 translate-y-7 max-w-[560px] text-xs sm:text-sm leading-relaxed text-neutral-300 font-light"
                data-reveal
                data-delay="3"
              >
                The AI-first lead nurturing and qualification multi-agent system for Dubai's leading real estate agencies and developers. AURO engages every inquiry instantly, keeps the conversation alive across WhatsApp and other channels, and guides serious buyers toward qualified meetings and sales.
              </p>

              {/* Action Buttons */}
              <div 
                className="opacity-0 translate-y-5 flex flex-wrap gap-4 items-center mt-3 pointer-events-auto w-full"
                data-reveal
                data-delay="3"
              >
                <button
                  onClick={async () => {
                    const cal = await getCalApi({ namespace: "30min" });
                    cal("modal", { calLink: "auro-app/30min" });
                  }}
                  className="px-6 py-2.5 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-[10px] sm:text-xs font-mono uppercase tracking-widest cursor-pointer transition-all duration-300 font-bold"
                >
                  Request Demo
                </button>
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="px-5 py-2.5 border border-[#333] bg-[#0a0a0a]/80 text-[#D4FF00] hover:border-[#D4FF00] hover:text-white text-[10px] sm:text-xs font-mono uppercase tracking-widest cursor-pointer transition-all duration-300 flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Watch Video
                </button>
              </div>

              {/* Setup Highlights List */}
              <div 
                className="opacity-0 translate-y-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#222] pt-6 mt-4 w-full max-w-[560px]"
                data-reveal
                data-delay="4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/40 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#D4FF00]" />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 tracking-wider">White-Glove Setup & Integration</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/40 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#D4FF00]" />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 tracking-wider">Expert Qualification Session</span>
                </div>
              </div>
            </div>

            {/* Right Side: Interactive Real Estate AI WhatsApp Assistant Simulator */}
            <div 
              className="lg:col-span-5 w-full flex flex-col gap-4 pointer-events-auto opacity-0 translate-y-10"
              data-reveal
              data-delay="3"
            >
              {/* WhatsApp Mock Frame */}
              <div className="border border-[#333] bg-[#0c0c0ced]/95 backdrop-blur-xl shadow-2xl p-4 flex flex-col h-[460px] max-h-[55vh] relative">

                {/* Device Title Bar */}
                <div className="flex justify-between items-center border-b border-[#222] pb-3 mb-3 select-none">
                  <div className="flex gap-2.5 items-center">
                    <div className="w-7 h-7 bg-[#222] rounded-full border border-[#D4FF00]/40 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4FF00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m14.31 8 5.74 9.94"/>
                        <path d="M9.69 8h11.48"/>
                        <path d="m7.38 12 5.74-9.94"/>
                        <path d="M9.69 16 3.95 6.06"/>
                        <path d="M14.31 16H2.83"/>
                        <path d="m16.62 12-5.74 9.94"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-mono font-bold tracking-wider text-neutral-200">AURO QUALIFIER</h4>
                      <p className="text-[8px] text-[#D4FF00] font-mono">ONLINE // POOL 1</p>
                    </div>
                  </div>
                  
                  {/* Stats Overlay widget inside frame */}
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-[7px] text-neutral-500 font-mono">CONVERSION</p>
                      <p className="text-xs text-[#D4FF00] font-mono font-bold leading-none">+12.5%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] text-neutral-500 font-mono">ACTIVE CHATS</p>
                      <p className="text-xs text-[#fff] font-mono font-bold leading-none">{activeChats.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Thread Stream */}
                <div ref={chatThreadRef} className="flex-1 overflow-y-auto px-1 pr-2 flex flex-col gap-3 font-mono text-[10px] leading-relaxed custom-scrollbar">
                  {conversations.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="text-[7px] text-neutral-600 mb-0.5 select-none uppercase tracking-wide">
                        {msg.sender === 'user' ? 'INVESTOR' : 'AURO_AGENT'}
                      </div>
                      
                      {msg.isForm ? (
                        <div className="bg-[#111] p-3 border border-[#333] w-full max-w-[210px] flex flex-col gap-2">
                          <p className="text-[9px] text-[#D4FF00] uppercase mb-1">Enter Contact Information</p>
                          <input 
                            type="text" 
                            placeholder="Email or WhatsApp" 
                            className="bg-black border border-[#222] px-2 py-1 text-[10px] font-mono text-white outline-none focus:border-[#D4FF00]" 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleInlineChatSubmit((e.target as HTMLInputElement).value);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const inputNode = e.currentTarget.previousElementSibling as HTMLInputElement;
                              handleInlineChatSubmit(inputNode.value);
                            }}
                            className="px-2 py-1 bg-[#D4FF00] text-black text-[9px] font-bold uppercase transition-colors"
                          >
                            QUALIFY & SYNC
                          </button>
                        </div>
                      ) : (
                        <div 
                          className={`px-3 py-2 text-left max-w-[85%] ${
                            msg.sender === 'user' 
                              ? 'bg-[#1c2e10]/80 text-[#D4FF00] border border-[#234412]' 
                              : 'bg-[#111] text-neutral-200 border border-[#222]'
                          }`}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isChatTyping && (
                    <div className="flex flex-col items-start">
                      <span className="text-[7px] text-neutral-600 mb-0.5">AURO_AGENT</span>
                      <div className="bg-[#111] px-3 py-1.5 text-neutral-500 italic animate-pulse">
                        Thinking...
                      </div>
                    </div>
                  )}

                  <div />
                </div>

                {/* Simulated Controls / Actions */}
                <div className="mt-4 pt-3 border-t border-[#222]">
                  {chatOptions.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[8px] font-mono text-neutral-500 uppercase select-none mb-1">// Tap response options below to simulation chat:</p>
                      <div className="flex gap-2 flex-wrap">
                        {chatOptions.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleChatOptionClick(opt)}
                            className="px-3 py-1.5 bg-neutral-900 border border-[#333] hover:border-[#D4FF00] hover:text-[#D4FF00] text-[#aaa] font-mono text-[9px] text-left transition-colors cursor-pointer"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {chatFinished ? (
                        <button 
                          onClick={() => {
                            setConversations([{ sender: 'ai', text: "Hello! I noticed you're interested in the Palm Jumeirah Villa. Are you looking for investment or personal use?" }]);
                            setChatOptions(["Investment. What's the expected ROI?", "Personal use. Is there a private beach?"]);
                            setChatFinished(false);
                          }}
                          className="w-full text-center py-2 border border-dashed border-[#333] text-neutral-500 hover:text-[#D4FF00] hover:border-[#D4FF00] text-[9px] uppercase cursor-pointer"
                        >
                          // Restart Vetting Flow Simulation
                        </button>
                      ) : (
                        <p className="text-[8px] text-[#D4FF00]/60 italic font-mono animate-pulse uppercase">// Qualifying dialogue routing active...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Section 1: ABOUT / MANIFESTO - Built For Revenue */}
        <section className="section manifesto min-h-screen flex flex-col justify-center items-center gap-10 text-center px-6 max-w-4xl mx-auto" data-stage="1">
          <span
            className="manifesto-label opacity-0 translate-y-5 text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase"
            data-reveal
          >
            01 // BUILT FOR REVENUE, NOT JUST RESPONSES
          </span>
          <div className="opacity-0 translate-y-10 max-w-3xl" data-reveal data-delay="1">
            <h2 className="opacity-0 translate-y-10 font-serif text-3xl sm:text-4xl md:text-5xl font-light leading-[1.3] text-[#f4f4f4] mb-14 revealed" data-reveal="true" data-delay="1" style={{ transitionDelay: "0.08s" }}>
              Replace your static workflows with <em className="italic text-[#D4FF00] font-normal">dynamic, intelligent conversations</em> that convert into booked meetings.
            </h2>
            <p className="text-[12px] leading-relaxed text-neutral-300 font-light mt-6">
              AURO follows up consistently, answers objections, re-engages prospects at the right moment, and moves every conversation closer to a booked meeting.
            </p>
            <p className="text-[12px] leading-relaxed text-neutral-300 font-light mt-4">
              Instead of letting warm leads go cold, AURO turns lead handling into a continuous nurturing system that protects intent, improves conversion, and increases revenue from the same marketing spend.
            </p>
            <p className="text-[12px] leading-relaxed text-neutral-300 font-light mt-4">
              Pre-qualifying, nurturing, and vetting off-plan and ready property inquiries 24/7 on autopilot.
            </p>
          </div>
        </section>

        {/* Section 2: HOW AURO WORKS */}
        <section className="section pillars min-h-screen flex flex-col justify-center items-center gap-16 px-6 max-w-6xl mx-auto" data-stage="2">
          
          {/* Header tag */}
          <div className="text-center opacity-0 translate-y-5" data-reveal>
            <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">
              02 // HOW AURO WORKS
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            
            {/* Pillar 01: Instant Response */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="1"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.01
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 01 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Instant Response
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                Engage every inquiry within 2 seconds, 24/7. AURO makes sure no lead waits around, because speed-to-lead is where conversion starts.
              </p>
            </div>

            {/* Pillar 02: Lead Nurturing */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="2"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.02
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 02 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Lead Nurturing
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                AURO keeps the conversation going with intelligent follow-up, timely reminders, and contextual re-engagement until the prospect is ready to book.
              </p>
            </div>

            {/* Pillar 03: Intelligent Qualification */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="3"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.03
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 03 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Intelligent Qualification
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                The AI naturally asks budget, timeline, and intent questions, filtering out casual browsers and surfacing only serious buyers.
              </p>
            </div>

            {/* Pillar 04: Meeting Booking */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="4"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.04
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 04 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Meeting Booking
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                Once a lead is ready, AURO drives the handoff into a booked call, viewing, or sales meeting with full context preserved.
              </p>
            </div>

            {/* Pillar 05: Context Aware */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="5"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.05
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 05 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Context Aware
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                AURO remembers past conversations, preferences, and objections, so every interaction feels personal and progressive, not repetitive.
              </p>
            </div>

            {/* Pillar 06: Remarketing */}
            <div
              className="pillar-card opacity-0 translate-y-10 group flex flex-col border border-[#333] p-[3px_3px_28px_28px] bg-[#0a0a0add]/90 backdrop-blur-md hover:border-[#D4FF00] transition-all duration-300 relative rounded-none cursor-default pointer-events-auto"
              data-reveal
              data-delay="6"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 font-mono text-[9px] text-neutral-400">
                AURO_CORE.06
              </div>
              <div className="text-[9px] font-mono text-[#D4FF00] mb-4 mt-6 uppercase tracking-widest">
                [ Pillar 06 ]
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-light italic mb-3 text-white">
                Remarketing
              </h3>
              <p className="text-xs leading-relaxed text-neutral-300 font-light pr-4">
                AURO re-engages cold and dormant leads with personalized outreach, reviving interest and bringing older prospects back into your funnel without manual effort.
              </p>
            </div>

          </div>
        </section>

        {/* Section 3: REVENUE FROM EVERY CONVERSATION */}
        <section className="section stats-section min-h-screen flex flex-col justify-center items-center gap-10 px-6 max-w-6xl mx-auto" data-stage="3">
          
          <span
            className="stats-label opacity-0 translate-y-5 text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase text-center"
            data-reveal
          >
            03 // REVENUE FROM EVERY CONVERSATION
          </span>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
            
            {/* Left Panel: Revenue + Why Nurturing Matters */}
            <div 
              className="lg:col-span-6 border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between opacity-0 translate-y-7 pointer-events-auto"
              data-reveal
              data-delay="1"
            >
              <div>
                <p className="text-[8px] font-mono uppercase tracking-widest text-[#D4FF00] border-b border-[#222] pb-3 mb-6 select-none">
                  // LEAD NURTURING ENGINE
                </p>
                <h3 className="font-serif italic text-2xl text-white mb-4">Revenue From Every Conversation</h3>
                <p className="text-xs leading-relaxed text-neutral-300 font-light mb-6">
                  AURO is built to turn messaging into a commercial engine. In the UAE, rich messaging has become a primary channel for sales, customer engagement, and conversion, and leading organizations are using it across the full customer journey. AURO helps real estate teams capitalize on that shift by making messaging the place where leads are nurtured, qualified, and converted.
                </p>
                <p className="text-xs leading-relaxed text-neutral-300 font-light mb-6">
                  When nurturing happens continuously inside the conversation, your team gets more qualified appointments, better lead quality, and less wasted time on unresponsive prospects.
                </p>
                
                {/* Why Lead Nurturing Matters */}
                <div className="border-t border-[#222] pt-5 mt-2">
                  <h4 className="text-[10px] font-mono text-[#D4FF00] uppercase tracking-widest mb-3">Why Lead Nurturing Matters</h4>
                  <p className="text-xs text-neutral-300 font-light mb-4">
                    Lead capture is only the beginning. The real value comes from what happens after the first inquiry. AURO is designed to:
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {[
                      "Keep leads warm until they are ready to meet.",
                      "Re-engage prospects who stop replying.",
                      "Answer objections without losing momentum.",
                      "Move every lead through a structured follow-up journey.",
                      "Free sales teams to focus on closing, not chasing.",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 font-mono">
                        <span className="text-[#D4FF00] mt-0.5 shrink-0">▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-neutral-300 font-light italic mt-4 border-l-2 border-[#D4FF00] pl-3">
                    This is what turns ad spend into meetings, and meetings into revenue.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Panel: Intelligence At Scale */}
            <div 
              className="lg:col-span-6 border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between opacity-0 translate-y-7 font-mono pointer-events-auto"
              data-reveal
              data-delay="2"
            >
              <div>
                <p className="text-[8px] font-mono uppercase tracking-widest text-[#D4FF00] border-b border-[#222] pb-3 mb-6 flex justify-between select-none">
                  <span>INTELLIGENCE_AT_SCALE</span>
                  <span>v2.10-BETA</span>
                </p>
                
                <div className="flex flex-col gap-5">
                  <div className="border-b border-dashed border-neutral-800 pb-3">
                    <h4 className="text-sm text-white font-bold mb-1">Financial Filtering</h4>
                    <p className="text-[10px] text-neutral-300 leading-relaxed font-sans font-light">
                      AURO asks the right questions early, so your sales team only spends time on prospects who can actually buy.
                    </p>
                  </div>
                  <div className="border-b border-dashed border-neutral-800 pb-3">
                    <h4 className="text-sm text-white font-bold mb-1">Persistent Follow-Up</h4>
                    <p className="text-[10px] text-neutral-300 leading-relaxed font-sans font-light">
                      The agent nurtures leads over time with intelligent reminders and contextual prompts, so opportunities do not disappear after the first reply.
                    </p>
                  </div>
                  <div className="border-b border-dashed border-neutral-800 pb-3">
                    <h4 className="text-sm text-white font-bold mb-1">Human-Like Conversations</h4>
                    <p className="text-[10px] text-neutral-300 leading-relaxed font-sans font-light">
                      AURO keeps the tone natural, relevant, and responsive, so prospects feel engaged rather than pushed through a script.
                    </p>
                  </div>
                  <div className="border-b border-dashed border-neutral-800 pb-3">
                    <h4 className="text-sm text-white font-bold mb-1">CRM Handover</h4>
                    <p className="text-[10px] text-neutral-300 leading-relaxed font-sans font-light">
                      All lead data, transcripts, and qualification details sync into your CRM, giving your team full context before they take over.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Built For Dubai Real Estate */}
          <div 
            className="w-full border border-[#333] bg-[#0b0b0bed]/90 backdrop-blur-md p-6 sm:p-8 opacity-0 translate-y-7 pointer-events-auto"
            data-reveal
            data-delay="3"
          >
            <div className="max-w-4xl mx-auto">
              <p className="text-[8px] font-mono uppercase tracking-widest text-[#D4FF00] border-b border-[#222] pb-3 mb-5 select-none">
                // BUILT FOR DUBAI REAL ESTATE
              </p>
              <p className="text-xs text-neutral-300 font-light leading-relaxed mb-5">
                AURO is designed specifically for the pace and complexity of Dubai's property market. Whether the lead comes from WhatsApp, your website, a landing page, or another inbound channel, AURO nurtures the conversation until it becomes a real sales opportunity.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  "Respond instantly to inbound demand.",
                  "Maintain consistent follow-up at scale.",
                  "Qualify buyers more accurately.",
                  "Book more meetings without adding headcount.",
                  "Improve conversion from existing marketing channels.",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-neutral-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00]/60 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: TESTIMONIALS & FAQ ACCORDIONS (Replacing older text block) */}
        <section className="section quote-section min-h-screen flex flex-col justify-center items-center gap-10 px-4 md:px-10 lg:px-16" data-stage="4">
          
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-8">
            
            {/* Header tag */}
            <div className="text-center opacity-0 translate-y-5" data-reveal>
              <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">
                04 // FREQUENTLY ASKED QUESTIONS
              </span>
              <p className="text-neutral-300 font-serif italic text-lg sm:text-xl mt-2 select-none">
                Everything you need to know about the AURO platform.
              </p>
            </div>

            {/* Accordion List */}
            <div 
              className="opacity-0 translate-y-10 flex flex-col divide-y divide-[#222] border-t border-b border-[#222] pointer-events-auto"
              data-reveal
              data-delay="1"
            >
              {faqData.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div key={idx} className="py-4">
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full flex justify-between items-center text-left py-1 text-white hover:text-[#D4FF00] transition-colors cursor-pointer group"
                    >
                      <span className="text-xs sm:text-sm font-sans tracking-wide font-normal pr-4 flex items-center gap-3">
                        <span className="text-[9px] font-mono text-neutral-500 tracking-normal select-none">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        {faq.q}
                      </span>
                      <ChevronRight 
                        className={`w-4 h-4 shrink-0 text-neutral-600 group-hover:text-[#D4FF00] transition-transform duration-300 ${
                          isOpen ? 'rotate-90 text-[#D4FF00]' : ''
                        }`} 
                      />
                    </button>
                    
                    <div 
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isOpen ? 'max-h-[140px] opacity-100 mt-2.5 pb-2' : 'max-h-0 opacity-0'
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

          </div>
        </section>

        {/* Section 5: CALL TO ACTION / REGISTRATION (Secure secure onboarding) */}
        <section className="section cta-section min-h-screen flex flex-col justify-center items-center gap-8 text-center px-6 max-w-2xl mx-auto" data-stage="5" id="cta">
          
          <div className="opacity-0 translate-y-7 flex flex-col gap-4 select-none" data-reveal>
            <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">// SALES INFRASTRUCTURE UPGRADE</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-[1.1] font-light text-white">
              Ready To Upgrade Your<br />
              <em className="italic text-[#D4FF00] font-normal">Sales Infrastructure?</em>
            </h2>
          </div>

          <p
            className="opacity-0 translate-y-5 text-xs sm:text-sm leading-relaxed text-neutral-300 font-light max-w-[500px]"
            data-reveal
            data-delay="1"
          >
            Join Dubai agencies and developers who are using AI lead nurturing to create more meetings, stronger pipelines, and better revenue outcomes.
          </p>

          {/* Core CTA Button */}
          <div 
            className="opacity-0 translate-y-5 flex flex-col items-center gap-6 pointer-events-auto"
            data-reveal
            data-delay="2"
          >
            <button
              onClick={async () => {
                const cal = await getCalApi({ namespace: "30min" });
                cal("modal", { calLink: "auro-app/30min" });
              }}
              className="px-8 py-3 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-xs font-mono uppercase tracking-widest cursor-pointer transition-all duration-300 font-bold"
            >
              Book a Demo
            </button>
          </div>
        </section>

        {/* Section 6: FOOTER SCROLL AREA */}
        <section className="section footer h-1 hidden opacity-0" data-stage="6" />

      </div>

      {/* Insights Marquee — latest articles ticker */}
      <InsightsMarquee />

      {/* Large Site Editorial Footer */}
      <footer className="site-footer relative z-20 border-t border-[#333] bg-[#0a0a0a] p-[60px_40px_40px]">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4FF00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="m14.31 8 5.74 9.94"/>
                <path d="M9.69 8h11.48"/>
                <path d="m7.38 12 5.74-9.94"/>
                <path d="M9.69 16 3.95 6.06"/>
                <path d="M14.31 16H2.83"/>
                <path d="m16.62 12-5.74 9.94"/>
              </svg>
              <span className="font-serif italic text-2xl tracking-tighter text-[#D4FF00] select-none font-bold">
                AURO
              </span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400 font-light max-w-[260px]">
              The AI-first lead nurturing and qualification agent for Dubai's leading real estate agencies and developers. Turn every inquiry into a guided conversation, every conversation into a qualified meeting, and every meeting into a revenue opportunity.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">
              Platform
            </div>
            <button onClick={() => handleNavClick(0)} className="text-left text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-0 font-light font-mono">
              // Home
            </button>
            <button onClick={() => handleNavClick(2)} className="text-left text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-0 font-light font-mono">
              // How It Works
            </button>
            <button onClick={() => handleNavClick(3)} className="text-left text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-0 font-light font-mono">
              // Revenue
            </button>
            <button onClick={() => handleNavClick(1)} className="text-left text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-0 font-light font-mono">
              // About
            </button>
            <a href="/faq" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light font-mono">
              // FAQ
            </a>
            <a href="/dashboard" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light font-mono">
              // Login
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">
              Resources
            </div>
            <a href="/insights" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light font-mono">
              // Insights
            </a>
            <a href="/product-updates" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light font-mono">
              // Updates
            </a>
            <a href="/lead-nurturing-definition" className="text-xs text-neutral-400 hover:text-[#D4FF00] transition-colors font-light font-mono">
              // Lead Nurturing
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[9px] uppercase tracking-[3px] font-mono text-neutral-500 font-semibold select-none">
              Connect
            </div>
            <div className="text-neutral-400 font-mono text-xs cursor-default flex flex-col gap-1.5">
              <span>// Dubai, United Arab Emirates</span>
              <a href="mailto:pw@auroapp.com" className="hover:text-[#D4FF00] transition-colors text-[#D4FF00] underline">pw@auroapp.com</a>
            </div>
          </div>

        </div>

        <div className="max-w-[1100px] mx-auto mt-10 pt-6 border-t border-[#333] flex flex-wrap justify-between items-center gap-6">
          <div className="flex gap-4 items-center select-none">
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] shadow-[0_0_8px_#D4FF00]"></div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 uppercase italic">Status // System Synced with CRM_API</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 tracking-[0.1em] uppercase">
            © 2026 AURO Technologies. All rights reserved.
          </span>
          <div className="flex gap-6 font-mono text-[10px]">
            <a href="javascript:void(0)" className="uppercase tracking-wider text-neutral-500 hover:text-[#D4FF00] transition-colors font-mono">
              Privacy Policy
            </a>
            <a href="javascript:void(0)" className="uppercase tracking-wider text-neutral-500 hover:text-[#D4FF00] transition-colors font-mono">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>


      {/* --- FLOATING PREMIUM INTERACTIVE MODAL BOXES --- */}

      {/* 1. SECURE CLIENT PORTAL LOGIN OVERLAY */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="border border-[#333] bg-[#0c0c0ced]/95 p-6 max-w-sm w-full relative">
            <button 
              onClick={() => {
                setIsLoginOpen(false);
                setLoginStep('idle');
                setWorkEmail('');
                setPassword('');
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-widest border-b border-[#222] pb-3 mb-5 flex justify-between select-none">
              <span>SECURE_LOGIN_INTEGRITY</span>
              <span>TLS_v1.3</span>
            </p>

            {loginStep === 'success' ? (
              <div className="py-6 text-center flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00] flex items-center justify-center">
                  <Check className="w-5 h-5 text-[#D4FF00]" />
                </div>
                <h4 className="font-serif italic text-xl text-white">System Synchronized</h4>
                <p className="text-xs text-neutral-300 font-light leading-relaxed max-w-[280px]">
                  Welcome back, <span className="text-white font-mono">{workEmail || 'phillipdwalsh@gmail.com'}</span>. Authenticating access logs... Connection established safely.
                </p>
                <button
                  onClick={() => setIsLoginOpen(false)}
                  className="mt-4 px-6 py-2 bg-[#D4FF00] text-black text-[10px] font-mono uppercase font-bold tracking-widest cursor-pointer transition-colors"
                >
                  Enter Portal Node
                </button>
              </div>
            ) : loginStep === 'auth' ? (
              <div className="py-8 text-center flex flex-col items-center gap-4">
                <div className="w-7 h-7 border-2 border-dashed border-[#D4FF00] rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-[#D4FF00] uppercase tracking-widest animate-pulse">Running credentials hashing...</p>
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <h3 className="font-serif text-2xl text-white font-light mb-1">Partner Portal login</h3>
                <p className="text-[10px] text-neutral-400 font-mono -mt-2 uppercase block mb-1">
                  // ENTER CREDENTIAL RECORDS BELOW:
                </p>

                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input 
                      type="email" 
                      required
                      placeholder="Work Email" 
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      className="bg-black border border-[#222] pl-9 pr-3 py-2 text-white font-mono text-[11px] w-full outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input 
                      type="password" 
                      required
                      placeholder="Access Keycode" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-black border border-[#222] pl-9 pr-3 py-2 text-white font-mono text-[11px] w-full outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[9px] font-mono text-neutral-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="accent-[#D4FF00]" />
                    <span>Keep Active</span>
                  </label>
                  <a href="javascript:void(0)" className="hover:text-[#D4FF00]">// Forgot Key?</a>
                </div>

                <button 
                  type="submit" 
                  className="w-full mt-2 py-2 bg-[#D4FF00] text-black font-mono font-bold uppercase tracking-widest text-[9.5px] cursor-pointer"
                >
                  Decrypt Credentials
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* 2. VIDEO PLAYER MODAL */}
      {isVideoOpen && (
        <div
          className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="border border-[#333] bg-[#090909] max-w-4xl w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute -top-10 right-0 text-neutral-400 hover:text-white cursor-pointer z-10 text-xs font-mono uppercase tracking-wider"
            >
              Close ✕
            </button>
            <p className="text-[9px] font-mono text-[#D4FF00] uppercase tracking-widest border-b border-[#222] p-3 select-none font-bold">
              // AURO MARKETING FILM // VER.1.0
            </p>
            <div className="aspect-video bg-black">
              <video
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              >
                <source src="https://auroapp.com/HeroVideo%20V2.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="flex justify-end p-3 border-t border-[#222]">
              <button
                onClick={() => setIsVideoOpen(false)}
                className="px-4 py-1.5 border border-[#333] hover:border-[#D4FF00] text-neutral-400 hover:text-[#D4FF00] text-[9px] font-mono uppercase tracking-widest transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
