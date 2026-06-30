"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Check, Eye, EyeOff } from "lucide-react";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  published: boolean;
  author: string;
  createdAt: string;
  metaTitle?: string;
  metaDescription?: string;
  backlinkUrl?: string;
  backlinkText?: string;
  indexPref?: boolean;
};

export default function BlogsAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    author: "Zica Bella",
    published: false,
    metaTitle: "",
    metaDescription: "",
    backlinkUrl: "",
    backlinkText: "",
    indexPref: true,
  });

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blogs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPosts(data);
      }
    } catch (err) {
      console.error("Failed to fetch posts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleOpenModal = (post?: BlogPost) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || "",
        content: post.content,
        coverImage: post.coverImage || "",
        author: post.author,
        published: post.published,
        metaTitle: post.metaTitle || "",
        metaDescription: post.metaDescription || "",
        backlinkUrl: post.backlinkUrl || "",
        backlinkText: post.backlinkText || "",
        indexPref: post.indexPref !== undefined ? !!post.indexPref : true,
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        coverImage: "",
        author: "Zica Bella",
        published: true,
        metaTitle: "",
        metaDescription: "",
        backlinkUrl: "",
        backlinkText: "",
        indexPref: true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const method = editingPost ? 'PATCH' : 'POST';
      const body = editingPost ? { id: editingPost.id, ...formData } : formData;

      const res = await fetch('/api/admin/blogs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchPosts();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err: any) {
      alert(`Error saving post: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;
    try {
      const res = await fetch(`/api/admin/blogs?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPosts();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // Convert title to slug automatically if creating new
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (!editingPost) {
      setFormData({
        ...formData,
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      });
    } else {
      setFormData({ ...formData, title });
    }
  };

  if (loading) return <div className="p-8 text-[11px] font-black uppercase tracking-widest text-foreground/45">Loading transmissions...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
         <div className="space-y-1">
          <div className="px-2 py-0.5 bg-foreground/[0.03] rounded-md text-[8px] font-black text-foreground/80 uppercase tracking-[0.2em] w-fit mb-1">journal archives</div>
          <h1 className="text-xl font-black text-foreground uppercase tracking-tight mb-0.5 leading-none">
            Blog Management
          </h1>
          <p className="text-[10px] text-foreground/50 font-bold uppercase tracking-widest mt-1">
            Curate the Zica Bella narrative spectrum.
          </p>
        </div>
         <button
          onClick={() => handleOpenModal()}
          className="bg-foreground text-background px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-foreground/5"
        >
          <Plus className="w-3 h-3" /> New Transmission
        </button>
      </div>

      <div className="bg-background border border-foreground/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {posts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">No transmissions detected.</p>
          </div>
        ) : (
            <table className="w-full text-left text-[11px] whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.02] text-[8px] font-black uppercase tracking-[0.2em] text-foreground/40">
              <tr>
                <th className="px-4 py-2">Archive Title</th>
                <th className="px-4 py-2">SEO Status</th>
                <th className="px-4 py-2">Temporal Stamp</th>
                <th className="px-4 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.02]">
               {posts.map(post => (
                <tr key={post.id} className="hover:bg-foreground/[0.01] transition-colors group">
                  <td className="px-4 py-2.5">
                    <p className="font-black text-foreground uppercase tracking-tight truncate max-w-[300px] leading-tight-none">{post.title}</p>
                    <p className="text-[7.5px] font-black text-foreground/45 uppercase tracking-widest truncate max-w-[300px] mt-1">/{post.slug}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {post.published ? (
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                          LIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-foreground/[0.03] text-foreground/50 border border-foreground/10 uppercase tracking-widest">
                          ARCHIVE
                        </span>
                      )}
                      {post.indexPref !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-widest">
                          INDEXABLE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                          NOINDEX
                        </span>
                      )}
                      {post.backlinkUrl && (
                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-widest">
                          BACKLINKED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[9px] font-black text-foreground/40 uppercase tracking-widest">
                    {new Date(post.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                   <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(post)} className="p-2 text-foreground/65 hover:text-foreground hover:bg-foreground/[0.05] rounded-lg transition-colors">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="p-2 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/5 rounded-lg transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/50 backdrop-blur-xl">
          <div className="bg-background border border-foreground/10 w-full max-w-4xl max-h-[90vh] rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-foreground/[0.05] flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-foreground/40">{editingPost ? 'Update Transmission' : 'New Transmission'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-foreground/[0.05] rounded-full transition-colors text-foreground/40 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Transmission Header</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    className="glass-input w-full px-4 py-3 text-[13px] font-black text-foreground placeholder:text-foreground/35 uppercase tracking-tight focus:outline-none transition-all"
                    placeholder="Enter blog title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Resource Identifier (Slug)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="glass-input w-full px-4 py-3 text-[13px] font-black text-foreground focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Visual Reference (URL)</label>
                  <input
                    type="text"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground placeholder:text-foreground/35 focus:outline-none transition-all"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Origin Curator</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Brief Synopsis</label>
                <input
                  type="text"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground placeholder:text-foreground/35 focus:outline-none transition-all"
                  placeholder="Short description for the blog list..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Content Narrative (HTML / Markdown)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="glass-input w-full px-4 py-4 text-[13px] font-medium text-foreground placeholder:text-foreground/35 focus:outline-none transition-all resize-none font-sans"
                  placeholder="Initialize narrative transmission..."
                />
              </div>

              {/* SEO and backlinks section */}
              <div className="p-5 rounded-2xl bg-foreground/[0.01] border border-foreground/[0.04] space-y-6">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground/50">Search Engine Indexing & Backlinks</span>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">SEO Meta Title</label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                      className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground focus:outline-none transition-all"
                      placeholder="Custom Meta Title (falls back to Title)"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">SEO Meta Description</label>
                    <input
                      type="text"
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground focus:outline-none transition-all"
                      placeholder="Custom Meta Description (falls back to Excerpt)"
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Backlink Target URL</label>
                    <input
                      type="text"
                      value={formData.backlinkUrl}
                      onChange={(e) => setFormData({ ...formData, backlinkUrl: e.target.value })}
                      className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground focus:outline-none transition-all"
                      placeholder="e.g. https://external-review.com/zica-bella"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-foreground/45 uppercase tracking-[0.2em] ml-1">Backlink Anchor Text</label>
                    <input
                      type="text"
                      value={formData.backlinkText}
                      onChange={(e) => setFormData({ ...formData, backlinkText: e.target.value })}
                      className="glass-input w-full px-4 py-3 text-[11px] font-black text-foreground focus:outline-none transition-all"
                      placeholder="e.g. View collaboration archive"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="indexPref"
                    checked={formData.indexPref}
                    onChange={(e) => setFormData({ ...formData, indexPref: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-2 border-foreground/10 bg-background checked:bg-foreground checked:border-foreground transition-all cursor-pointer appearance-none relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-background checked:after:text-[10px] checked:after:font-black"
                  />
                  <label htmlFor="indexPref" className="flex flex-col cursor-pointer select-none">
                    <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">Enable Search Engine Indexing (Index)</span>
                    <span className="text-[9px] text-foreground/45">Allow Google and AI bots to crawl and index this post. Uncheck to set "noindex, nofollow".</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-foreground/[0.01] rounded-lg border border-foreground/[0.03]">
                <input
                  type="checkbox"
                  id="published"
                  checked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-2 border-foreground/10 bg-background checked:bg-foreground checked:border-foreground transition-all cursor-pointer appearance-none relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-background checked:after:text-[10px] checked:after:font-black"
                />
                <label htmlFor="published" className="text-[10px] font-black uppercase tracking-widest select-none cursor-pointer text-foreground/80">
                  Broadcast transmission immediately
                </label>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-foreground/[0.05] flex justify-end gap-2">
              <button 
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
              >
                Abort
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-foreground text-background hover:opacity-90 transition-all shadow-xl"
              >
                Sync Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
