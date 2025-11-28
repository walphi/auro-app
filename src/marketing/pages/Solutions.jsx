import React, { useState } from 'react';
import { MessageSquare, Database, UserCheck, ArrowRight, BrainCircuit, Lock, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import WaitlistForm from '../components/WaitlistForm';

const SolutionsPage = () => {
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#030305] text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-amber-600/10 rounded-full blur-[120px] animate-blob mix-blend-screen" />
                <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-slate-800/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen" />
            </div>

            {/* Hero */}
            <section className="pt-32 pb-16 px-6 relative z-10 text-center">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in-up">
                        Visualize Your Efficiency: <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-200">The AURO Qualification Journey</span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto animate-fade-in-up animation-delay-2000">
                        See how AURO transforms a chaotic flood of leads into a streamlined pipeline of qualified investors.
                    </p>
                </div>
            </section>

            {/* Flow Chart Section */}
            <section className="py-12 px-6 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <div className="relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-amber-500/20 via-amber-500/50 to-amber-500/20 -translate-y-1/2 z-0 rounded-full" />

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 relative z-10">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center text-center group">
                                <div className="w-20 h-20 glass-panel rounded-2xl flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/20">
                                    <div className="absolute -top-3 -right-3 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">1</div>
                                    <Zap size={32} className="text-amber-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">Lead Inbound</h3>
                                <p className="text-sm text-slate-500">Ads, Portals, Website</p>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col items-center text-center group">
                                <div className="w-20 h-20 glass-panel rounded-2xl flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/20">
                                    <div className="absolute -top-3 -right-3 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">2</div>
                                    <MessageSquare size={32} className="text-amber-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">Instant Greeting</h3>
                                <p className="text-sm text-slate-500">WhatsApp &lt; 2s Response</p>
                            </div>

                            {/* Step 3 (Center/Main) */}
                            <div className="flex flex-col items-center text-center group">
                                <div className="w-24 h-24 bg-gradient-to-br from-amber-600 to-yellow-700 rounded-3xl shadow-2xl shadow-amber-500/30 flex items-center justify-center mb-6 relative z-10 scale-110 group-hover:scale-125 transition-transform duration-300 border-4 border-[#020617]">
                                    <div className="absolute -top-3 -right-3 bg-[#020617] text-amber-400 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-amber-500/50">3</div>
                                    <BrainCircuit size={40} className="text-white animate-pulse" />
                                </div>
                                <h3 className="font-bold text-lg text-white mb-2">AI Qualification</h3>
                                <p className="text-sm text-slate-500">Budget, Intent, Timeline</p>
                            </div>

                            {/* Step 4 */}
                            <div className="flex flex-col items-center text-center group">
                                <div className="w-20 h-20 glass-panel rounded-2xl flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/20">
                                    <div className="absolute -top-3 -right-3 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">4</div>
                                    <UserCheck size={32} className="text-amber-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">Scoring & Filtering</h3>
                                <p className="text-sm text-slate-500">Qualified vs. Unqualified</p>
                            </div>

                            {/* Step 5 */}
                            <div className="flex flex-col items-center text-center group">
                                <div className="w-20 h-20 glass-panel rounded-2xl flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/20">
                                    <div className="absolute -top-3 -right-3 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">5</div>
                                    <Database size={32} className="text-amber-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">CRM Sync & Handover</h3>
                                <p className="text-sm text-slate-500">Agent Takes Over</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Deep Dive Features */}
            <section className="py-20 px-6 relative z-10">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Feature 1 */}
                    <div className="glass-panel p-8 rounded-3xl hover:bg-white/5 transition-colors">
                        <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center mb-6">
                            <BrainCircuit size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Multi-Agent AI Architecture</h3>
                        <p className="text-slate-400 leading-relaxed mb-6">
                            AURO isn't just a chatbot. It's a system of specialized AI agents working together. One agent handles language translation, another manages objection handling, and a third focuses purely on financial qualification.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Context-aware conversations (remembers previous chats)
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                RAG (Retrieval-Augmented Generation) for project knowledge
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Sentiment analysis to detect "Hot" leads
                            </li>
                        </ul>
                    </div>

                    {/* Feature 2 */}
                    <div className="glass-panel p-8 rounded-3xl hover:bg-white/5 transition-colors">
                        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Enterprise-Grade Security</h3>
                        <p className="text-slate-400 leading-relaxed mb-6">
                            We understand that your lead data is your most valuable asset. AURO is built with enterprise security standards to ensure your data never leaves your control.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                End-to-End Encryption
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                GDPR & UAE Data Privacy Compliant
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Role-Based Access Control
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6 text-center relative z-10">
                <h2 className="text-3xl font-bold text-white mb-8">Ready to automate your qualification?</h2>
                <button
                    onClick={() => setIsWaitlistOpen(true)}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-bold text-lg shadow-xl shadow-amber-500/30 transition-all hover:-translate-y-1 cursor-pointer"
                >
                    Get Started Now
                    <ArrowRight size={20} />
                </button>
            </section>

            {/* Waitlist Form Modal */}
            <WaitlistForm isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />
        </div>
    );
};

export default SolutionsPage;
