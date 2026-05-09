"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Save, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Search,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  History,
  Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Policy {
  id: string;
  handle: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/policies');
      const data = await res.json();
      setPolicies(data);
      if (data.length > 0 && !selectedPolicy) {
        setSelectedPolicy(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch policies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPolicy) return;
    
    setSaving(true);
    setMessage(null);
    try {
      const isNew = !selectedPolicy.id;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch('/api/admin/policies', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedPolicy),
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `Policy ${isNew ? 'created' : 'updated'} successfully!` });
        setIsEditing(false);
        fetchPolicies();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save policy' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this policy?")) return;
    
    try {
      const res = await fetch(`/api/admin/policies?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Policy deleted successfully' });
        if (selectedPolicy?.id === id) {
          setSelectedPolicy(policies.find(p => p.id !== id) || null);
        }
        fetchPolicies();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete policy' });
    }
  };

  const filteredPolicies = policies.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
            Store Policies
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your legal and support policies for the mobile app and storefront.
          </p>
        </div>
        
        <button
          onClick={() => {
            setSelectedPolicy({ id: '', handle: '', title: '', content: '', updatedAt: '' });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create New Policy
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)]">
        {/* Sidebar List */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden h-full">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-foreground/[0.03] border border-foreground/[0.08] rounded-2xl focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl bg-foreground/5 animate-pulse" />
              ))
            ) : filteredPolicies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-2xl">
                No policies found
              </div>
            ) : (
              filteredPolicies.map((policy) => (
                <button
                  key={policy.id}
                  onClick={() => {
                    setSelectedPolicy(policy);
                    setIsEditing(false);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all relative overflow-hidden group ${
                    selectedPolicy?.id === policy.id
                      ? "bg-foreground/10 border-foreground/20 shadow-sm"
                      : "bg-background border-foreground/[0.05] hover:bg-foreground/[0.02] hover:border-foreground/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate pr-4">{policy.title}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${selectedPolicy?.id === policy.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-2 py-0.5 bg-foreground/5 rounded-md">
                      {policy.handle}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8 h-full">
          <AnimatePresence mode="wait">
            {selectedPolicy ? (
              <motion.div
                key={selectedPolicy.id || 'new'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass rounded-3xl border border-foreground/[0.08] h-full flex flex-col shadow-2xl relative overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-foreground/[0.08] flex items-center justify-between bg-foreground/[0.01]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/10 shadow-inner">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={selectedPolicy.title}
                          onChange={(e) => setSelectedPolicy({ ...selectedPolicy, title: e.target.value })}
                          className="text-xl font-bold bg-transparent border-b border-foreground/20 focus:outline-none focus:border-foreground transition-all px-0 py-1"
                          placeholder="Policy Title"
                        />
                      ) : (
                        <h2 className="text-xl font-bold">{selectedPolicy.title}</h2>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">Handle:</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={selectedPolicy.handle}
                            onChange={(e) => setSelectedPolicy({ ...selectedPolicy, handle: e.target.value })}
                            className="text-[10px] font-mono bg-foreground/5 px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-foreground/20"
                            placeholder="policy-handle"
                          />
                        ) : (
                          <span className="text-[10px] font-mono text-muted-foreground">{selectedPolicy.handle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            if (!selectedPolicy.id) setSelectedPolicy(policies[0]);
                          }}
                          className="px-4 py-2 text-sm font-medium hover:bg-foreground/5 rounded-full transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-5 py-2 bg-foreground text-background rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 active:scale-95"
                        >
                          {saving ? <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDelete(selectedPolicy.id)}
                          className="p-2.5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                          title="Delete Policy"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 px-5 py-2 bg-foreground/5 border border-foreground/10 rounded-full font-semibold hover:bg-foreground/10 transition-all active:scale-95"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit Policy
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Message */}
                {message && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className={`px-6 py-3 border-b flex items-center gap-3 ${
                      message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span className="text-sm font-medium">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* Editor/Viewer */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {isEditing ? (
                    <textarea
                      value={selectedPolicy.content}
                      onChange={(e) => setSelectedPolicy({ ...selectedPolicy, content: e.target.value })}
                      className="w-full h-full min-h-[400px] bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed"
                      placeholder="Write your policy in Markdown or HTML..."
                    />
                  ) : (
                    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-500">
                      {selectedPolicy.content ? (
                        <div dangerouslySetInnerHTML={{ __html: selectedPolicy.content.replace(/\n/g, '<br/>') }} />
                      ) : (
                        <p className="text-muted-foreground italic">No content available for this policy.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Meta */}
                {!isEditing && (
                  <div className="p-4 px-8 border-t border-foreground/[0.05] bg-foreground/[0.01] flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />
                        Last updated: {new Date(selectedPolicy.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </div>
                      <div className="w-[1px] h-3 bg-foreground/10" />
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        Live on Mobile App
                      </div>
                    </div>
                    <a 
                      href={`/api/app/policies?handle=${selectedPolicy.handle}`} 
                      target="_blank" 
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                    >
                      JSON API
                      <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center glass rounded-3xl border border-foreground/[0.08] text-muted-foreground space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground/5 flex items-center justify-center">
                  <FileText className="w-10 h-10 opacity-20" />
                </div>
                <p className="text-lg font-medium">Select a policy to view or edit</p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-full transition-all"
                >
                  Create your first policy
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const X = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
