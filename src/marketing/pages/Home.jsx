import React from 'react';
import { MessageSquare, TrendingUp, Clock, CheckCircle2, ShieldCheck, Zap, ArrowRight, Phone, Play, ChevronRight, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

const HomePage = () => {
    return (
        <div className="min-h-screen bg-[#020617] text-white overflow-hidden selection:bg-indigo-500/30">
            {/* Background Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] animate-blob mix-blend-screen" />
                <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen" />
                <div className="absolute bottom-[-20%] left-[20%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-4000 mix-blend-screen" />
            </div>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="animate-fade-in-up">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-pointer group">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm font-medium text-indigo-200 group-hover:text-white transition-colors">AURO 2.0 is Live</span>
                                <ChevronRight size={14} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                                <span className="block text-white">Stop Drowning in</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-pulse-glow">WhatsApp Leads.</span>
                            </h1>

                            <p className="text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
                                The AI-first qualifying agent for Dubai's elite developers. Automate 100% of your WhatsApp inquiries and only speak to qualified investors.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
                                <div className="relative w-full sm:w-auto group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
                                    <Link
                                        to="/#demo"
                                        className="relative w-full sm:w-auto px-8 py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all border border-white/10"
                                    >
                                        Request Demo
                                        <ArrowRight size={20} className="text-indigo-400" />
                                    </Link>
                                </div>
                                <Link
                                    to="/solutions"
                                    className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all"
                                >
                                    <Play size={20} className="fill-white" />
                                    Watch Video
                                </Link>
                            </div>

                            <div className="flex items-center gap-8 text-slate-500 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span>No Credit Card Required</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span>14-Day Free Trial</span>
                                </div>
                            </div>
                        </div>

                        {/* 3D Visual / Abstract Representation */}
                        <div className="relative hidden lg:block">
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse-glow" />

                            {/* Floating Glass Cards */}
                            <div className="relative z-10 w-full h-[600px] perspective-1000">
                                {/* Main Dashboard Card */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] glass-panel rounded-2xl p-6 animate-float border-t border-l border-white/20 shadow-2xl shadow-indigo-500/20">
                                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-red-500" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                            <div className="w-3 h-3 rounded-full bg-green-500" />
                                        </div>
                                        <div className="text-xs font-mono text-indigo-300">auro_agent_v2.tsx</div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">AI</div>
                                            <div className="glass-card p-3 rounded-xl rounded-tl-none text-sm text-indigo-100 max-w-[80%]">
                                                Hello! I noticed you're interested in the Palm Jumeirah Villa. Are you looking for investment or personal use?
                                            </div>
                                        </div>
                                        <div className="flex gap-4 flex-row-reverse">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">U</div>
                                            <div className="bg-indigo-600/20 border border-indigo-500/30 p-3 rounded-xl rounded-tr-none text-sm text-white max-w-[80%]">
                                                Investment. What's the expected ROI?
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">AI</div>
                                            <div className="glass-card p-3 rounded-xl rounded-tl-none text-sm text-indigo-100 max-w-[80%]">
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
                                color: "from-indigo-400 to-purple-500"
                            }
                        ].map((item, i) => (
                            <div key={i} className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-indigo-500/50 hover:to-purple-500/50 transition-all duration-500">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                <div className="relative h-full bg-[#0b101b] rounded-[22px] p-8 border border-white/5 group-hover:border-white/10 transition-colors">
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
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[3rem] blur-3xl opacity-30" />
                    <div className="relative bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[3rem] p-12 lg:p-20 text-center overflow-hidden">
                        {/* Grid Pattern Overlay */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                        <div className="relative z-10">
                            <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8 tracking-tight">
                                Ready to upgrade your <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Sales Infrastructure?</span>
                            </h2>
                            <p className="text-indigo-200 text-lg mb-12 max-w-2xl mx-auto">
                                Join the top 1% of Dubai developers using AI to dominate the market.
                                Limited onboarding slots available for Q4.
                            </p>

                            <form className="max-w-md mx-auto relative flex items-center">
                                <input
                                    type="email"
                                    placeholder="Enter your work email"
                                    className="w-full bg-[#1e293b] border border-white/10 text-white px-6 py-4 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-36 shadow-inner"
                                />
                                <button type="submit" className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-full font-bold text-sm transition-all shadow-lg shadow-indigo-500/25">
                                    Get Access
                                </button>
                            </form>
                            <p className="mt-6 text-slate-500 text-sm">
                                No credit card required • Cancel anytime
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
