
import React, { useState, useEffect } from 'react';
import {
    Book,
    Globe,
    MessageSquare,
    Award,
    MapPin,
    Target,
    AlertCircle,
    Save,
    Loader2,
    CheckCircle2,
    ChevronRight,
    Building2,
    Plus,
    MinusCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

const KnowledgeBaseAdmin = ({ tenantId }) => {
    const [activeTab, setActiveTab] = useState('agency'); // 'agency' or 'campaign'
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);

    // Agency Form State
    const [agencyData, setAgencyData] = useState({
        history: '',
        mission: '',
        awards: '',
        team: '',
        office: ''
    });

    // Campaign Form State
    const [campaignData, setCampaignData] = useState({
        overview: '',
        usps: '',
        amenities: '',
        payment_plan: '',
        objections: [{ concern: '', response: '' }]
    });

    useEffect(() => {
        if (tenantId) {
            fetchInitialData();
        }
    }, [tenantId]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 1. Fetch current agency knowledge
            const { data: kbData } = await supabase
                .from('knowledge_base')
                .select('content')
                .eq('tenant_id', tenantId)
                .eq('folder_id', 'agency_history')
                .maybeSingle();

            if (kbData?.content) {
                // Parse sections if they exist
                const sections = kbData.content.split('## ');
                const parsed = { ...agencyData };
                sections.forEach(s => {
                    if (s.toLowerCase().includes('history')) parsed.history = s.split('\n').slice(1).join('\n').trim();
                    if (s.toLowerCase().includes('mission')) parsed.mission = s.split('\n').slice(1).join('\n').trim();
                    if (s.toLowerCase().includes('awards')) parsed.awards = s.split('\n').slice(1).join('\n').trim();
                    if (s.toLowerCase().includes('team')) parsed.team = s.split('\n').slice(1).join('\n').trim();
                    if (s.toLowerCase().includes('office')) parsed.office = s.split('\n').slice(1).join('\n').trim();
                });
                setAgencyData(parsed);
            }

            // 2. Fetch projects for this tenant
            const { data: pData } = await supabase
                .from('projects')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name', { ascending: true });

            setProjects(pData || []);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAgency = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            const sections = [
                { title: 'Agency History & Background', content: agencyData.history },
                { title: 'Mission & Core Values', content: agencyData.mission },
                { title: 'Awards & Recognition', content: agencyData.awards },
                { title: 'Team Size & Specialization', content: agencyData.team },
                { title: 'Office Locations', content: agencyData.office }
            ];

            const response = await fetch('/.netlify/functions/rag-ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    folder_id: 'agency_history',
                    sections: sections.filter(s => s.content) // Only sync non-empty
                })
            });

            if (response.ok) setSuccess(true);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddObjection = () => {
        setCampaignData({
            ...campaignData,
            objections: [...campaignData.objections, { concern: '', response: '' }]
        });
    };

    const renderAgencyForm = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionBox
                    title="History & Credibility"
                    icon={<Globe size={20} />}
                    value={agencyData.history}
                    onChange={v => setAgencyData({ ...agencyData, history: v })}
                    placeholder="Tell your brand story and timeline..."
                />
                <SectionBox
                    title="Mission & Values"
                    icon={<Target size={20} />}
                    value={agencyData.mission}
                    onChange={v => setAgencyData({ ...agencyData, mission: v })}
                    placeholder="What defines your brokerage?"
                />
                <SectionBox
                    title="Awards & PR"
                    icon={<Award size={20} />}
                    value={agencyData.awards}
                    onChange={v => setAgencyData({ ...agencyData, awards: v })}
                    placeholder="List major accolades..."
                />
                <SectionBox
                    title="Team & Reach"
                    icon={<Building2 size={20} />}
                    value={agencyData.team}
                    onChange={v => setAgencyData({ ...agencyData, team: v })}
                    placeholder="Agent count, areas covered..."
                />
            </div>
            <SectionBox
                title="Office Locations"
                icon={<MapPin size={20} />}
                value={agencyData.office}
                onChange={v => setAgencyData({ ...agencyData, office: v })}
                placeholder="Where can clients visit you?"
            />

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSaveAgency}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'Synthesizing Knowledge...' : 'Update Agency Brain'}
                </button>
            </div>
        </div>
    );

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={40} className="animate-spin text-amber-500" /></div>;

    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Book className="text-amber-500" size={28} />
                        AI Knowledge Center
                    </h1>
                    <p className="text-slate-400 mt-1">Configure what the AI knows about your agency and campaigns</p>
                </header>

                <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('agency')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'agency' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Agency Identity
                    </button>
                    <button
                        onClick={() => setActiveTab('campaign')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'campaign' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Campaign Manager
                    </button>
                </div>

                {success && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <CheckCircle2 size={20} />
                        Sync Complete: The AI is now updated with your latest branding.
                    </div>
                )}

                {activeTab === 'agency' ? renderAgencyForm() : <div className="text-slate-500 text-center py-12">Campaign Manager coming next...</div>}
            </div>
        </div>
    );
};

const SectionBox = ({ title, icon, value, onChange, placeholder }) => (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col gap-3">
        <div className="flex items-center gap-2 text-amber-500 font-semibold">
            {icon}
            {title}
        </div>
        <textarea
            className="w-full h-32 bg-black/30 border border-white/5 rounded-xl p-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

export default KnowledgeBaseAdmin;
