import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Solutions', path: '/solutions' },
        { name: 'ROI & Case Studies', path: '/roi' },
    ];

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                isScrolled
                    ? "bg-[#020617]/80 backdrop-blur-md border-white/10 shadow-lg"
                    : "bg-transparent border-transparent"
            )}
        >
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all border border-white/10">
                        <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <span className="text-2xl font-bold text-white tracking-tight">AURO<span className="text-indigo-500">.ai</span></span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-indigo-400",
                                location.pathname === link.path ? "text-indigo-400 font-bold" : "text-slate-300"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <Link
                        to="/dashboard"
                        className="text-slate-300 hover:text-white font-medium text-sm transition-colors"
                    >
                        Login
                    </Link>
                    <Link
                        to="/#demo"
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-5 py-2.5 rounded-full text-sm font-bold backdrop-blur-md transition-all hover:-translate-y-0.5"
                    >
                        Request Demo
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-white"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-20 left-0 right-0 bg-[#0b101b] border-b border-white/10 shadow-xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-5">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={cn(
                                "text-base font-medium py-2 border-b border-white/5",
                                location.pathname === link.path ? "text-indigo-400" : "text-slate-300"
                            )}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="flex flex-col gap-3 mt-4">
                        <Link
                            to="/dashboard"
                            className="w-full text-center py-3 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Login
                        </Link>
                        <Link
                            to="/#demo"
                            className="w-full text-center py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Request Demo
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
