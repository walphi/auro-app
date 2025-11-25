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
    FileText,
    ListTodo,
    Video,
    MoreHorizontal,
    Paperclip,
    Folder
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton, useUser } from '@clerk/clerk-react';
import AgentFolders from './components/AgentFolders';

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

// Sidebar Component
const Sidebar = ({ activeView, setActiveView }) => {
    const { user } = useUser();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
        { icon: Users, label: 'Leads', view: 'leads' },
        { icon: MessageSquare, label: 'Messages', view: 'messages' },
        { icon: CalendarIcon, label: 'Calendar', view: 'calendar' },
        { icon: Folder, label: 'Agent Folders', view: 'agent-folders' }
    ];

    return (
        <div className="w-64 flex-shrink-0 bg-[#0d111c] border-r border-white/5 flex flex-col h-screen relative z-20">
            {/* Logo */}
            <div className="h-20 flex items-center px-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <span className="text-white font-bold text-lg">A</span>
                    </div>
                    <span className="text-xl font-bold gradient-text tracking-tight">AURO.ai</span>
                </div>
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
                                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden border",
                                isActive
                                    ? "bg-white/10 border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-md"
                                    : "bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:border-white/5 hover:text-slate-200 hover:shadow-lg hover:shadow-black/20"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-xl transition-all duration-300",
                                isActive ? "bg-indigo-500/20 text-indigo-300 shadow-inner shadow-indigo-500/20" : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-slate-300"
                            )}>
                                <Icon size={18} className="relative z-10" />
                            </div>
                            <span className={cn("font-semibold text-sm tracking-wide relative z-10", isActive ? "text-white" : "")}>{item.label}</span>

                            {/* Glass Reflection Effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </button>
                    );
                })}
            </nav>

            {/* User Profile */}
            <div className="p-4 mt-auto">
                <div className="glass-panel p-3 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold ring-2 ring-white/10 group-hover:ring-indigo-500/50 transition-all">
                        {user?.imageUrl ? (
                            <img src={user.imageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User size={14} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || 'User'}</p>
                        <p className="text-[10px] text-slate-500 truncate">View Profile</p>
                    </div>
                    <Settings size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="mt-2 flex justify-center scale-90 origin-bottom">
                    <UserButton afterSignOutUrl="/" />
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
        { title: 'Total Leads', value: totalLeads, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
        { title: 'New Inquiries', value: newLeads, icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20' },
        { title: 'Qualified', value: qualifiedLeads, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
        { title: 'Conversion Rate', value: '12%', icon: LayoutDashboard, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' }
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-[#0d111c] p-6 lg:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Dashboard</h1>
                        <p className="text-slate-400 text-sm">Welcome back, {user?.firstName || 'User'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="glass-button px-4 py-2 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-2">
                            <CalendarIcon size={14} />
                            Last 7 Days
                        </button>
                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2">
                            <Plus size={14} />
                            New Report
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.title} className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Icon size={60} className={stat.color} />
                                </div>
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                                        <Icon size={20} className={stat.color} />
                                    </div>
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", stat.bg, stat.border, stat.color)}>
                                        +12.5%
                                    </span>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 text-xs font-medium mb-0.5">{stat.title}</p>
                                    <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Recent Activity & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart Area */}
                    <div className="lg:col-span-2 glass-panel rounded-2xl p-6 min-h-[350px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white">Lead Acquisition</h2>
                            <button className="text-indigo-400 text-xs font-medium hover:text-indigo-300">View Details</button>
                        </div>
                        <div className="flex-1 flex items-end justify-between gap-2 px-4 pb-2 relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between px-4 pb-8 pointer-events-none">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-full h-px bg-white/5 border-t border-dashed border-white/5" />
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
                                            className="w-full bg-gradient-to-t from-indigo-600/80 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-indigo-500 hover:to-indigo-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] cursor-pointer group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${(item.value / 10) * 100}%` }}
                                        >
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                                                {item.value} Leads
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">{item.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity List */}
                    <div className="glass-panel rounded-2xl p-0 overflow-hidden flex flex-col h-full">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h2 className="text-base font-bold text-white">Recent Activity</h2>
                            <Bell size={16} className="text-slate-400" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {leads.slice(0, 5).map(lead => (
                                <div key={lead.id} className="p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center gap-3 cursor-pointer group border border-transparent hover:border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-[#0d111c] flex items-center justify-center text-slate-300 font-bold border border-white/10 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-all shadow-sm text-sm">
                                        {lead.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-200 text-sm font-semibold truncate group-hover:text-white transition-colors">{lead.name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{lead.status} • {formatTime(lead.last_interaction)}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1" />
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
const CalendarView = () => {
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

    return (
        <div className="flex-1 bg-[#0d111c] p-6 lg:p-8 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Calendar</h1>
                    <p className="text-slate-400 text-sm">{currentMonth} {currentYear}</p>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button p-2 rounded-lg text-slate-400 hover:text-white">
                        <ChevronLeft size={16} />
                    </button>
                    <button className="glass-button p-2 rounded-lg text-slate-400 hover:text-white">
                        <ChevronRightIcon size={16} />
                    </button>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 ml-2 flex items-center gap-2">
                        <Plus size={14} />
                        Add Event
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Calendar Grid */}
                <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col">
                    <div className="grid grid-cols-7 mb-4">
                        {days.map(day => (
                            <div key={day} className="text-center text-slate-500 text-xs font-bold uppercase tracking-wider py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2">
                        {Array.from({ length: 35 }).map((_, i) => {
                            const dayNum = i - 2; // Offset for demo
                            const isToday = dayNum === currentDate.getDate();
                            const dayEvents = events.filter(e => e.day === dayNum);

                            return (
                                <div key={i} className={cn(
                                    "rounded-xl border border-white/5 p-2 relative transition-all hover:bg-white/5 flex flex-col gap-1",
                                    dayNum > 0 && dayNum <= 31 ? "bg-transparent" : "bg-white/[0.02] opacity-50"
                                )}>
                                    {dayNum > 0 && dayNum <= 31 && (
                                        <>
                                            <span className={cn(
                                                "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                                isToday ? "bg-indigo-600 text-white" : "text-slate-400"
                                            )}>
                                                {dayNum}
                                            </span>
                                            {dayEvents.map(event => (
                                                <div key={event.id} className={cn(
                                                    "text-[9px] px-1.5 py-1 rounded truncate font-medium",
                                                    event.type === 'viewing' ? "bg-emerald-500/20 text-emerald-300" :
                                                        event.type === 'call' ? "bg-blue-500/20 text-blue-300" :
                                                            "bg-amber-500/20 text-amber-300"
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
                <div className="w-80 glass-panel rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4">Upcoming</h3>
                    <div className="space-y-3 overflow-y-auto">
                        {events.map(event => (
                            <div key={event.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-colors group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center",
                                        event.type === 'viewing' ? "bg-emerald-500/20 text-emerald-400" :
                                            event.type === 'call' ? "bg-blue-500/20 text-blue-400" :
                                                "bg-amber-500/20 text-amber-400"
                                    )}>
                                        {event.type === 'viewing' ? <Home size={14} /> : event.type === 'call' ? <Phone size={14} /> : <Users size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">{event.title}</p>
                                        <p className="text-[10px] text-slate-400">{event.time}</p>
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
        <div className="w-80 flex-shrink-0 bg-[#0d111c] border-r border-white/5 flex flex-col h-full relative z-10">
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-5 border-b border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Leads</h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{filteredLeads.length} Active Leads</p>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button p-2 rounded-lg text-slate-400 hover:text-white">
                        <Filter size={16} />
                    </button>
                    <button className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Search & Filter Tabs */}
            <div className="p-5 pb-2 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search leads..."
                        className="w-full bg-[#1a202c] text-white pl-10 pr-3 py-2.5 rounded-xl border border-white/5 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none text-xs transition-all placeholder-slate-600 shadow-inner"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['All', 'New', 'Qualified', 'Closed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                                filter === status
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                    : "bg-transparent border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
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
                            "p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden group border",
                            selectedId === lead.id
                                ? "bg-gradient-to-r from-indigo-900/20 to-indigo-900/10 border-indigo-500/30 shadow-lg shadow-indigo-900/10"
                                : "glass-card hover:border-indigo-500/20"
                        )}
                    >
                        {selectedId === lead.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

                        <div className="flex justify-between items-start mb-1.5">
                            <h4 className={cn("font-bold text-sm", selectedId === lead.id ? "text-white" : "text-slate-200 group-hover:text-white")}>
                                {lead.name}
                            </h4>
                            <span className="text-[9px] text-slate-500 font-medium bg-[#0d111c] px-1.5 py-0.5 rounded-full border border-white/5">
                                {formatTime(lead.history?.[lead.history?.length - 1]?.timestamp || lead.created_at)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            {lead.budget && (
                                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                                    <DollarSign size={10} />
                                    {!isNaN(parseFloat(lead.budget)) && isFinite(lead.budget) ? formatCurrency(lead.budget) : lead.budget}
                                </span>
                            )}
                            {lead.propertyType && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                    <Home size={10} />
                                    {lead.propertyType}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mb-2 leading-relaxed">
                            {lead.history?.[lead.history?.length - 1]?.content || "No messages yet"}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border",
                                lead.status === 'New' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                    lead.status === 'Qualified' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        "bg-slate-700/50 text-slate-400 border-slate-600/30"
                            )}>
                                {lead.status}
                            </span>
                            {lead.priority === 'High' && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border bg-red-500/10 text-red-400 border-red-500/20">
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
            <div className="flex-1 bg-[#0d111c] flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#0d111c] to-[#0d111c]" />
                <div className="w-20 h-20 glass-panel rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-black/20 relative z-10">
                    <Users size={40} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 relative z-10">Select a Lead</h3>
                <p className="text-slate-500 max-w-xs text-sm relative z-10">Choose a lead from the list to view their details and timeline.</p>
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
            case 'note': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
            case 'email': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'call': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'voice_transcript': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'task': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
            case 'meeting': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
            case 'lifecycle': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
            default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        }
    };

    const filteredHistory = activeTab === 'Activity'
        ? lead.history
        : lead.history.filter(h => h.type.toLowerCase() === activeTab.toLowerCase().slice(0, -1)); // Simple plural to singular conversion

    return (
        <div className="flex-1 flex flex-col bg-[#0d111c] h-full overflow-hidden relative">
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-6 glass-header z-20 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20 ring-2 ring-white/5">
                        {lead.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight mb-0.5">{lead.name}</h2>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                                <MapPin size={10} />
                                <span>{lead.location || 'Dubai, UAE'}</span>
                            </div>
                            <span className={cn(
                                "font-bold px-1.5 py-0.5 rounded border",
                                lead.status === 'New' ? "text-blue-400 border-blue-500/20 bg-blue-500/10" :
                                    lead.status === 'Qualified' ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-slate-400 border-slate-600/20 bg-slate-600/10"
                            )}>{lead.status}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 transition-all">
                        <Phone size={18} />
                    </button>
                    <button className="glass-button p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 transition-all">
                        <Mail size={18} />
                    </button>
                    <button className="glass-button p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 transition-all">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* Lead Info Grid (Compact) */}
            <div className="px-6 py-4 z-10 border-b border-white/5 bg-[#0d111c]">
                <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <DollarSign size={10} /> Budget
                        </p>
                        <p className="text-sm font-bold text-white">
                            {lead.budget ? (
                                !isNaN(parseFloat(lead.budget)) && isFinite(lead.budget) ? formatCurrency(lead.budget) : lead.budget
                            ) : 'Not set'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Home size={10} /> Property
                        </p>
                        <p className="text-sm font-bold text-white">{lead.propertyType || 'Any'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Briefcase size={10} /> Purpose
                        </p>
                        <p className="text-sm font-bold text-white">{lead.purpose || 'Investment'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Tag size={10} /> Source
                        </p>
                        <p className="text-sm font-bold text-white">{lead.source || 'Website'}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 border-b border-white/5 bg-[#0d111c]">
                <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2",
                                    activeTab === tab.id
                                        ? "text-indigo-400 border-indigo-500"
                                        : "text-slate-500 border-transparent hover:text-slate-300"
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
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0d111c]">
                {/* Input Area Removed as per user request */}

                {/* Timeline */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {filteredHistory && filteredHistory.length > 0 ? (
                        filteredHistory.slice().reverse().map((event, idx) => { // Reverse to show newest first
                            const Icon = getIconForType(event.type);
                            const colorClass = getColorForType(event.type);

                            return (
                                <div key={idx} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", colorClass)}>
                                            <Icon size={14} />
                                        </div>
                                        {idx !== filteredHistory.length - 1 && <div className="w-px h-full bg-white/5 my-1" />}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-200">
                                                    {event.type === 'Voice_Transcript' ? (event.sender === 'Lead' ? 'Voice Call from Lead' : 'Morgan (Voice Call)') : event.type === 'Message' || event.type === 'Voice' || event.type === 'Image' ? `Message from ${event.sender}` : `${event.type} logged`}
                                                </span>
                                                <span className="text-[10px] text-slate-500">• {formatTime(event.timestamp)}</span>
                                            </div>
                                            <button className="text-slate-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </div>
                                        <div className="glass-panel p-3 rounded-xl border border-white/5 text-sm text-slate-300 leading-relaxed">
                                            {event.content}

                                            {/* Render Audio for Voice Messages */}
                                            {event.type === 'Voice' && event.meta && (
                                                <div className="mt-3 bg-[#0d111c] p-2 rounded-lg border border-white/10">
                                                    <audio controls src={event.meta} className="w-full h-8" />
                                                </div>
                                            )}

                                            {/* Render Image for Image Messages */}
                                            {event.type === 'Image' && event.meta && (
                                                <div className="mt-3">
                                                    <img
                                                        src={event.meta}
                                                        alt="Shared Media"
                                                        className="rounded-lg max-w-xs border border-white/10 hover:opacity-90 transition-opacity cursor-pointer"
                                                        onClick={() => window.open(event.meta, '_blank')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {event.meta && event.type !== 'Voice' && event.type !== 'Image' && (
                                            <div className="mt-2 flex gap-2">
                                                <span className="text-[10px] font-medium text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                                                    {event.meta}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
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
const MessagesView = ({ leads, selectedId, onSelect, onSendMessage }) => {
    // Filter leads to only those with history
    const activeConversations = leads.filter(l => l.history && l.history.length > 0);
    const selectedLead = leads.find(l => l.id === selectedId) || activeConversations[0];

    // Simple Chat Interface for Messages View
    const SimpleChat = ({ lead, onSendMessage }) => {
        const [msg, setMsg] = useState('');
        if (!lead) return <div className="flex-1 flex items-center justify-center text-slate-500">Select a conversation</div>;

        return (
            <div className="flex-1 flex flex-col h-full bg-[#0d111c]">
                <div className="h-16 border-b border-white/5 flex items-center px-6">
                    <h3 className="font-bold text-white">{lead.name}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {lead.history.filter(h => h.type === 'Message').map((m, i) => (
                        <div key={i} className={cn("flex w-full", m.sender === 'User' ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[70%] px-4 py-2 rounded-2xl text-sm",
                                m.sender === 'User' ? "bg-indigo-600 text-white" : "glass-panel text-slate-200"
                            )}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-white/5">
                    <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { onSendMessage(msg, 'Message'); setMsg(''); } }} className="flex gap-2">
                        <input
                            value={msg}
                            onChange={e => setMsg(e.target.value)}
                            className="flex-1 bg-[#1a202c] rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Type a message..."
                        />
                        <button type="submit" className="bg-indigo-600 p-2 rounded-xl text-white"><Send size={18} /></button>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-1 w-full overflow-hidden bg-[#0d111c]">
            {/* Inbox List */}
            <div className="w-80 flex-shrink-0 border-r border-white/5 flex flex-col h-full relative z-10">
                <div className="h-20 flex items-center justify-between px-5 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white tracking-tight">Inbox</h2>
                    <button className="glass-button p-2 rounded-lg text-slate-400 hover:text-white">
                        <Plus size={16} />
                    </button>
                </div>
                <div className="p-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full bg-[#1a202c] text-white pl-10 pr-3 py-2.5 rounded-xl border border-white/5 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none text-xs transition-all placeholder-slate-600 shadow-inner"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                    {activeConversations.map(lead => (
                        <div
                            key={lead.id}
                            onClick={() => onSelect(lead)}
                            className={cn(
                                "p-3 rounded-xl cursor-pointer transition-all relative overflow-hidden group border flex gap-3",
                                selectedLead?.id === lead.id
                                    ? "bg-white/10 border-white/10"
                                    : "hover:bg-white/5 border-transparent hover:border-white/5"
                            )}
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {lead.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="font-bold text-sm text-slate-200 truncate">{lead.name}</h4>
                                    <span className="text-[9px] text-slate-500">{formatTime(lead.history[lead.history.length - 1].timestamp)}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                    {lead.history[lead.history.length - 1].content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <SimpleChat lead={selectedLead} onSendMessage={onSendMessage} />
        </div>
    );
};

// Main CRM App
function CRMApp() {
    const [activeView, setActiveView] = useState('dashboard');
    const [leads, setLeads] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [filter, setFilter] = useState('All');

    const selectedLead = leads.find(l => l.id === selectedLeadId);

    const [error, setError] = useState(null);

    // Fetch data & realtime
    useEffect(() => {
        const fetchData = async () => {
            setError(null);
            try {
                console.log("Attempting to fetch data from Supabase...");
                const { data: leadsData, error: leadsError } = await supabase
                    .from('leads')
                    .select('*')
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

                console.log("Successfully fetched leads:", mergedLeads.length);
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
    }, []);

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
                return <CalendarView />;
            case 'agent-folders':
                return <AgentFolders />;
            case 'messages':
                return (
                    <MessagesView
                        leads={leads}
                        selectedId={selectedLeadId}
                        onSelect={(lead) => setSelectedLeadId(lead.id)}
                        onSendMessage={handleSendMessage}
                    />
                );
            case 'leads':
            default:
                return (
                    <div className="flex flex-1 w-full overflow-hidden">
                        <LeadList
                            leads={leads}
                            selectedId={selectedLeadId}
                            onSelect={(lead) => setSelectedLeadId(lead.id)}
                            filter={filter}
                            setFilter={setFilter}
                        />
                        <LeadDetail lead={selectedLead} onSendMessage={handleSendMessage} />
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#0d111c] text-slate-200 font-sans overflow-hidden selection:bg-indigo-500/30 relative">
            {error && (
                <div className="absolute top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-white/10 max-w-md animate-in slide-in-from-top-5 fade-in duration-300">
                    <XCircle size={20} className="flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="font-bold text-sm">Connection Error</h4>
                        <p className="text-xs opacity-90">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            {renderView()}
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
                <div className="min-h-screen bg-[#0d111c] flex items-center justify-center p-4">
                    <div className="max-w-md glass-panel p-8 rounded-3xl border border-red-900/50 shadow-2xl text-center">
                        <XCircle className="text-red-500 mx-auto mb-4" size={48} />
                        <h2 className="text-xl font-bold text-white mb-2">Application Error</h2>
                        <p className="text-slate-400 text-sm mb-6">{this.state.error?.message || "Something went wrong"}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-[#2d3748] hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
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
            <div className="min-h-screen bg-[#0d111c] flex items-center justify-center p-4">
                <div className="max-w-md glass-panel p-8 rounded-3xl border border-red-900/50 shadow-2xl text-center">
                    <XCircle className="text-red-500 mx-auto mb-4" size={48} />
                    <h2 className="text-xl font-bold text-white mb-2">Configuration Error</h2>
                    <p className="text-slate-400 mb-4 text-sm">Missing Clerk Publishable Key</p>
                    <code className="block bg-[#0d111c] p-3 rounded-xl text-xs text-emerald-400 font-mono border border-white/10">
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
                        <div className="min-h-screen bg-[#0d111c] flex items-center justify-center p-4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0d111c] to-[#0d111c]" />
                            <div className="w-full max-w-md glass-panel rounded-3xl border border-white/10 p-10 shadow-2xl relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/30">
                                    <span className="text-white font-bold text-3xl">A</span>
                                </div>
                                <h2 className="text-3xl font-bold text-white text-center mb-2">Welcome to AURO</h2>
                                <p className="text-slate-400 text-center mb-8">Sign in to access your AI Real Estate CRM</p>
                                <SignIn
                                    forceRedirectUrl="/dashboard"
                                    appearance={{
                                        elements: {
                                            rootBox: "w-full",
                                            card: "bg-transparent shadow-none p-0",
                                            headerTitle: "hidden",
                                            headerSubtitle: "hidden",
                                            formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white normal-case text-sm h-12 rounded-xl shadow-lg shadow-indigo-500/20",
                                            formFieldInput: "bg-[#0d111c] border-white/10 text-white focus:border-indigo-500 rounded-xl transition-colors h-12",
                                            formFieldLabel: "text-slate-400",
                                            footerActionLink: "text-indigo-400 hover:text-indigo-300"
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
