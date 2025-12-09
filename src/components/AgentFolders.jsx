import React, { useState, useEffect } from 'react';
import {
    Folder, FileText, Globe, Zap, Upload, Plus, Trash2,
    RefreshCw, CheckCircle2, Search, AlertCircle, ChevronDown,
    Cpu, Database, ArrowRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';

// Utils
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

const AgentFolders = () => {
    const [folders, setFolders] = useState([]);
    const [activeFolder, setActiveFolder] = useState(null);
    const [knowledgeBase, setKnowledgeBase] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, indexing, complete
    const [indexingProgress, setIndexingProgress] = useState(0);

    // Inputs
    const [urlInput, setUrlInput] = useState('');
    const [hotTopicInput, setHotTopicInput] = useState('');
    const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);

    useEffect(() => {
        fetchFolders();
    }, []);

    useEffect(() => {
        if (activeFolder) {
            fetchKnowledgeBase(activeFolder.id);
        }
    }, [activeFolder]);

    const fetchFolders = async () => {
        try {
            const { data, error } = await supabase.from('projects').select('*');
            if (error) throw error;

            if (data && data.length > 0) {
                setFolders(data);
                setActiveFolder(data[0]);
            } else {
                // Create a default folder if none exists
                const { data: newFolder, error: createError } = await supabase
                    .from('projects')
                    .insert({ name: 'General Knowledge', status: 'Active' })
                    .select()
                    .single();

                if (newFolder) {
                    setFolders([newFolder]);
                    setActiveFolder(newFolder);
                }
            }
        } catch (err) {
            console.error("Error fetching folders:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchKnowledgeBase = async (projectId) => {
        try {
            const { data, error } = await supabase
                .from('knowledge_base')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map to UI format
            const formattedDocs = data.map(doc => ({
                id: doc.id,
                type: doc.type,
                name: doc.source_name,
                size: doc.metadata?.size || 'N/A',
                status: 'Indexed', // Assuming if it's in DB, it's indexed
                date: new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            setKnowledgeBase(formattedDocs);
        } catch (err) {
            console.error("Error fetching knowledge base:", err);
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt("Enter folder name:");
        if (!name) return;

        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({ name, status: 'Active' })
                .select()
                .single();

            if (error) throw error;

            setFolders([...folders, data]);
            setActiveFolder(data);
            setIsFolderDropdownOpen(false);
        } catch (err) {
            console.error("Error creating folder:", err);
            alert(`Failed to create folder: ${err.message || JSON.stringify(err)}`);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeFolder) return;

        setUploadStatus('uploading');
        setIndexingProgress(10);

        try {
            let textContent = '';
            let filename = file.name;

            // Extract text from PDF client-side
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                setUploadStatus('indexing');
                setIndexingProgress(30);

                try {
                    // Import pdfjs-dist and worker for Vite
                    const pdfjsLib = await import('pdfjs-dist');

                    // For pdfjs-dist v5.x, use the bundled worker
                    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
                    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                    setIndexingProgress(50);

                    // Extract text from all pages
                    const textParts = [];
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const pageText = content.items.map(item => item.str).join(' ');
                        textParts.push(pageText);
                    }
                    textContent = textParts.join('\n\n');

                    setIndexingProgress(70);
                } catch (pdfError) {
                    console.error('PDF extraction error:', pdfError);
                    setUploadStatus('idle');
                    alert(`Failed to extract text from PDF: ${pdfError.message}`);
                    return;
                }
            } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                textContent = await file.text();
            } else {
                setUploadStatus('idle');
                alert('Only PDF and TXT files are supported');
                return;
            }

            // Send extracted text to server
            const response = await axios.post('/api/v1/client/demo/rag/upload_text', {
                text: textContent,
                filename: filename,
                project_id: activeFolder.id
            });

            setIndexingProgress(100);
            setUploadStatus('complete');
            setTimeout(() => setUploadStatus('idle'), 2000);
            fetchKnowledgeBase(activeFolder.id);

        } catch (error) {
            console.error("Upload failed:", error);
            setUploadStatus('idle');
            alert(`Upload failed: ${error.response?.data?.error || error.message || 'Unknown error'}`);
        }
    };

    const handleAddUrl = async () => {
        if (!urlInput || !activeFolder) return;

        setUploadStatus('indexing');
        setIndexingProgress(20);

        try {
            await axios.post('/api/v1/client/demo/rag/add_url', {
                url: urlInput,
                project_id: activeFolder.id
            });

            setIndexingProgress(100);
            setUploadStatus('complete');
            setTimeout(() => setUploadStatus('idle'), 2000);
            setUrlInput('');
            fetchKnowledgeBase(activeFolder.id);

        } catch (error) {
            console.error("URL indexing failed:", error);
            setUploadStatus('idle');
            alert(`URL indexing failed: ${error.response?.data || error.message || 'Unknown error'}`);
        }
    };

    const handleSetContext = async () => {
        if (!hotTopicInput || !activeFolder) return;

        try {
            await axios.post('/api/v1/client/demo/rag/set_context', {
                context: hotTopicInput,
                project_id: activeFolder.id
            });

            setHotTopicInput('');
            fetchKnowledgeBase(activeFolder.id);
            alert("Context injected successfully.");

        } catch (error) {
            console.error("Context injection failed:", error);
            alert("Failed to set context.");
        }
    };

    const handleDeleteSource = async (sourceId) => {
        if (!confirm('Are you sure you want to delete this source?')) return;

        try {
            // Call Backend API to delete (bypasses RLS)
            await axios.post('/api/v1/client/demo/rag/delete_source', {
                id: sourceId
            });

            // Refresh the knowledge base
            if (activeFolder) {
                fetchKnowledgeBase(activeFolder.id);
            }

            console.log('Source deleted successfully:', sourceId);
        } catch (error) {
            console.error("Failed to delete source:", error);
            alert(`Failed to delete: ${error.response?.data?.error || error.message}`);
        }
    };

    return (
        <div className="flex-1 bg-[#030305] p-6 lg:p-8 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight flex items-center gap-3">
                        <Folder className="text-indigo-500" size={32} />
                        Agent Folders
                    </h1>
                    <p className="text-slate-400 text-sm">Manage RAG knowledge bases for your AI agents.</p>
                </div>

                {/* Folder Selector */}
                <div className="relative">
                    <button
                        onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                        className="glass-button px-4 py-2.5 rounded-xl text-white flex items-center gap-3 min-w-[240px] justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-semibold">{activeFolder?.name || 'Select Folder'}</span>
                        </div>
                        <ChevronDown size={16} className="text-slate-400 group-hover:text-white transition-colors" />
                    </button>

                    {isFolderDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-full glass-panel rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                            {folders.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => { setActiveFolder(f); setIsFolderDropdownOpen(false); }}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors flex justify-between items-center"
                                >
                                    {f.name}
                                    {activeFolder?.id === f.id && <CheckCircle2 size={14} className="text-indigo-400" />}
                                </button>
                            ))}
                            <div className="border-t border-white/5 p-2">
                                <button
                                    onClick={handleCreateFolder}
                                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 py-2 rounded-lg hover:bg-indigo-500/10 transition-colors"
                                >
                                    <Plus size={14} /> New Folder
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                {/* Left Column: Ingestion Tools */}
                <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2">

                    {/* Status Bar */}
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Database size={18} className="text-indigo-400" />
                                    Knowledge Index
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Vector Store Status: <span className="text-emerald-400 font-bold">Ready</span></p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-white">{knowledgeBase.length}</div>
                                <div className="text-xs text-slate-500">Active Sources</div>
                            </div>
                        </div>

                        {/* Progress Bar (Visual Only unless uploading) */}
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
                                style={{ width: uploadStatus === 'idle' ? '100%' : `${indexingProgress}%` }}
                            />
                        </div>
                        {uploadStatus !== 'idle' && (
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-300 mt-2">
                                <span>{uploadStatus === 'uploading' ? 'Uploading Files...' : uploadStatus === 'indexing' ? 'Generating Embeddings...' : 'Sync Complete'}</span>
                                <span>{indexingProgress}%</span>
                            </div>
                        )}
                    </div>

                    {/* Upload Area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* File Upload */}
                        <div className="glass-panel p-6 rounded-2xl border-dashed border-2 border-white/10 hover:border-indigo-500/30 transition-colors group text-center cursor-pointer relative">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={handleFileUpload}
                                accept=".pdf,.txt"
                            />
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={24} className="text-indigo-400" />
                            </div>
                            <h4 className="font-bold text-white mb-1">Upload Documents</h4>
                            <p className="text-xs text-slate-500 mb-4">PDF, TXT (Max 50MB)</p>
                            <button className="bg-white/5 text-indigo-300 px-4 py-2 rounded-lg text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                Select Files
                            </button>
                        </div>

                        {/* URL Input */}
                        <div className="glass-panel p-6 rounded-2xl flex flex-col">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                                    <Globe size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Add Website</h4>
                                    <p className="text-[10px] text-slate-500">Crawl & Index URL</p>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-[#030305] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleAddUrl}
                                    className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-transparent py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    Add to Knowledge Base
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Hot Topic Context */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                                <Zap size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-sm">Hot Topic Injection</h4>
                                <p className="text-[10px] text-slate-500">High-priority context for immediate agent use</p>
                            </div>
                        </div>
                        <div className="relative">
                            <textarea
                                value={hotTopicInput}
                                onChange={(e) => setHotTopicInput(e.target.value)}
                                placeholder="E.g. 'The current special offer is a 50/50 payment plan for the next 30 days only.'"
                                className="w-full bg-[#030305] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none min-h-[100px] resize-none"
                            />
                            <button
                                onClick={handleSetContext}
                                className="absolute bottom-3 right-3 bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
                            >
                                Set Context
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Knowledge List */}
                <div className="glass-panel rounded-2xl p-0 flex flex-col overflow-hidden h-full">
                    <div className="p-5 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-white text-sm">Active Sources</h3>
                        <button
                            onClick={() => activeFolder && fetchKnowledgeBase(activeFolder.id)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {knowledgeBase.map((doc) => (
                            <div key={doc.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all group">
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                                        doc.type === 'file' ? "bg-red-500/10 text-red-400" :
                                            doc.type === 'url' ? "bg-blue-500/10 text-blue-400" :
                                                "bg-amber-500/10 text-amber-400"
                                    )}>
                                        {doc.type === 'file' ? <FileText size={16} /> :
                                            doc.type === 'url' ? <Globe size={16} /> :
                                                <Zap size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate mb-0.5">{doc.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            <span>{doc.size || 'Text Source'}</span>
                                            <span>•</span>
                                            <span>{doc.date}</span>
                                            <span className={cn(
                                                "ml-auto font-bold px-1.5 py-0.5 rounded",
                                                doc.status === 'Indexed' ? "bg-emerald-500/10 text-emerald-400" :
                                                    doc.status === 'Active' ? "bg-indigo-500/10 text-indigo-400" :
                                                        "bg-slate-700 text-slate-400"
                                            )}>{doc.status}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteSource(doc.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {knowledgeBase.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                <Folder size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No documents indexed yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentFolders;
