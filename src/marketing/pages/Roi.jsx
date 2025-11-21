import React from 'react';
import { TrendingUp, Clock, DollarSign, ArrowRight, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';

const RoiPage = () => {
    return (
        <div className="min-h-screen bg-[#020617] text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px] animate-blob mix-blend-screen" />
                <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-screen" />
            </div>

            {/* Hero */}
            <section className="pt-32 pb-16 px-6 relative z-10 text-center">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in-up">
                        The Cost of <span className="text-red-400">Waiting</span> vs. <br />
                        The ROI of <span className="text-emerald-400">Automating</span>.
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto animate-fade-in-up animation-delay-2000">
                        Stop guessing. See the tangible business impact AURO delivers to real estate developers in Dubai.
                    </p>
                </div>
            </section>

            {/* Metrics Grid */}
            <section className="py-12 px-6 relative z-10">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Metric 1 */}
                    <div className="glass-panel p-10 rounded-[2.5rem] text-center group hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                            <Clock size={32} />
                        </div>
                        <div className="text-5xl font-bold text-white mb-2 tracking-tight">90%</div>
                        <div className="text-lg font-medium text-indigo-400 mb-4">Reduction in Pre-Sales Time</div>
                        <p className="text-slate-400 leading-relaxed">
                            Agents no longer waste time on "Hi, is this available?" chats. They only speak to qualified leads.
                        </p>
                    </div>

                    {/* Metric 2 */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/30 text-center transform md:scale-110 z-10 relative overflow-hidden border border-indigo-500/50">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <TrendingUp size={32} />
                            </div>
                            <div className="text-5xl font-bold mb-2 tracking-tight">3x</div>
                            <div className="text-lg font-medium text-indigo-200 mb-4">Increase in Qualified Leads</div>
                            <p className="text-indigo-100 leading-relaxed">
                                By responding instantly 24/7, AURO captures and qualifies leads that would otherwise go cold.
                            </p>
                        </div>
                    </div>

                    {/* Metric 3 */}
                    <div className="glass-panel p-10 rounded-[2.5rem] text-center group hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                            <DollarSign size={32} />
                        </div>
                        <div className="text-5xl font-bold text-white mb-2 tracking-tight">24/7</div>
                        <div className="text-lg font-medium text-emerald-400 mb-4">Lead Coverage</div>
                        <p className="text-slate-400 leading-relaxed">
                            Capture international investors in different time zones while your local team sleeps.
                        </p>
                    </div>
                </div>
            </section>

            {/* Testimonials / Case Studies */}
            <section className="py-20 px-6 relative z-10">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-12">Trusted by Dubai's Elite</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="glass-panel p-8 rounded-3xl relative hover:bg-white/5 transition-colors">
                            <Quote className="absolute top-8 right-8 text-white/10" size={48} />
                            <p className="text-slate-300 text-lg leading-relaxed mb-6 relative z-10">
                                "Before AURO, our agents were overwhelmed with WhatsApp messages. Now, they wake up to a calendar full of qualified meetings. It's been a game-changer for our off-plan launches."
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-400">JD</div>
                                <div>
                                    <div className="font-bold text-white">Sales Director</div>
                                    <div className="text-sm text-slate-500">Leading Dubai Developer</div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-8 rounded-3xl relative hover:bg-white/5 transition-colors">
                            <Quote className="absolute top-8 right-8 text-white/10" size={48} />
                            <p className="text-slate-300 text-lg leading-relaxed mb-6 relative z-10">
                                "The speed is incredible. We used to lose leads because we couldn't reply fast enough on weekends. AURO handles everything instantly, and the qualification accuracy is surprisingly high."
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-400">MK</div>
                                <div>
                                    <div className="font-bold text-white">CEO</div>
                                    <div className="text-sm text-slate-500">Luxury Brokerage Firm</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Cost of Waiting */}
            <section className="py-20 px-6 relative z-10 bg-[#0b101b] border border-white/10 rounded-[3rem] mx-4 lg:mx-12 mb-12 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[150px] opacity-20 pointer-events-none animate-pulse-glow" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">The Cost of Waiting is High</h2>
                    <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
                        Every day you wait, you're losing leads to competitors who respond faster. Don't let your marketing budget go to waste.
                    </p>
                    <Link
                        to="/#demo"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 hover:bg-indigo-50 rounded-full font-bold text-lg shadow-xl transition-all hover:-translate-y-1"
                    >
                        Calculate Your ROI
                        <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default RoiPage;
