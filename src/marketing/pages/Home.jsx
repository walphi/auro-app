import React, { useState } from 'react';
import { MessageSquare, TrendingUp, Clock, CheckCircle2, ShieldCheck, Zap, ArrowRight, Phone, Play, ChevronRight, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import CityCanvas from '../components/CityCanvas';
import FAQ from '../components/FAQ';
import WaitlistForm from '../components/WaitlistForm';

const HomePage = () => {
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#030305] text-white overflow-hidden selection:bg-indigo-500/30">
            {/* 3D Dubai Skyline Background */}
            <CityCanvas />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="animate-fade-in-up">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-pointer group">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-sm font-medium text-white-200 group-hover:text-white transition-colors">AURO 2.0 is Live</span>
                                <ChevronRight size={14} className="text-white-200 group-hover:translate-x-1 transition-transform" />
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                                <span className="block text-white">Stop Drowning in</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-400 to-amber-100 animate-pulse-glow">WhatsApp Leads.</span>
                            </h1>

                            <p className="text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
                                The AI-first qualifying agent for Dubai's leading real estate agencies and developers. Automate 100% of your WhatsApp inquiries and only speak to qualified investors.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
                                <div className="relative w-full sm:w-auto group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
                                    <button
                                        data-cal-link="miel-media/15min"
                                        data-cal-config='{"layout":"month_view"}'
                                        className="relative w-full sm:w-auto px-8 py-4 bg-[#0b101b] hover:bg-[#1e293b] text-white rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all border border-white/10 cursor-pointer"
                                    >
                                        Request Demo
                                        <ArrowRight size={20} className="text-amber-400" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsVideoOpen(true)}
                                    className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all"
                                >
                                    <Play size={20} className="fill-white" />
                                    Watch Video
                                </button>
                            </div>

                            <div className="flex items-center gap-8 text-slate-500 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span>White-Glove Setup & Integration</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span>Expert-Led Qualification Strategy Session</span>
                                </div>
                            </div>
                        </div>

                        {/* 3D Visual / Abstract Representation */}
                        <div className="relative hidden lg:block">
                            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-yellow-500/10 rounded-full blur-3xl animate-pulse-glow" />

                            {/* Floating Glass Cards */}
                            <div className="relative z-10 w-full h-[600px] perspective-1000">
                                {/* Main Dashboard Card */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] glass-panel rounded-2xl p-6 animate-float border-t border-l border-white/20 shadow-2xl shadow-amber-900/20">
                                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-red-500" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                            <div className="w-3 h-3 rounded-full bg-green-500" />
                                        </div>
                                        <div className="text-xs font-mono text-slate-400">auro_agent_v2.tsx</div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold">AI</div>
                                            <div className="glass-card p-3 rounded-xl rounded-tl-none text-sm text-slate-200 max-w-[80%]">
                                                Hello! I noticed you're interested in the Palm Jumeirah Villa. Are you looking for investment or personal use?
                                            </div>
                                        </div>
                                        <div className="flex gap-4 flex-row-reverse">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">U</div>
                                            <div className="bg-white/10 border border-white/10 p-3 rounded-xl rounded-tr-none text-sm text-white max-w-[80%]">
                                                Investment. What's the expected ROI?
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold">AI</div>
                                            <div className="glass-card p-3 rounded-xl rounded-tl-none text-sm text-slate-200 max-w-[80%]">
                                                Based on current market trends, we're projecting 8-10% net ROI. Would you like to see the financial breakdown?
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Stats Card 1 */}
                                <div className="absolute top-20 right-0 w-48 glass-panel rounded-xl p-4 animate-float-delayed border-t border-l border-white/20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                                            <TrendingUp size={16} />
                                        </div>
                                        <span className="text-xs text-slate-400">Conversion</span>
                                    </div>
                                    <div className="text-2xl font-bold text-white">+12.5%</div>
                                </div>

                                {/* Floating Stats Card 2 */}
                                <div className="absolute bottom-40 left-[-20px] w-56 glass-panel rounded-xl p-4 animate-float border-t border-l border-white/20" style={{ animationDelay: '1s' }}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                            <MessageSquare size={16} />
                                        </div>
                                        <span className="text-xs text-slate-400">Active Chats</span>
                                    </div>
                                    <div className="text-2xl font-bold text-white">1,248</div>
                                    <div className="w-full bg-white/10 h-1 mt-3 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full w-[70%]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-32 px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">Intelligence at Scale</span>
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                            Replace your static forms with dynamic, intelligent conversations that convert.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Zap,
                                title: "Instant Response",
                                desc: "Engage leads within 2 seconds, 24/7. Never let a warm lead go cold waiting for an agent.",
                                color: "from-yellow-400 to-orange-500"
                            },
                            {
                                icon: ShieldCheck,
                                title: "Financial Filtering",
                                desc: "AI naturally asks budget & timeline questions, filtering out window shoppers automatically.",
                                color: "from-emerald-400 to-teal-500"
                            },
                            {
                                icon: BrainCircuit,
                                title: "Context Aware",
                                desc: "Remembers past conversations and preferences, delivering a hyper-personalized experience.",
                                color: "from-amber-400 to-yellow-500"
                            }
                        ].map((item, i) => (
                            <div key={i} className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-slate-700/50 hover:to-slate-800/50 transition-all duration-500">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                <div className="relative h-full bg-[#0b101b]/50 rounded-[22px] p-8 border border-white/5 group-hover:border-white/10 transition-colors">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 shadow-lg`}>
                                        <item.icon size={28} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">{item.title}</h3>
                                    <p className="text-slate-400 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Dark CTA Section */}
            <section id="demo" className="py-20 px-6 relative z-10">
                <div className="max-w-5xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-[3rem] blur-3xl opacity-50" />
                    <div className="relative bg-transparent backdrop-blur-xl border border-white/10 rounded-[3rem] p-12 lg:p-20 text-center overflow-hidden">
                        {/* Grid Pattern Overlay */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                        <div className="relative z-10">
                            <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8 tracking-tight">
                                Ready to upgrade your <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-200">Sales Infrastructure?</span>
                            </h2>
                            <p className="text-slate-300 text-lg mb-12 max-w-2xl mx-auto">
                                Join the top 1% of Dubai's real estate agencies and developers using AI to dominate the market. Limited onboarding slots available for Q4.
                            </p>

                            <div className="flex justify-center">
                                <button
                                    onClick={() => setIsWaitlistOpen(true)}
                                    className="bg-white hover:bg-slate-200 text-slate-900 px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg shadow-white/10 flex items-center gap-2 cursor-pointer"
                                >
                                    Request Early Access
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                            <p className="mt-6 text-slate-500 text-sm">
                                Complete our qualification form to secure your spot
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <FAQ />

            {/* Waitlist Form Modal */}
            <WaitlistForm isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />

            {/* Video Modal */}
            {isVideoOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setIsVideoOpen(false)}>
                    <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsVideoOpen(false)}
                            className="absolute -top-12 right-0 text-white hover:text-amber-400 transition-colors"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video">
                            <video
                                controls
                                autoPlay
                                className="w-full h-full"
                            >
                                <source src="/HeroVideo V1.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
