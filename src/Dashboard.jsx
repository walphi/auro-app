import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    Phone,
    Search,
    Send,
    Mic,
    CheckCircle2,
    XCircle,
    Calendar as CalendarIcon,
    User,
    MoreVertical,
    Plus,
    ChevronRight,
    Filter,
    Settings,
    Bell,
    Mail,
    MapPin,
    DollarSign,
    Home,
    Tag,
    Briefcase,
    Clock,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    ChevronDown,
    FileText,
    ListTodo,
    Video,
    MoreHorizontal,
    Paperclip,
    Folder,
    Book
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton, useUser } from '@clerk/clerk-react';
import AgentFolders from './components/AgentFolders';
import TenantAdmin from './components/TenantAdmin';
import KnowledgeBaseAdmin from './components/KnowledgeBaseAdmin';

// Utils
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumSignificantDigits: 3 }).format(amount);
}

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Auro SVG Logo
const AuroLogoSvg = ({ size = 24, strokeColor = "#f1f1f1", className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="m14.31 8 5.74 9.94" />
        <path d="M9.69 8h11.48" />
        <path d="m7.38 12 5.74-9.94" />
        <path d="M9.69 16 3.95 6.06" />
        <path d="M14.31 16H2.83" />
        <path d="m16.62 12-5.74 9.94" />
    </svg>
);

// Sidebar Component
const Sidebar = ({ activeView, setActiveView, currentTenant, allTenants, onTenantChange }) => {
    const { user } = useUser();
    const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
        { icon: Users, label: 'Leads', view: 'leads' },
        { icon: Mail, label: 'Subscribers', view: 'subscribers' },
        { icon: MessageSquare, label: 'Messages', view: 'messages' },
        { icon: CalendarIcon, label: 'Calendar', view: 'calendar' },
        { icon: Book, label: 'Knowledge Base', view: 'knowledge' },
        { icon: Folder, label: 'Agent Folders', view: 'agent-folders' },
        { icon: Settings, label: 'Tenant Admin', view: 'tenant-admin' }
    ];

    return (
        <div className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 bg-[#0a0a0a] border-r border-[#333] h-dvh relative z-20">
            {/* Logo & Tenant Switcher */}
            <div className="pt-8 pb-4 px-6">
                <div className="flex items-center gap-3 mb-6 relative group">
                    <AuroLogoSvg size={28} strokeColor="#f1f1f1" className="shrink-0" />
                    <div className="flex flex-col">
                        <span className="font-serif italic text-2xl tracking-tighter text-[#f1f1f1] select-none font-bold leading-none">AURO</span>
                    </div>
                </div>

                {/* Tenant Switcher Tool */}
                {allTenants?.length > 1 && (
                    <div className="relative mt-2">
                        <button
                            onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[#0b0b0b]/90 border border-[#333] hover:border-[#D4FF00]/30 transition-all group overflow-hidden"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#D4FF00] shadow-[0_0_8px_rgba(212,255,0,0.5)] flex-shrink-0" />
                                <span className="text-xs font-bold text-neutral-200 truncate pr-2">{currentTenant?.name || 'Loading...'}</span>
                            </div>
                            <ChevronDown size={14} className={cn("text-neutral-500 group-hover:text-[#D4FF00] transition-all", isTenantMenuOpen && "rotate-180")} />
                        </button>

                        {isTenantMenuOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-[#0a0a0a] border border-[#333] shadow-2xl z-50 overflow-hidden">
                                <div className="px-3 pb-2 mb-2 border-b border-[#333]">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Switch Workspace</span>
                                </div>
                                {allTenants.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            onTenantChange(t);
                                            setIsTenantMenuOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-4 py-2.5 text-xs font-semibold transition-all flex items-center justify-between group/item",
                                            currentTenant?.id === t.id ? "text-[#D4FF00] bg-[#D4FF00]/5" : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <span className="truncate">{t.name}</span>
                                        {currentTenant?.id === t.id && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] shadow-[0_0_10px_rgba(212,255,0,0.5)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-3 mt-6">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.view;

                    return (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={cn(
                                "w-full flex items-center gap-4 px-4 py-3.5 transition-all duration-300 group relative overflow-hidden border",
                                isActive
                                    ? "bg-[#0b0b0b]/90 border-[#333] text-white"
                                    : "bg-transparent border-transparent text-neutral-400 hover:bg-[#0b0b0b]/90 hover:border-[#333] hover:text-neutral-200"
                            )}
                        >
                            <div className={cn(
                                "p-2 transition-all duration-300",
                                isActive ? "bg-[#D4FF00]/10 text-[#D4FF00]" : "bg-white/5 text-neutral-500 group-hover:bg-white/5 group-hover:text-neutral-300"
                            )}>
                                <Icon size={18} className="relative z-10" />
                            </div>
                            <span className={cn("font-semibold text-sm tracking-wide relative z-10", isActive ? "text-white" : "")}>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* User Profile */}
            <div className="p-4 mt-auto">
                <div className="bg-[#0b0b0b]/90 border border-[#333] p-3 flex items-center gap-3 relative group">
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold ring-2 ring-white/5 transition-all">
                        {user?.imageUrl ? (
                            <img src={user.imageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User size={14} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-200 truncate">{user?.fullName || 'User'}</p>
                        <button
                            onClick={() => document.querySelector('.cl-userButtonTrigger')?.click()}
                            className="text-[10px] text-neutral-500 hover:text-[#D4FF00] truncate cursor-pointer transition-colors text-left"
                        >
                            View Profile
                        </button>
                    </div>
                    <button
                        onClick={() => document.querySelector('.cl-userButtonTrigger')?.click()}
                        className="text-neutral-500 hover:text-[#D4FF00] transition-colors cursor-pointer z-10"
                    >
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Hidden Clerk UserButton - fixed positioning to avoid layout shifts */}
            <div className="fixed bottom-4 left-4 opacity-0 pointer-events-auto z-[100]">
                <UserButton afterSignOutUrl="/" />
            </div>
        </div>
    );
};

// Bottom Navigation for Mobile
const BottomNav = ({ activeView, setActiveView }) => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Dash', view: 'dashboard' },
        { icon: Users, label: 'Leads', view: 'leads' },
        { icon: Mail, label: 'Subs', view: 'subscribers' },
        { icon: MessageSquare, label: 'Chat', view: 'messages' },
        { icon: CalendarIcon, label: 'Cal', view: 'calendar' },
        { icon: Book, label: 'KB', view: 'knowledge' },
        { icon: Folder, label: 'Folders', view: 'agent-folders' },
        { icon: Settings, label: 'Admin', view: 'tenant-admin' }
    ];

    return (
        <nav className="flex lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-[#333] px-1 pb-safe">
            <div className="flex items-center justify-around w-full py-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.view;
                    return (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1.5 transition-all relative min-w-0",
                                isActive ? "text-[#D4FF00]" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            <Icon size={16} />
                            <span className={cn(
                                "text-[8px] font-mono tracking-wider leading-tight",
                                isActive ? "text-[#D4FF00]" : "text-neutral-500"
                            )}>{item.label}</span>
                            {isActive && <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#D4FF00]" />}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

// Subscribers List Component
const SubscribersList = () => {
    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubscribers = async () => {
            const { data, error } = await supabase
                .from('subscribers')
                .select('*')
                .order('subscribed_at', { ascending: false });
            if (!error && data) {
                setSubscribers(data);
            }
            setLoading(false);
        };
        fetchSubscribers();
    }, []);

    const total = subscribers.length;
    const active = subscribers.filter(s => s.status === 'active').length;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#D4FF00] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="max-w-5xl w-full mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-xl font-bold font-mono">Subscribers</h1>
                    <div className="flex gap-6 text-xs font-mono text-neutral-400">
                        <span>{total} total</span>
                        <span className="text-[#D4FF00]">{active} active</span>
                    </div>
                </div>
                <div className="bg-[#111] border border-[#333] overflow-hidden">
                    {subscribers.length === 0 ? (
                        <div className="p-8 text-center text-neutral-500 text-sm font-mono">No subscribers yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                                <thead>
                                    <tr className="border-b border-[#333] bg-[#0a0a0a]">
                                        <th className="text-left px-4 py-3 text-neutral-500 font-bold uppercase tracking-wider">Name</th>
                                        <th className="text-left px-4 py-3 text-neutral-500 font-bold uppercase tracking-wider">Email</th>
                                        <th className="text-left px-4 py-3 text-neutral-500 font-bold uppercase tracking-wider">Subscribed</th>
                                        <th className="text-left px-4 py-3 text-neutral-500 font-bold uppercase tracking-wider">Status</th>
                                        <th className="text-left px-4 py-3 text-neutral-500 font-bold uppercase tracking-wider">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscribers.map((sub, i) => (
                                        <tr key={sub.id} className={`border-b border-[#222] hover:bg-[#0a0a0a]/50 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}>
                                            <td className="px-4 py-3 text-neutral-200 font-semibold">{sub.name}</td>
                                            <td className="px-4 py-3 text-neutral-400">{sub.email}</td>
                                            <td className="px-4 py-3 text-neutral-500">{new Date(sub.subscribed_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sub.status === 'active' ? 'text-[#D4FF00] bg-[#D4FF00]/10' : 'text-red-400 bg-red-400/10'}`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500">{sub.source}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Dashboard Component
const Dashboard = ({ leads }) => {
    const { user } = useUser();
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'New').length;
    const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length;

    const stats = [
        { title: 'Total Leads', value: totalLeads, icon: Users, color: 'text-[#D4FF00]', bg: 'bg-[#D4FF00]/10', border: 'border-[#D4FF00]/30' },
        { title: 'New Inquiries', value: newLeads, icon: MessageSquare, color: 'text-[#D4FF00]', bg: 'bg-[#D4FF00]/10', border: 'border-[#D4FF00]/30' },
        { title: 'Qualified', value: qualifiedLeads, icon: CheckCircle2, color: 'text-[#D4FF00]', bg: 'bg-[#D4FF00]/10', border: 'border-[#D4FF00]/30' },
        { title: 'Conversion Rate', value: '12%', icon: LayoutDashboard, color: 'text-[#D4FF00]', bg: 'bg-[#D4FF00]/10', border: 'border-[#D4FF00]/30' }
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-4 md:p-6 lg:p-8 pb-20 lg:pb-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-serif italic text-3xl font-light text-[#f4f4f4] mb-1">Dashboard</h1>
                        <p className="text-neutral-400 text-sm">Welcome back, {user?.firstName || 'User'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="glass-button px-4 py-2 text-neutral-200 text-xs font-medium flex items-center gap-2">
                            <CalendarIcon size={14} />
                            Last 7 Days
                        </button>
                        <button className="bg-[#D4FF00] hover:bg-[#D4FF00]/80 text-black px-4 py-2 text-xs font-mono uppercase tracking-widest font-bold transition-all flex items-center gap-2">
                            <Plus size={14} />New Report
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.title} className="bg-[#0a0a0a]/80 border border-[#333] p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Icon size={60} className={stat.color} />
                                </div>
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className={cn("p-2.5", stat.bg)}>
                                        <Icon size={20} className={stat.color} />
                                    </div>
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", stat.bg, stat.border, stat.color)}>
                                        +12.5%
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-neutral-400 text-xs font-medium mb-0.5">{stat.title}</p>
                                    <p className="font-serif italic text-3xl font-light text-[#f4f4f4]">{stat.value}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Recent Activity & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart Area */}
                    <div className="lg:col-span-2 bg-[#0b0b0b]/90 border border-[#333] p-6 min-h-[350px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white">Lead Acquisition</h2>
                            <button className="text-[#D4FF00] text-xs font-medium hover:text-[#D4FF00]/80">View Details</button>
                        </div>
                        <div className="flex-1 flex items-end justify-between gap-2 px-4 pb-2 relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between px-4 pb-8 pointer-events-none">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-full h-px border-t border-dashed border-[#333]" />
                                ))}
                            </div>

                            {/* Bars */}
                            {[
                                { day: 'Mon', value: 4 },
                                { day: 'Tue', value: 7 },
                                { day: 'Wed', value: 5 },
                                { day: 'Thu', value: 9 },
                                { day: 'Fri', value: 6 },
                                { day: 'Sat', value: 3 },
                                { day: 'Sun', value: 8 }
                            ].map((item, index) => (
                                <div key={index} className="flex flex-col items-center gap-2 relative group w-full z-10">
                                    <div className="relative w-full max-w-[40px] h-48 flex items-end justify-center">
                                        <div
                                            className="w-full bg-gradient-to-t from-[#D4FF00]/80 to-[#D4FF00]/20 transition-all duration-500 cursor-pointer group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${(item.value / 10) * 100}%` }}
                                        >
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#0b0b0b]/90 text-white text-[10px] font-bold px-2 py-1 transition-opacity whitespace-nowrap border border-[#333] pointer-events-none">
                                                {item.value} Leads
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium text-neutral-500">{item.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity List */}
                    <div className="bg-[#0b0b0b]/90 border border-[#333] p-0 overflow-hidden flex flex-col h-full">
                        <div className="p-5 border-b border-[#333] flex justify-between items-center bg-[#0a0a0a]/80">
                            <h2 className="text-base font-bold text-white">Recent Activity</h2>
                            <Bell size={16} className="text-neutral-400" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {leads.slice(0, 5).map(lead => (
                                <div key={lead.id} className="p-3 hover:bg-[#0a0a0a]/80 transition-colors flex items-center gap-3 cursor-pointer group border border-transparent hover:border-[#333]">
                                    <div className="w-10 h-10 rounded-full bg-[#0a0a0a] flex items-center justify-center text-neutral-300 font-bold border border-[#333] group-hover:border-[#D4FF00]/50 group-hover:text-[#D4FF00] transition-all text-sm">
                                        {lead.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-neutral-200 text-sm font-semibold truncate group-hover:text-white transition-colors">{lead.name}</p>
                                        <p className="text-[10px] text-neutral-500 truncate">{lead.status} • {formatTime(lead.last_interaction)}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-neutral-600 group-hover:text-[#D4FF00] transition-colors opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Calendar View Component
const CalendarView = ({ currentTenant }) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // Mock events
    const events = [
        { id: 1, title: 'Viewing: Marina Penthouse', time: '10:00 AM', type: 'viewing', day: 15 },
        { id: 2, title: 'Call with Sarah Wilson', time: '02:30 PM', type: 'call', day: 15 },
        { id: 3, title: 'Contract Signing', time: '11:00 AM', type: 'meeting', day: 18 },
    ];

    // Render Google Calendar for supported tenants (State-aware integration)
    const calendarMap = {
        1: 'c_127da107820e1c9b01e31abba33f79a23b3471a8a364e1c09d1e0f5832c207b3%40group.calendar.google.com',
        2: 'c_052083b76b1f81bc97ceca6aa6e382ceee80e98d90fb38435e20ab8eb12fef9a%40group.calendar.google.com'
    };

    if (currentTenant?.id && calendarMap[currentTenant.id]) {
        return (
            <div className="flex-1 bg-[#0a0a0a] p-4 md:p-6 lg:p-8 flex flex-col h-full overflow-hidden pb-20 lg:pb-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#D4FF00]/10 flex items-center justify-center border border-[#D4FF00]/30">
                            <CalendarIcon size={24} className="text-[#D4FF00]" />
                        </div>
                        <div>
                            <h1 className="font-serif italic text-3xl font-light text-[#f4f4f4] mb-1">System Calendar</h1>
                            <p className="text-neutral-400 text-sm flex items-center gap-2 uppercase tracking-[0.1em] font-bold opacity-80">
                                <span className="w-2 h-2 rounded-full bg-[#D4FF00] animate-pulse" />
                                {currentTenant.name} Sync Active
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-[#0b0b0b]/90 border border-[#333] shadow-2xl overflow-hidden relative group">
                    <div className="w-full h-full relative z-10 bg-[#0a0a0a] p-1">
                        <iframe 
                            src={`https://calendar.google.com/calendar/embed?src=${calendarMap[currentTenant.id]}&ctz=Asia%2FDubai&mode=WEEK&showTabs=1&showPrint=0&showCalendars=0&showTz=0`} 
                            style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) brightness(0.8) contrast(1.2)' }} 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-[#0a0a0a] p-4 md:p-6 lg:p-8 flex flex-col h-full overflow-hidden pb-20 lg:pb-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-serif italic text-3xl font-light text-[#f4f4f4] mb-1">Calendar</h1>
                    <p className="text-neutral-400 text-sm">{currentMonth} {currentYear}</p>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button p-2 text-neutral-400 hover:text-white">
                        <ChevronLeft size={16} />
                    </button>
                    <button className="glass-button p-2 text-neutral-400 hover:text-white">
                        <ChevronRightIcon size={16} />
                    </button>
                    <button className="bg-[#D4FF00] hover:bg-[#D4FF00]/80 text-black px-4 py-2 text-xs font-mono uppercase tracking-widest font-bold ml-2 flex items-center gap-2">
                        <Plus size={14} />
                        Add Event
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                {/* Calendar Grid */}
                <div className="flex-1 bg-[#0b0b0b]/90 border border-[#333] p-4 md:p-6 flex flex-col">
                    <div className="grid grid-cols-7 mb-4">
                        {days.map(day => (
                            <div key={day} className="text-center text-neutral-500 text-xs font-bold uppercase tracking-wider py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1 md:gap-2">
                        {Array.from({ length: 35 }).map((_, i) => {
                            const dayNum = i - 2; // Offset for demo
                            const isToday = dayNum === currentDate.getDate();
                            const dayEvents = events.filter(e => e.day === dayNum);

                            return (
                                <div key={i} className={cn(
                                    "border border-[#333] p-1 md:p-2 relative transition-all hover:bg-[#0a0a0a]/80 flex flex-col gap-1",
                                    dayNum > 0 && dayNum <= 31 ? "bg-transparent" : "bg-[#0a0a0a]/50 opacity-50"
                                )}>
                                    {dayNum > 0 && dayNum <= 31 && (
                                        <>
                                            <span className={cn(
                                                "text-xs font-medium w-6 h-6 flex items-center justify-center",
                                                isToday ? "bg-[#D4FF00] text-black font-bold" : "text-neutral-400"
                                            )}>
                                                {dayNum}
                                            </span>
                                            {dayEvents.map(event => (
                                                <div key={event.id} className={cn(
                                                    "text-[9px] px-1.5 py-1 truncate font-medium",
                                                    event.type === 'viewing' ? "bg-[#D4FF00]/10 text-[#D4FF00]" :
                                                        event.type === 'call' ? "bg-[#D4FF00]/10 text-[#D4FF00]" :
                                                            "bg-[#D4FF00]/10 text-[#D4FF00]"
                                                )}>
                                                    {event.time} - {event.title}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Upcoming Events Sidebar */}
                <div className="w-full lg:w-80 bg-[#0b0b0b]/90 border border-[#333] p-6 flex flex-col">
                    <h3 className="font-serif italic text-lg font-light text-[#f4f4f4] mb-4">Upcoming</h3>
                    <div className="space-y-3 overflow-y-auto">
                        {events.map(event => (
                            <div key={event.id} className="p-3 bg-[#0a0a0a]/80 border border-[#333] hover:border-[#D4FF00]/30 transition-colors group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn(
                                        "w-8 h-8 flex items-center justify-center",
                                        event.type === 'viewing' ? "bg-[#D4FF00]/10 text-[#D4FF00]" :
                                            event.type === 'call' ? "bg-[#D4FF00]/10 text-[#D4FF00]" :
                                                "bg-[#D4FF00]/10 text-[#D4FF00]"
                                    )}>
                                        {event.type === 'viewing' ? <Home size={14} /> : event.type === 'call' ? <Phone size={14} /> : <Users size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">{event.title}</p>
                                        <p className="text-[10px] text-neutral-400">{event.time}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Lead List Component (Existing)
const LeadList = ({ leads, selectedId, onSelect, filter, setFilter }) => {
    const filteredLeads = filter === 'All' ? leads : leads.filter(l => l.status === filter);

    return (
        <div className="w-full lg:w-80 flex-shrink-0 bg-[#0a0a0a] border-r border-[#333] flex flex-col h-full relative z-10">
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-5 border-b border-[#333]">
                <div>
                    <h2 className="font-serif italic text-xl font-light text-[#f4f4f4]">Leads</h2>
                    <p className="text-[10px] text-neutral-500 font-medium mt-0.5">{filteredLeads.length} Active Leads</p>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button p-2 text-neutral-400 hover:text-white">
                        <Filter size={16} />
                    </button>
                    <button className="bg-[#D4FF00] hover:bg-[#D4FF00]/80 p-2 text-black transition-all">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Search & Filter Tabs */}
            <div className="p-5 pb-2 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 group-focus-within:text-[#D4FF00] transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search leads..."
                        className="w-full bg-[#0a0a0a]/80 text-white pl-10 pr-3 py-2.5 border border-[#333] focus:border-[#D4FF00]/50 focus:ring-2 focus:ring-[#D4FF00]/20 focus:outline-none text-xs transition-all placeholder-neutral-600"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['All', 'New', 'Qualified', 'Closed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={cn(
                                "px-3 py-1.5 text-[10px] font-bold whitespace-nowrap transition-all border font-mono uppercase tracking-wider",
                                filter === status
                                    ? "bg-[#D4FF00] border-[#D4FF00] text-black"
                                    : "bg-transparent border-[#333] text-neutral-400 hover:border-[#D4FF00] hover:text-[#D4FF00]"
                            )}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2.5">
                {filteredLeads.map(lead => (
                    <div
                        key={lead.id}
                        onClick={() => onSelect(lead)}
                        className={cn(
                            "p-4 cursor-pointer transition-all relative overflow-hidden group border",
                            selectedId === lead.id
                                ? "bg-[#0b0b0b]/90 border-[#D4FF00]/30"
                                : "bg-[#0a0a0a]/80 border-[#333] hover:border-[#D4FF00]/30"
                        )}
                    >
                        {selectedId === lead.id && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#D4FF00]" />}

                        <div className="flex justify-between items-start mb-1.5">
                            <h4 className={cn("font-bold text-sm", selectedId === lead.id ? "text-white" : "text-neutral-200 group-hover:text-white")}>
                                {lead.name}
                            </h4>
                            <span className="text-[9px] text-neutral-500 font-medium bg-[#0a0a0a] px-1.5 py-0.5 border border-[#333]">
                                {formatTime(lead.history?.[lead.history?.length - 1]?.timestamp || lead.created_at)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            {lead.budget && (
                                <span className="text-[10px] text-[#D4FF00] font-medium flex items-center gap-0.5">
                                    <DollarSign size={10} />
                                    {!isNaN(parseFloat(lead.budget)) && isFinite(lead.budget) ? formatCurrency(lead.budget) : lead.budget}
                                </span>
                            )}
                            {lead.propertyType && (
                                <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                                    <Home size={10} />
                                    {lead.propertyType}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mb-2 leading-relaxed">
                            {lead.history?.[lead.history?.length - 1]?.content || "No messages yet"}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border font-mono",
                                lead.status === 'New' ? "bg-[#D4FF00]/10 text-[#D4FF00] border-[#D4FF00]/30" :
                                    lead.status === 'Qualified' ? "bg-[#D4FF00]/10 text-[#D4FF00] border-[#D4FF00]/30" :
                                        "bg-[#0a0a0a]/80 text-neutral-400 border-[#333]"
                            )}>
                                {lead.status}
                            </span>
                            {lead.priority === 'High' && (
                                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border font-mono bg-[#D4FF00]/10 text-[#D4FF00] border-[#D4FF00]/30">
                                    High Priority
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Lead Detail Component (Refactored for Timeline/HubSpot style)
const LeadDetail = ({ lead, onSendMessage }) => {
    const [activeTab, setActiveTab] = useState('Activity');
    const [noteContent, setNoteContent] = useState('');
    const scrollRef = useRef(null);

    if (!lead) {
        return (
            <div className="flex-1 bg-[#0a0a0a] flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
                <div className="w-20 h-20 bg-[#0b0b0b]/90 border border-[#333] flex items-center justify-center mb-6 relative z-10">
                    <Users size={40} className="text-neutral-600" />
                </div>
                <h3 className="font-serif italic text-xl font-light text-[#f4f4f4] mb-2 relative z-10">Select a Lead</h3>
                <p className="text-neutral-500 max-w-xs text-sm relative z-10">Choose a lead from the list to view their details and timeline.</p>
            </div>
        );
    }

    const tabs = [
        { id: 'Activity', icon: ListTodo },
        { id: 'Notes', icon: FileText },
        { id: 'Emails', icon: Mail },
        { id: 'Calls', icon: Phone },
        { id: 'Tasks', icon: CheckCircle2 },
        { id: 'Meetings', icon: Video },
    ];

    const getIconForType = (type) => {
        switch (type.toLowerCase()) {
            case 'note': return FileText;
            case 'email': return Mail;
            case 'call': return Phone;
            case 'voice_transcript': return Phone;
            case 'task': return CheckCircle2;
            case 'meeting': return Video;
            case 'lifecycle': return Tag;
            default: return MessageSquare;
        }
    };

    const getColorForType = (type) => {
        switch (type.toLowerCase()) {
            case 'note': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'email': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'call': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'voice_transcript': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'task': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'meeting': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            case 'lifecycle': return 'text-[#D4FF00] bg-[#D4FF00]/10 border-[#D4FF00]/30';
            default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
        }
    };

    const filteredHistory = activeTab === 'Activity'
        ? lead.history
        : lead.history.filter(h => h.type.toLowerCase() === activeTab.toLowerCase().slice(0, -1)); // Simple plural to singular conversion

    return (
        <div className="flex-1 flex flex-col bg-[#0a0a0a] h-full overflow-hidden relative">
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-4 lg:px-6 glass-header z-20">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 flex items-center justify-center text-white font-bold text-lg bg-[#D4FF00]/10 border border-[#D4FF00]/30 shrink-0">
                        {lead.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-serif italic text-xl font-light text-[#f4f4f4] leading-tight mb-0.5 truncate">{lead.name}</h2>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
                            <div className="flex items-center gap-1 bg-[#0a0a0a]/80 px-1.5 py-0.5 border border-[#333]">
                                <MapPin size={10} />
                                <span>{lead.location || 'Dubai, UAE'}</span>
                            </div>
                            <span className={cn(
                                "font-bold px-1.5 py-0.5 border font-mono text-[10px]",
                                lead.status === 'New' ? "text-[#D4FF00] border-[#D4FF00]/30 bg-[#D4FF00]/10" :
                                    lead.status === 'Qualified' ? "text-[#D4FF00] border-[#D4FF00]/30 bg-[#D4FF00]/10" : "text-neutral-400 border-[#333] bg-[#0a0a0a]/80"
                            )}>{lead.status}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button className="glass-button p-2.5 text-neutral-400 hover:text-white">
                        <Phone size={18} />
                    </button>
                    <button className="glass-button p-2.5 text-neutral-400 hover:text-white">
                        <Mail size={18} />
                    </button>
                    <button className="glass-button p-2.5 text-neutral-400 hover:text-white">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* Lead Info Grid (Compact) */}
            <div className="px-4 lg:px-6 py-4 z-10 border-b border-[#333] bg-[#0a0a0a]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                            <DollarSign size={10} /> Budget
                        </p>
                        <p className="text-sm font-bold text-white">
                            {lead.budget ? (
                                !isNaN(parseFloat(lead.budget)) && isFinite(lead.budget) ? formatCurrency(lead.budget) : lead.budget
                            ) : 'Not set'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                            <Home size={10} /> Property
                        </p>
                        <p className="text-sm font-bold text-white">{lead.propertyType || 'Any'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                            <Briefcase size={10} /> Purpose
                        </p>
                        <p className="text-sm font-bold text-white">{lead.purpose || 'Investment'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                            <Tag size={10} /> Source
                        </p>
                        <p className="text-sm font-bold text-white">{lead.source || 'Website'}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 lg:px-6 pt-4 border-b border-[#333] bg-[#0a0a0a]">
                <div className="flex gap-4 lg:gap-6 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "text-[#D4FF00] border-[#D4FF00]"
                                        : "text-neutral-500 border-transparent hover:text-neutral-300"
                                )}
                            >
                                <Icon size={14} />
                                {tab.id}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area: Input + Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
                {/* Input Area Removed as per user request */}

                {/* Timeline */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                    {filteredHistory && filteredHistory.length > 0 ? (
                        filteredHistory.slice().reverse().map((event, idx) => { // Reverse to show newest first
                            const Icon = getIconForType(event.type);
                            const colorClass = getColorForType(event.type);

                            return (
                                <div key={idx} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                        <div className={cn("w-8 h-8 flex items-center justify-center border", colorClass)}>
                                            <Icon size={14} />
                                        </div>
                                        {idx !== filteredHistory.length - 1 && <div className="w-px h-full bg-[#333] my-1" />}
                                    </div>
                                    <div className="flex-1 pb-4 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-neutral-200">
                                                    {event.type === 'Voice_Transcript' ? (event.sender === 'Lead' ? 'Voice Call from Lead' : 'Morgan (Voice Call)') : event.type === 'Message' || event.type === 'Voice' || event.type === 'Image' ? `Message from ${event.sender}` : `${event.type} logged`}
                                                </span>
                                                <span className="text-[10px] text-neutral-500 font-mono">• {formatTime(event.timestamp)}</span>
                                            </div>
                                            <button className="text-neutral-600 hover:text-[#D4FF00] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </div>
                                        <div className="bg-[#0b0b0b]/90 border border-[#333] p-3 text-sm text-neutral-300 leading-relaxed">
                                            {event.content}

                                            {/* Render Audio for Voice Messages */}
                                            {event.type === 'Voice' && event.meta && (
                                                <div className="mt-3 bg-[#0a0a0a] p-2 border border-[#333]">
                                                    <audio controls src={event.meta} className="w-full h-8" />
                                                </div>
                                            )}

                                            {/* Render Image for Image Messages */}
                                            {event.type === 'Image' && event.meta && (
                                                <div className="mt-3">
                                                    <img
                                                        src={event.meta}
                                                        alt="Shared Media"
                                                        className="max-w-xs border border-[#333] hover:opacity-90 transition-opacity cursor-pointer"
                                                        onClick={() => window.open(event.meta, '_blank')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {event.meta && event.type !== 'Voice' && event.type !== 'Image' && (
                                            <div className="mt-2 flex gap-2">
                                                <span className="text-[10px] font-medium text-neutral-500 bg-[#0a0a0a]/80 px-2 py-1 border border-[#333]">
                                                    {event.meta}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                            <ListTodo size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">No activities found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Messages View Component (Inbox Style) - Kept separate as requested
const MessagesView = ({ leads, selectedId, onSelect, onSendMessage, onBack }) => {
    // Filter leads to only those with history
    const activeConversations = leads.filter(l => l.history && l.history.length > 0);
    const selectedLead = leads.find(l => l.id === selectedId) || activeConversations[0];

    // Simple Chat Interface for Messages View
    const SimpleChat = ({ lead, onSendMessage, onBack }) => {
        const [msg, setMsg] = useState('');
        if (!lead) return <div className="flex-1 flex items-center justify-center text-slate-500">Select a conversation</div>;

        return (
            <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
                <div className="h-16 border-b border-[#333] flex items-center gap-3 px-4 lg:px-6">
                    {onBack && (
                        <button onClick={onBack} className="lg:hidden p-1 text-neutral-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <h3 className="font-bold text-white">{lead.name}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {lead.history.filter(h => h.type === 'Message').map((m, i) => (
                        <div key={i} className={cn("flex w-full", m.sender === 'User' ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[70%] px-4 py-2 text-sm",
                                m.sender === 'User' ? "bg-[#D4FF00] text-black" : "glass-panel text-neutral-200"
                            )}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-[#333]">
                    <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { onSendMessage(msg, 'Message'); setMsg(''); } }} className="flex gap-2">
                        <input
                            value={msg}
                            onChange={e => setMsg(e.target.value)}
                            className="flex-1 bg-[#1a202c] px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#D4FF00]"
                            placeholder="Type a message..."
                        />
                        <button type="submit" className="bg-[#D4FF00] p-2 text-black"><Send size={18} /></button>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-1 w-full overflow-hidden bg-[#0a0a0a] flex-col lg:flex-row pb-20 lg:pb-8">
            {/* Inbox List */}
            <div className={cn(
                'flex-shrink-0 flex-col h-full relative z-10 border-r border-[#333]',
                selectedId ? 'hidden lg:flex' : 'flex',
                'w-full lg:w-80'
            )}>
                <div className="h-20 flex items-center justify-between px-5 border-b border-[#333]">
                    <h2 className="text-xl font-bold text-white tracking-tight">Inbox</h2>
                    <button className="glass-button p-2 text-neutral-400 hover:text-white">
                        <Plus size={16} />
                    </button>
                </div>
                <div className="p-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 group-focus-within:text-[#D4FF00] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full bg-[#1a202c] text-white pl-10 pr-3 py-2.5 border border-[#333] focus:border-[#D4FF00]/50 focus:ring-2 focus:ring-[#D4FF00]/20 focus:outline-none text-xs transition-all placeholder-neutral-600 shadow-inner"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                    {activeConversations.map(lead => (
                        <div
                            key={lead.id}
                            onClick={() => onSelect(lead)}
                            className={cn(
                                "p-3 cursor-pointer transition-all relative overflow-hidden group border flex gap-3",
                                selectedLead?.id === lead.id
                                    ? "bg-[#D4FF00]/10 border-[#D4FF00]/30"
                                    : "hover:bg-white/5 border-transparent hover:border-[#333]"
                            )}
                        >
                            <div className="w-10 h-10 bg-[#0a0a0a] border border-[#333] flex items-center justify-center text-neutral-300 font-bold text-xs flex-shrink-0">
                                {lead.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="font-bold text-sm text-neutral-200 truncate">{lead.name}</h4>
                                    <span className="text-[9px] text-neutral-500">{formatTime(lead.history[lead.history.length - 1].timestamp)}</span>
                                </div>
                                <p className="text-[11px] text-neutral-400 truncate">
                                    {lead.history[lead.history.length - 1].content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
                'flex-1 flex flex-col',
                !selectedId ? 'hidden lg:flex' : 'flex'
            )}>
                <SimpleChat lead={selectedLead} onSendMessage={onSendMessage} onBack={onBack} />
            </div>
        </div>
    );
};

// Main CRM App
function CRMApp() {
    const { user, isLoaded: isUserLoaded } = useUser();
    const [activeView, setActiveView] = useState('dashboard');
    const [leads, setLeads] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [filter, setFilter] = useState('All');
    const [currentTenant, setCurrentTenant] = useState(null);
    const [isLoadingTenant, setIsLoadingTenant] = useState(true);
    const [allTenants, setAllTenants] = useState([]);

    const selectedLead = leads.find(l => l.id === selectedLeadId);

    const [error, setError] = useState(null);

    // Resolve user profile and tenant on login
    useEffect(() => {
        const resolveUserTenant = async () => {
            if (!isUserLoaded || !user) return;

            setIsLoadingTenant(true);
            try {
                console.log(`[Dashboard] Resolving tenant for user: ${user.id}`);

                // Check if profile exists
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*, tenants(*)')
                    .eq('user_id', user.id)
                    .single();

                if (profile && profile.tenants) {
                    console.log(`[Dashboard] Found profile, tenant: ${profile.tenants.name}`);
                    setCurrentTenant(profile.tenants);
                } else {
                    // No profile - create one linked to default tenant (Provident)
                    console.log('[Dashboard] No profile found, creating with default tenant...');

                    const { data: defaultTenant } = await supabase
                        .from('tenants')
                        .select('*')
                        .eq('id', 1) // Provident is ID 1
                        .single();

                    if (defaultTenant) {
                        // Create profile
                        await supabase.from('profiles').insert({
                            user_id: user.id,
                            tenant_id: defaultTenant.id,
                            role: 'admin'
                        });
                        setCurrentTenant(defaultTenant);
                    } else {
                        // Absolute fallback
                        setCurrentTenant({
                            id: 1,
                            name: 'Provident Estate',
                            rag_client_id: 'demo'
                        });
                    }
                }

                // Fetch all tenants for superadmins / onboarding ease
                const { data: tenantsData } = await supabase
                    .from('tenants')
                    .select('*')
                    .order('name', { ascending: true });

                if (tenantsData) {
                    setAllTenants(tenantsData);
                }
            } catch (err) {
                console.error('[Dashboard] Tenant resolution error:', err);
                // Fallback
                setCurrentTenant({
                    id: 1,
                    name: 'Provident Estate',
                    rag_client_id: 'demo'
                });
            } finally {
                setIsLoadingTenant(false);
            }
        };

        resolveUserTenant();
    }, [user, isUserLoaded]);

    // Fetch data & realtime - now filtered by currentTenant
    useEffect(() => {
        if (!currentTenant) return; // Wait for tenant resolution

        const fetchData = async () => {
            setError(null);
            try {
                console.log(`[Dashboard] Fetching data for tenant: ${currentTenant.name} (ID: ${currentTenant.id})`);

                // Filter leads by tenant_id
                const { data: leadsData, error: leadsError } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('tenant_id', currentTenant.id)
                    .order('last_interaction', { ascending: false });

                if (leadsError) throw new Error(`Leads fetch error: ${leadsError.message}`);

                const { data: messagesData, error: messagesError } = await supabase
                    .from('messages')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (messagesError) throw new Error(`Messages fetch error: ${messagesError.message}`);

                const mergedLeads = leadsData.map(lead => ({
                    ...lead,
                    propertyType: lead.property_type, // Map DB snake_case to Frontend camelCase
                    history: messagesData
                        .filter(m => m.lead_id === lead.id)
                        .map(m => ({
                            type: m.type,
                            sender: m.sender,
                            content: m.content,
                            timestamp: m.created_at,
                            meta: m.meta || null
                        }))
                }));

                console.log(`[Dashboard] Fetched ${mergedLeads.length} leads for tenant ${currentTenant.id}`);
                setLeads(mergedLeads);
            } catch (error) {
                console.error("Error fetching data:", error);
                setError(error.message);
            }
        };

        // Mock Data for Demo/Fallback with ENRICHED TIMELINE TYPES
        const mockLeads = [
            {
                id: '1',
                name: 'Sarah Wilson',
                phone: '+971 50 123 4567',
                email: 'sarah.w@example.com',
                status: 'New',
                budget: 2500000,
                propertyType: 'Apartment',
                purpose: 'Live-in',
                location: 'Downtown Dubai',
                source: 'Instagram',
                priority: 'High',
                created_at: new Date().toISOString(),
                last_interaction: new Date().toISOString(),
                history: [
                    { type: 'Note', sender: 'User', content: 'Client prefers high floor units with Burj Khalifa view.', timestamp: new Date(Date.now() - 1000000).toISOString() },
                    { type: 'Call', sender: 'User', content: 'Introductory call. Discussed budget and requirements.', timestamp: new Date(Date.now() - 86400000).toISOString(), meta: 'Duration: 15m' },
                    { type: 'Email', sender: 'User', content: 'Sent brochure for Downtown Views II.', timestamp: new Date(Date.now() - 90000000).toISOString() },
                    { type: 'Lifecycle', sender: 'System', content: 'Lifecycle stage changed to Lead', timestamp: new Date(Date.now() - 100000000).toISOString() },
                    { type: 'Message', sender: 'Sarah Wilson', content: 'Hi, thanks for the brochure. Looks great.', timestamp: new Date(Date.now() - 80000000).toISOString() }
                ]
            },
            {
                id: '2',
                name: 'Mohammed Al-Fayed',
                phone: '+971 55 987 6543',
                email: 'm.alfayed@example.com',
                status: 'Qualified',
                budget: 15000000,
                propertyType: 'Villa',
                purpose: 'Investment',
                location: 'Palm Jumeirah',
                source: 'Referral',
                priority: 'High',
                created_at: new Date(Date.now() - 172800000).toISOString(),
                last_interaction: new Date(Date.now() - 170000000).toISOString(),
                history: [
                    { type: 'Task', sender: 'User', content: 'Prepare ROI analysis for Palm Villas', timestamp: new Date(Date.now() - 100000).toISOString(), meta: 'Due: Tomorrow' },
                    { type: 'Meeting', sender: 'User', content: 'Coffee meeting at The Palm', timestamp: new Date(Date.now() - 172000000).toISOString(), meta: 'Scheduled' },
                    { type: 'Message', sender: 'Mohammed Al-Fayed', content: 'Looking forward to the meeting.', timestamp: new Date(Date.now() - 171000000).toISOString() }
                ]
            },
            {
                id: '3',
                name: 'Elena Petrova',
                phone: '+971 52 456 7890',
                email: 'elena.p@example.com',
                status: 'Closed',
                budget: 5000000,
                propertyType: 'Penthouse',
                purpose: 'Holiday Home',
                location: 'Dubai Marina',
                source: 'Website',
                priority: 'Medium',
                created_at: new Date(Date.now() - 432000000).toISOString(),
                last_interaction: new Date(Date.now() - 400000000).toISOString(),
                history: [
                    { type: 'Lifecycle', sender: 'System', content: 'Deal Closed - Marina Penthouse', timestamp: new Date(Date.now() - 400000000).toISOString() },
                    { type: 'Note', sender: 'User', content: 'Client signed the SPA. Commission received.', timestamp: new Date(Date.now() - 390000000).toISOString() }
                ]
            }
        ];

        setLeads(mockLeads);
        fetchData();

        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchData())
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentTenant]);

    const handleSendMessage = async (content, type = 'Message') => {
        if (!selectedLeadId) return;

        const newMessage = {
            timestamp: new Date().toISOString(),
            type: type,
            sender: 'User',
            content,
            meta: type === 'Call' ? 'Logged manually' : null
        };

        // Optimistic update
        setLeads(prev => prev.map(l => {
            if (l.id === selectedLeadId) {
                return { ...l, history: [...(l.history || []), newMessage] };
            }
            return l;
        }));

        try {
            await supabase.from('messages').insert({
                lead_id: selectedLeadId,
                type: type,
                sender: 'User',
                content: content
            });

            await supabase.from('leads').update({
                last_interaction: new Date().toISOString()
            }).eq('id', selectedLeadId);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <Dashboard leads={leads} />;
            case 'calendar':
                return <CalendarView currentTenant={currentTenant} />;
            case 'agent-folders':
                return <AgentFolders currentTenant={currentTenant} />;
            case 'tenant-admin':
                return <TenantAdmin currentTenant={currentTenant} />;
            case 'messages':
                return (
                    <MessagesView
                        leads={leads}
                        selectedId={selectedLeadId}
                        onSelect={(lead) => setSelectedLeadId(lead.id)}
                        onSendMessage={handleSendMessage}
                        onBack={() => setSelectedLeadId(null)}
                    />
                );
            case 'subscribers':
                return <SubscribersList />;
            case 'knowledge':
                return <KnowledgeBaseAdmin tenantId={currentTenant?.id} />;
            case 'leads':
            default:
                return (
                    <div className="flex flex-1 w-full overflow-hidden flex-col lg:flex-row pb-20 lg:pb-8">
                        <div className={cn(
                            'w-full lg:w-80 flex-shrink-0 flex-col',
                            selectedLeadId ? 'hidden lg:flex' : 'flex'
                        )}>
                            <LeadList
                                leads={leads}
                                selectedId={selectedLeadId}
                                onSelect={(lead) => setSelectedLeadId(lead.id)}
                                filter={filter}
                                setFilter={setFilter}
                            />
                        </div>
                        <div className={cn(
                            'flex-1 flex flex-col min-w-0',
                            !selectedLeadId ? 'hidden lg:flex' : 'flex'
                        )}>
                            {selectedLead && (
                                <button
                                    onClick={() => setSelectedLeadId(null)}
                                    className="lg:hidden flex items-center gap-2 px-4 py-3 text-neutral-400 hover:text-white border-b border-[#333] bg-[#0a0a0a]/90 z-10"
                                >
                                    <ChevronLeft size={18} />
                                    <span className="text-xs font-semibold">Back to Leads</span>
                                </button>
                            )}
                            <LeadDetail lead={selectedLead} onSendMessage={handleSendMessage} />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-dvh w-full bg-[#0a0a0a] text-neutral-200 font-sans overflow-hidden selection:bg-[#D4FF00]/30 relative">
            {error && (
                <div className="absolute top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 shadow-2xl flex items-center gap-3 backdrop-blur-md border border-[#333] max-w-md animate-in slide-in-from-top-5 fade-in duration-300">
                    <XCircle size={20} className="flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="font-bold text-sm">Connection Error</h4>
                        <p className="text-xs opacity-90">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 transition-colors">
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
                currentTenant={currentTenant}
                allTenants={allTenants}
                onTenantChange={setCurrentTenant}
            />
            {renderView()}
            <BottomNav activeView={activeView} setActiveView={setActiveView} />
        </div>
    );
}

// Error Boundary
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
                    <div className="max-w-md glass-panel p-8 border border-red-900/50 shadow-2xl text-center">
                        <XCircle className="text-red-500 mx-auto mb-4" size={48} />
                        <h2 className="text-xl font-bold text-white mb-2">Application Error</h2>
                        <p className="text-neutral-400 text-sm mb-6">{this.state.error?.message || "Something went wrong"}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-[#2d3748] hover:bg-slate-700 text-white transition-colors font-medium"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Main App
export default function DashboardApp() {
    const isInvalidKey = !CLERK_PUBLISHABLE_KEY || CLERK_PUBLISHABLE_KEY.includes('PLACEHOLDER');

    if (isInvalidKey) {
        return (
            <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="max-w-md glass-panel p-8 border border-red-900/50 shadow-2xl text-center">
                    <XCircle className="text-red-500 mx-auto mb-4" size={48} />
                    <h2 className="text-xl font-bold text-white mb-2">Configuration Error</h2>
                    <p className="text-slate-400 mb-4 text-sm">Missing Clerk Publishable Key</p>
                    <code className="block bg-[#0a0a0a] p-3 text-xs text-[#D4FF00] font-mono border border-[#333]">
                        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
                    </code>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
                <>
                    <SignedOut>
                        <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#D4FF00]/10 via-[#0a0a0a] to-[#0a0a0a]" />
                            <div className="w-full max-w-md glass-panel p-10 border border-[#333] shadow-2xl relative z-10">
                                <div className="flex items-center justify-center mx-auto mb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#D4FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="m14.31 8 5.74 9.94" />
                                        <path d="M9.69 8h11.48" />
                                        <path d="m7.38 12 5.74-9.94" />
                                        <path d="M9.69 16 3.95 6.06" />
                                        <path d="M14.31 16H2.83" />
                                        <path d="m16.62 12-5.74 9.94" />
                                    </svg>
                                </div>
                                <h2 className="font-serif italic text-3xl font-light text-white text-center mb-2">Welcome to AURO</h2>
                                <p className="text-neutral-400 text-center mb-8">Sign in to access your dashboard.</p>
                                <SignIn
                                    forceRedirectUrl="/dashboard"
                                    appearance={{
                                        elements: {
                                            rootBox: "w-full",
                                            card: "bg-transparent shadow-none p-0",
                                            headerTitle: "hidden",
                                            headerSubtitle: "hidden",
                                            formButtonPrimary: "bg-[#D4FF00] hover:bg-[#c4e600] text-black normal-case text-sm h-12 shadow-lg shadow-[#D4FF00]/20",
                                            formFieldInput: "bg-[#0a0a0a] border-[#333] text-white focus:border-[#D4FF00] transition-colors h-12",
                                            formFieldLabel: "text-neutral-400",
                                            footerActionLink: "text-[#D4FF00] hover:text-[#c4e600]"
                                        }
                                    }} />
                            </div>
                        </div>
                    </SignedOut>
                    <SignedIn>
                        <CRMApp />
                    </SignedIn>
                </>
            </ClerkProvider>
        </ErrorBoundary>
    );
}
