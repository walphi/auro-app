import React, { useState, useEffect } from 'react';
import {
    Building2, Users, Plus, Trash2, Edit2, Check, X,
    RefreshCw, Shield, UserPlus, ChevronDown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

const TenantAdmin = ({ currentTenant }) => {
    const [tenants, setTenants] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tenants');

    // New Tenant Form
    const [showNewTenant, setShowNewTenant] = useState(false);
    const [newTenant, setNewTenant] = useState({ name: '', short_name: '', rag_client_id: '' });

    // Edit Profile Modal
    const [editingProfile, setEditingProfile] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: tenantsData } = await supabase
                .from('tenants')
                .select('*')
                .order('id', { ascending: true });

            const { data: profilesData } = await supabase
                .from('profiles')
                .select('*, tenants(name)')
                .order('created_at', { ascending: false });

            setTenants(tenantsData || []);
            setProfiles(profilesData || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTenant = async () => {
        if (!newTenant.name || !newTenant.short_name) return;

        try {
            const { error } = await supabase.from('tenants').insert({
                name: newTenant.name,
                short_name: newTenant.short_name.toLowerCase().replace(/\s+/g, '_'),
                rag_client_id: newTenant.rag_client_id || newTenant.short_name.toLowerCase().replace(/\s+/g, '_')
            });

            if (error) throw error;

            setNewTenant({ name: '', short_name: '', rag_client_id: '' });
            setShowNewTenant(false);
            fetchData();
        } catch (err) {
            console.error('Error creating tenant:', err);
            alert('Failed to create tenant: ' + err.message);
        }
    };

    const handleUpdateProfile = async (profileId, tenantId, role) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ tenant_id: tenantId, role: role })
                .eq('id', profileId);

            if (error) throw error;

            setEditingProfile(null);
            fetchData();
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Failed to update profile: ' + err.message);
        }
    };

    const handleDeleteTenant = async (tenantId) => {
        if (!confirm('Are you sure? This will NOT delete associated data but will unlink users.')) return;

        try {
            // First unlink any profiles
            await supabase.from('profiles').update({ tenant_id: null }).eq('tenant_id', tenantId);

            // Then delete tenant
            const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
            if (error) throw error;

            fetchData();
        } catch (err) {
            console.error('Error deleting tenant:', err);
            alert('Failed to delete tenant: ' + err.message);
        }
    };

    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Shield className="text-amber-500" size={28} />
                            Tenant Administration
                        </h1>
                        <p className="text-slate-400 mt-1">Manage tenants and user assignments</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('tenants')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'tenants'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <Building2 size={18} />
                        Tenants ({tenants.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'users'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <Users size={18} />
                        User Profiles ({profiles.length})
                    </button>
                </div>

                {/* Tenants Tab */}
                {activeTab === 'tenants' && (
                    <div className="space-y-4">
                        {/* New Tenant Button */}
                        {!showNewTenant && (
                            <button
                                onClick={() => setShowNewTenant(true)}
                                className="w-full p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                Add New Tenant
                            </button>
                        )}

                        {/* New Tenant Form */}
                        {showNewTenant && (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                <h3 className="font-semibold text-white">Create New Tenant</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Tenant Name (e.g., Acme Realty)"
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Short Name (e.g., acme)"
                                        value={newTenant.short_name}
                                        onChange={(e) => setNewTenant({ ...newTenant, short_name: e.target.value })}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="RAG Client ID (optional)"
                                        value={newTenant.rag_client_id}
                                        onChange={(e) => setNewTenant({ ...newTenant, rag_client_id: e.target.value })}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => setShowNewTenant(false)}
                                        className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateTenant}
                                        className="px-4 py-2 rounded-lg bg-amber-500 text-black font-medium hover:bg-amber-400"
                                    >
                                        Create Tenant
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tenants List */}
                        <div className="grid gap-4">
                            {tenants.map((tenant) => (
                                <div
                                    key={tenant.id}
                                    className={`p-4 rounded-xl bg-white/5 border ${currentTenant?.id === tenant.id ? 'border-amber-500/50' : 'border-white/10'
                                        } flex items-center justify-between`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                            <Building2 className="text-amber-400" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white flex items-center gap-2">
                                                {tenant.name}
                                                {currentTenant?.id === tenant.id && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                                        Current
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-slate-400">
                                                ID: {tenant.id} • Short: {tenant.short_name} • RAG: {tenant.rag_client_id || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-500 mr-4">
                                            {profiles.filter(p => p.tenant_id === tenant.id).length} users
                                        </span>
                                        {tenant.id !== 1 && (
                                            <button
                                                onClick={() => handleDeleteTenant(tenant.id)}
                                                className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="grid gap-3">
                            {profiles.map((profile) => (
                                <div
                                    key={profile.id}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                                            <Users className="text-slate-300" size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white font-mono text-sm">
                                                {profile.user_id}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                Tenant: <span className="text-amber-400">{profile.tenants?.name || 'Unassigned'}</span>
                                                {' • '}Role: <span className="text-emerald-400">{profile.role || 'agent'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {editingProfile?.id === profile.id ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={editingProfile.tenant_id || ''}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, tenant_id: parseInt(e.target.value) })}
                                                className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm"
                                            >
                                                <option value="">Unassigned</option>
                                                {tenants.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={editingProfile.role || 'agent'}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })}
                                                className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm"
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="agent">Agent</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                            <button
                                                onClick={() => handleUpdateProfile(profile.id, editingProfile.tenant_id, editingProfile.role)}
                                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => setEditingProfile(null)}
                                                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setEditingProfile(profile)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {profiles.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>No user profiles yet.</p>
                                    <p className="text-sm">Users will appear here after they log in.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TenantAdmin;
