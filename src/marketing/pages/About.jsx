import React, { useState } from 'react';
import { TrendingUp, Shield, Clock, Zap, CheckCircle2, Sparkles, Target, Users } from 'lucide-react';
import WaitlistForm from '../components/WaitlistForm';

const AboutPage = () => {
    return (
        <div className="min-h-screen bg-[#030305] text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px] animate-blob mix-blend-screen" />
                <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-screen" />
            </div>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
                            <Sparkles size={16} className="text-amber-400" />
                            <span className="text-sm font-medium text-white">About AURO</span>
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                            The AURO Story:
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-200">
                                Transforming Lead Qualification
                            </span>
                            <br />
                            in Elite Real Estate
                        </h1>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-12 px-6 relative z-10">
                <div className="max-w-5xl mx-auto">
                    {/* The Challenge */}
                    <div className="glass-panel p-10 rounded-3xl mb-12">
                        <h2 className="text-3xl font-bold text-white mb-6">The Challenge We Solve</h2>
                        <p className="text-lg text-slate-300 leading-relaxed mb-6">
                            At AURO, we understand the singular challenge facing luxury real estate agencies and top-tier developers in the UAE: The chaos of overwhelming lead volume masking the scarcity of truly qualified buyers.
                        </p>
                        <p className="text-lg text-slate-300 leading-relaxed">
                            Premium brands invest millions into generating interest, yet their most valuable resource—the time of their expert sales agents—is spent manually sifting through unqualified inquiries, often drowning in the high volume of traffic from the market's favourite communication channel. This inefficient process creates a massive bottleneck that costs millions in lost commissions and missed opportunities for off-plan and ready property sales.
                        </p>
                    </div>

                    {/* Founder Section */}
                    <div className="glass-panel p-10 rounded-3xl mb-12">
                        <div className="flex items-center gap-3 mb-8">
                            <Users className="text-amber-400" size={32} />
                            <h2 className="text-3xl font-bold text-white">Driven by Deep Market Expertise</h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-1 flex justify-center lg:justify-start">
                                <img
                                    src="/phillip-profile.jpg"
                                    alt="Phillip - AURO Founder"
                                    className="w-64 h-auto rounded-2xl object-contain shadow-2xl border-2 border-white/10"
                                />
                            </div>

                            <div className="lg:col-span-2">
                                <p className="text-lg text-slate-300 leading-relaxed mb-6">
                                    AURO was founded not by mere technologists, but by seasoned industry veterans who have lived this pain.
                                </p>
                                <p className="text-lg text-slate-300 leading-relaxed mb-6">
                                    Phillip, drawing on his executive experience as Marketing Director for top firms including <span className="text-white font-semibold">Sotheby's Realty (UAE & UK)</span>, <span className="text-white font-semibold">Betterhomes Head of Marketing and Automation</span>, and <span className="text-white font-semibold">Unique Properties Head of Marketing</span>, brings a unique understanding of the complexities of high-stakes real estate marketing in the UAE.
                                </p>
                                <p className="text-lg text-slate-300 leading-relaxed">
                                    He recognizes the precise moment a lead goes cold, the need for immediate, 24/7 engagement, and the critical importance of handing off only financially verified, ready-to-buy prospects to an agent.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Our Solution */}
                    <div className="glass-panel p-10 rounded-3xl mb-12">
                        <div className="flex items-center gap-3 mb-8">
                            <Target className="text-amber-400" size={32} />
                            <h2 className="text-3xl font-bold text-white">Our Solution: Intelligent, 24/7 Automation</h2>
                        </div>

                        <p className="text-lg text-slate-300 leading-relaxed mb-8">
                            AURO was created to solve this problem by deploying sophisticated Multi-Agent AI directly into the heart of the sales process.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                                    <Clock className="text-amber-400" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Reduce Qualification Time</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    Drastically cut the time it takes to convert a raw inquiry into a sales-ready lead.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                                    <Zap className="text-emerald-400" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Operate 24/7</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    Ensure every lead, whether received at 2 PM or 2 AM from anywhere in the world, receives an instant, intelligent response.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                                    <Shield className="text-blue-400" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Master the Market Tool</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    Run critical qualification conversations seamlessly and persistently via WhatsApp, where the majority of high-intent inquiries begin.
                                </p>
                            </div>
                        </div>

                        <p className="text-lg text-slate-300 leading-relaxed">
                            AURO automates the triage, filtering, and scoring, allowing your expert agents to focus exclusively on closing transactions, not chasing dead ends. We don't just generate leads; we manufacture sales-ready opportunities.
                        </p>
                    </div>

                    {/* CTA */}
                    <div className="text-center bg-gradient-to-br from-amber-600/10 to-yellow-600/10 border border-amber-500/20 rounded-3xl p-12">
                        <h2 className="text-3xl font-bold text-white mb-6">Ready to Transform Your Lead Qualification?</h2>
                        <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
                            Join Dubai's leading developers and agencies who trust AURO to filter out the noise and deliver only the qualified buyers.
                        </p>
                        <button
                            data-cal-link="miel-media/15min"
                            data-cal-config='{"layout":"month_view"}'
                            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-bold text-lg shadow-xl shadow-amber-500/30 transition-all hover:-translate-y-1 cursor-pointer"
                        >
                            <CheckCircle2 size={20} />
                            Book Your Strategy Session
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AboutPage;
