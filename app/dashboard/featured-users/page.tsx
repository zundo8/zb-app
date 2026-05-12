"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trash2, 
  ExternalLink,
  MessageSquare,
  Star,
  RefreshCw,
  Plus,
  Save,
  Trash
} from "lucide-react";
import Image from "next/image";

interface FeaturedUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  styleDescription: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isTopFeatured: boolean;
  orderId?: string | null;
  createdAt: string;
  reviews: any[];
}

export default function FeaturedUsersModeration() {
  const [submissions, setSubmissions] = useState<FeaturedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubmission, setNewSubmission] = useState({
    name: '',
    email: '',
    imageUrl: '',
    styleDescription: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/featured-users", { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      const data = await res.json();
      if (data.users) setSubmissions(data.users);
      else if (data.error) throw new Error(data.error);
    } catch (err) {
      console.error("Fetch submissions error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/featured-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchSubmissions();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleTopFeatured = async (id: string, current: boolean) => {
    const featuredCount = submissions.filter(s => s.isTopFeatured).length;
    if (!current && featuredCount >= 20) {
      alert("You can only feature up to 20 users on the homepage. Please unfeature someone first.");
      return;
    }

    setUpdatingId(id);
    try {
      await fetch(`/api/admin/featured-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTopFeatured: !current }),
      });
      fetchSubmissions();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/featured-users/${id}`, { method: 'DELETE' });
      fetchSubmissions();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateSubmission = async () => {
    if (!newSubmission.name || !newSubmission.email || !newSubmission.imageUrl) {
      alert("Please fill in all required fields (Name, Email, Image URL).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/featured-users", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubmission),
      });

      if (!res.ok) throw new Error("Failed to create submission");

      setNewSubmission({ name: '', email: '', imageUrl: '', styleDescription: '' });
      setShowCreateModal(false);
      fetchSubmissions();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const featuredTopCount = submissions.filter(s => s.isTopFeatured).length;

   if (loading && submissions.length === 0) {
    return (
      <div className="p-8 text-[10px] font-black uppercase tracking-widest text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 animate-pulse">
        Synchronizing submissions...
      </div>
    );
  }

   return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <div className="px-2 py-0.5 bg-foreground/[0.03] rounded-md text-[8px] font-black text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/40 dark:text-foreground/30 uppercase tracking-[0.2em] w-fit mb-1">moderation hub</div>
          <h1 className="text-xl font-black text-foreground uppercase tracking-tight mb-0.5 lowercase leading-none">
            Featured Users
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[10px] text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/40 dark:text-foreground/20 font-bold uppercase tracking-widest">
              Curate the Zica Bella community showcase.
            </p>
            <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border ${featuredTopCount >= 20 ? 'bg-orange-500/5 text-orange-500 border-orange-500/10' : 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10'}`}>
              {featuredTopCount}/20 featured
            </span>
          </div>
        </div>
        
         <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-foreground text-background rounded-lg text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-foreground/5 active:scale-95"
          >
            <Plus className="w-3 h-3" /> Insert Node
          </button>
          <a 
            href="/community" 
            target="_blank" 
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-foreground rounded-lg text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-emerald-500/5 active:scale-95"
          >
            <ExternalLink className="w-3 h-3" /> Live View
          </a>
          <div className="h-9 px-4 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg flex items-center gap-3">
            <Users className="w-3 h-3 text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20" />
            <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20">{submissions.length} Total</span>
          </div>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.map((item) => (
          <div key={item.id} className={`group relative bg-foreground/50 dark:bg-foreground/[0.02] border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm transition-all duration-700 hover:bg-foreground/[0.01] ${
            item.isTopFeatured ? 'ring-1 ring-emerald-500/50' : ''
          }`}>
             <div className="relative aspect-[4/5] bg-foreground/[0.02] overflow-hidden">
              <Image src={item.imageUrl || "/zb-logo-220px.png"} alt={item.name} fill className="object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 scale-105 group-hover:scale-100" />
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1 ${
                  item.status === 'APPROVED' ? 'bg-emerald-500 text-foreground' : 
                  item.status === 'REJECTED' ? 'bg-rose-500 text-foreground' : 'bg-amber-500 text-foreground'
                }`}>
                  {item.status}
                </span>
                {item.isTopFeatured && (
                  <span className="bg-emerald-500 text-foreground px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest shadow-lg">
                    TOP 20
                  </span>
                )}
              </div>
            </div>

             <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-foreground uppercase tracking-tight lowercase leading-none">{item.name}</h3>
                  <span className="text-[7.5px] font-black text-foreground/40 dark:text-foreground/20 dark:text-foreground/10 uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[7.5px] font-black text-foreground/40 dark:text-foreground/20 dark:text-foreground/10 uppercase tracking-widest truncate max-w-[120px] leading-none lowercase">{item.email}</p>
                  {item.orderId && (
                    <span className="text-[7px] font-black text-emerald-500 bg-emerald-500/5 px-1 rounded uppercase tracking-widest leading-none">
                      #{item.orderId.substring(0, 8)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-foreground/[0.01] rounded-lg border border-foreground/[0.02]">
                <p className="text-[8.5px] font-black text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/40 dark:text-foreground/20 italic leading-snug lowercase">
                  "{item.styleDescription || "Unspecified Transmission."}"
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                 <div className="flex items-center gap-1.5">
                  <button 
                    disabled={updatingId === item.id || item.status === 'APPROVED'}
                    onClick={() => handleUpdateStatus(item.id, 'APPROVED')}
                    className="w-7 h-7 rounded-lg bg-emerald-500/5 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/10 transition-all disabled:opacity-20"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={updatingId === item.id || item.status === 'REJECTED'}
                    onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                    className="w-7 h-7 rounded-lg bg-rose-500/5 text-rose-500 flex items-center justify-center hover:bg-rose-500/10 transition-all disabled:opacity-20"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                  <div 
                    onClick={() => item.status === 'APPROVED' && handleToggleTopFeatured(item.id, item.isTopFeatured)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      item.isTopFeatured 
                        ? 'bg-emerald-500 text-foreground border-transparent' 
                        : 'bg-foreground/[0.03] border-transparent text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30'
                    } ${item.status !== 'APPROVED' ? 'opacity-20 cursor-not-allowed' : ''}`}
                  >
                    <Star className={`w-2.5 h-2.5 ${item.isTopFeatured ? 'fill-white' : ''}`} />
                    <span className="text-[7.5px] font-black uppercase tracking-widest">
                      {item.isTopFeatured ? 'Top 20' : 'Feature'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    disabled={updatingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="w-7 h-7 rounded-lg hover:bg-rose-500/5 text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10 hover:text-rose-500 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {submissions.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-foreground/5 rounded-3xl">
          <Users className="w-12 h-12 mb-4 opacity-10" />
          <p className="text-sm font-medium">No community submissions to moderate yet.</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-foreground/10 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-foreground/5 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                New Community Submission
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Name</label>
                <input
                  type="text"
                  placeholder="Reviewer Name"
                  value={newSubmission.name}
                  onChange={e => setNewSubmission(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={newSubmission.email}
                  onChange={e => setNewSubmission(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Image</label>
                
                {/* File Upload Area */}
                {!newSubmission.imageUrl ? (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-foreground/10 rounded-2xl cursor-pointer hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all group">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsSubmitting(true);
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
                          const data = await res.json();
                          if (data.url) {
                            setNewSubmission(prev => ({ ...prev, imageUrl: data.url }));
                          } else {
                            alert(data.error || 'Upload failed');
                          }
                        } catch (err) {
                          alert('Upload failed. Please try again.');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    />
                    {isSubmitting ? (
                      <RefreshCw className="w-5 h-5 text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 group-hover:text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 transition-colors" />
                        <span className="text-[10px] text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 group-hover:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 transition-colors uppercase tracking-widest">Click to upload image</span>
                        <span className="text-[9px] text-foreground/15">JPG, PNG, WebP up to 10MB</span>
                      </>
                    )}
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden aspect-[3/2] bg-foreground/5 border border-foreground/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newSubmission.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewSubmission(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-background/60 text-foreground hover:bg-red-500 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* OR URL fallback */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[0.5px] bg-foreground/[0.06]" />
                  <span className="text-[9px] text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 uppercase tracking-widest">or paste URL</span>
                  <div className="flex-1 h-[0.5px] bg-foreground/[0.06]" />
                </div>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newSubmission.imageUrl.startsWith('data:') ? '' : newSubmission.imageUrl}
                  onChange={e => setNewSubmission(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Style Description</label>
                <textarea
                  rows={3}
                  placeholder="Style description or review comment..."
                  value={newSubmission.styleDescription}
                  onChange={e => setNewSubmission(prev => ({ ...prev, styleDescription: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleCreateSubmission}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-foreground rounded-2xl font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-emerald-500/10 disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? 'Creating...' : 'Create Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
