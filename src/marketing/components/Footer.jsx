import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Instagram } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-[#020617] text-white py-16 border-t border-white/10">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight">AURO.ai</span>
                        </div>
                        <p className="text-slate-400 max-w-sm leading-relaxed">
                            The AI-first qualifying agent for Dubai's elite real estate developers. Stop drowning in WhatsApp leads and start closing more deals with intelligent automation.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6">Platform</h4>
                        <ul className="space-y-4 text-slate-400">
                            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li><Link to="/solutions" className="hover:text-white transition-colors">Solutions</Link></li>
                            <li><Link to="/roi" className="hover:text-white transition-colors">ROI & Case Studies</Link></li>
                            <li><Link to="/dashboard" className="hover:text-white transition-colors">Login</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6">Connect</h4>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-600 transition-all text-slate-400 hover:text-white">
                                <Linkedin size={20} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-600 transition-all text-slate-400 hover:text-white">
                                <Twitter size={20} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-600 transition-all text-slate-400 hover:text-white">
                                <Instagram size={20} />
                            </a>
                        </div>
                        <p className="mt-6 text-slate-500 text-sm">
                            Dubai, United Arab Emirates<br />
                            support@auro.ai
                        </p>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                    <p>&copy; {new Date().getFullYear()} AURO AI Technologies. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
