"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Loader2, Plus, RefreshCw, Trash2, Edit2, Phone, MapPin, Building2, Search, Check, 
  Briefcase, Globe, User, ShieldCheck, Heart, Zap, 
  Scissors, Palette as PaletteIcon, Sparkles, Waves, Package, ClipboardList,
  Mail, Clock, MessageSquare
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";

type Vendor = {
  id: string;
  name: string;
  address: string | null;
  mobile: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
  contactPerson?: string | null;
  email?: string | null;
  pricingNotes?: string | null;
  leadTimeDays?: number | null;
  remarks?: string | null;
};

const CATEGORIES = [
  "Fabric",
  "Buttons",
  "Threads",
  "Screen Printing",
  "Digital Printing",
  "Washing",
  "Embroidery",
  "Trimmings",
  "Labels & Tags",
  "Packing Material",
  "Logistics",
  "Other",
];

const CAT_ICONS: Record<string, any> = {
  "Fabric": Globe,
  "Buttons": Zap,
  "Threads": Heart,
  "Screen Printing": PaletteIcon,
  "Digital Printing": Zap,
  "Washing": Waves,
  "Embroidery": Sparkles,
  "Trimmings": Scissors,
  "Labels & Tags": ShieldCheck,
  "Packing Material": Package,
  "Logistics": Building2,
  "Other": Briefcase,
};

export default function VendorsPage() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    const searchVal = searchParams.get("search");
    if (searchVal) {
      setQ(searchVal);
    }
    const catVal = searchParams.get("category");
    if (catVal) {
      setFilterCategory(catVal);
    }
  }, [searchParams]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    mobile: "",
    category: "Fabric",
    customCategory: "",
    contactPerson: "",
    email: "",
    pricingNotes: "",
    leadTimeDays: "",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/vendors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load vendors");
      setVendors(data);
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast("Name is required", "err");
    if (form.category === "Other" && !form.customCategory.trim()) {
      return showToast("Please specify the category", "err");
    }

    setSubmitting(true);
    try {
      const url = editingId 
        ? `/api/admin/manufacturing/vendors/${editingId}`
        : "/api/admin/manufacturing/vendors";
      const method = editingId ? "PUT" : "POST";

      const finalCategory = form.category === "Other" ? form.customCategory.trim() : form.category;

      const res = await mfgFetch(url, {
        method,
        body: JSON.stringify({
          ...form,
          category: finalCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      showToast(editingId ? "Vendor updated" : "Vendor added");
      setModalOpen(false);
      setEditingId(null);
      setForm({ name: "", address: "", mobile: "", category: "Fabric", customCategory: "", contactPerson: "", email: "", pricingNotes: "", leadTimeDays: "", remarks: "" });
      loadVendors();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    const isStandard = CATEGORIES.includes(v.category);
    setForm({
      name: v.name,
      address: v.address || "",
      mobile: v.mobile || "",
      category: isStandard ? v.category : "Other",
      customCategory: isStandard ? "" : v.category,
      contactPerson: v.contactPerson || "",
      email: v.email || "",
      pricingNotes: v.pricingNotes || "",
      leadTimeDays: v.leadTimeDays != null ? String(v.leadTimeDays) : "",
      remarks: v.remarks || "",
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) return;

    try {
      const res = await mfgFetch(`/api/admin/manufacturing/vendors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      showToast("Vendor deleted");
      loadVendors();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const matchesQ = v.name.toLowerCase().includes(q.toLowerCase()) || 
                    (v.category && v.category.toLowerCase().includes(q.toLowerCase()));
    const matchesCat = !filterCategory || v.category === filterCategory;
    return matchesQ && matchesCat;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10 overflow-hidden"
    >
      {/* Vibrant Orb Backgrounds */}
      <div className="absolute -right-24 -top-24 w-96 h-96 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -left-24 top-1/2 w-72 h-72 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[200] max-w-[90vw] w-max px-4 py-3 rounded-[1rem] text-[12px] font-bold shadow-2xl flex items-center justify-center gap-2 border backdrop-blur-xl ${
              toast.type === "ok" 
                ? "bg-background/90 text-foreground border-foreground/10" 
                : "bg-rose-500 text-white border-rose-500/20"
            }`}
          >
            {toast.type === "ok" && <Check className="w-4 h-4 text-emerald-500" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner shrink-0">
             <Building2 className="w-5 h-5 text-foreground/40" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-foreground tracking-tight leading-none truncate uppercase">
              Vendors
            </h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Supply Chain · {vendors.length} nodes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
           <button
            onClick={loadVendors}
            disabled={loading}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ name: "", address: "", mobile: "", category: "Fabric", customCategory: "", contactPerson: "", email: "", pricingNotes: "", leadTimeDays: "", remarks: "" });
              setModalOpen(true);
            }}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/15"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.8 }}
        className="glass-card rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-6 flex flex-col gap-5"
      >
        {/* Filters & Search */}
        <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
          <div className="relative w-full sm:max-w-md group">
             <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-foreground transition-colors" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search nodes..."
              className="w-full bg-background/50 border border-foreground/10 rounded-xl pl-10 pr-4 py-2 lg:py-2.5 text-[12px] font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30 transition-all shadow-sm focus:shadow-xl focus:bg-background"
            />
          </div>

          <div className="bg-foreground/[0.03] backdrop-blur-xl rounded-2xl p-1.5 border border-foreground/5 w-full xl:w-auto overflow-hidden shadow-inner">
            <div className="flex overflow-x-auto custom-scrollbar gap-2 py-1 px-1 hide-scroll">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all flex items-center gap-2 ${
                  !filterCategory
                    ? "bg-foreground text-background shadow-2xl scale-[1.02]"
                    : "text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground"
                }`}
              >
                All Nodes
              </button>
              {CATEGORIES.map((cat) => {
                const Icon = CAT_ICONS[cat] || Briefcase;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-all flex items-center gap-2 group ${
                      filterCategory === cat
                        ? "bg-foreground text-background shadow-2xl scale-[1.02]"
                        : "text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${filterCategory === cat ? "text-background" : "text-foreground/30 group-hover:text-foreground"}`} strokeWidth={2.5} />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-foreground/5" />

        {loading && vendors.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
            <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Loading vendors...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Building2 className="w-12 h-12 text-foreground/20 mb-4" />
            <p className="text-[13px] font-bold text-foreground/60">No vendors found</p>
            <p className="text-[11px] text-foreground/40 mt-1">Adjust search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVendors.map((v, i) => {
              const Icon = CAT_ICONS[v.category] || Building2;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  key={v.id}
                  className="bg-background/40 backdrop-blur-3xl border border-foreground/[0.06] hover:border-foreground/15 rounded-[1.2rem] p-3 lg:p-5 shadow-sm hover:shadow-xl transition-all duration-500 group flex flex-col relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  
                  <div className="flex justify-between items-start gap-2 mb-3 relative z-10">
                    <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 border border-foreground/5 group-hover:bg-foreground group-hover:text-background transition-all duration-500">
                       <Icon className="w-3.5 h-3.5 text-foreground/40 group-hover:text-background" strokeWidth={2.5} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-foreground/[0.04] border border-foreground/5 text-[7px] font-bold text-foreground/40 uppercase tracking-[0.15em] leading-none">
                      {v.category}
                    </span>
                  </div>
                  
                  <h3 className="text-[14px] font-bold text-foreground leading-tight tracking-tight mb-3 group-hover:text-foreground/80 transition-colors relative z-10">
                    {v.name}
                  </h3>
                  
                  <div className="space-y-2 flex-1 mb-4 relative z-10 border-t border-foreground/5 pt-3">
                    {v.contactPerson && (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-foreground/50 tracking-tight">
                        <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 border border-foreground/5">
                          <User className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                        </div>
                        <span className="truncate font-bold text-foreground/75">{v.contactPerson}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-medium text-foreground/50 tracking-tight">
                      <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 border border-foreground/5">
                        <Phone className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                      </div>
                      <span className="truncate font-mono">{v.mobile || "N/A"}</span>
                    </div>
                    {v.email && (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-foreground/50 tracking-tight">
                        <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 border border-foreground/5">
                          <Mail className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                        </div>
                        <span className="truncate font-mono">{v.email}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-[10px] font-medium text-foreground/50 tracking-tight leading-relaxed">
                      <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 mt-0.5 border border-foreground/5">
                        <MapPin className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                      </div>
                      <span className="line-clamp-2">{v.address || "No address"}</span>
                    </div>
                    {v.leadTimeDays !== null && v.leadTimeDays !== undefined && (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-foreground/50 tracking-tight">
                        <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 border border-foreground/5">
                          <Clock className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                        </div>
                        <span>Lead Time: <strong className="font-mono text-foreground/70">{v.leadTimeDays} days</strong></span>
                      </div>
                    )}
                    {v.pricingNotes && (
                      <div className="flex items-start gap-2 text-[10px] font-medium text-foreground/50 tracking-tight leading-relaxed">
                        <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 mt-0.5 border border-foreground/5">
                          <ClipboardList className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                        </div>
                        <span className="line-clamp-2">Rates: {v.pricingNotes}</span>
                      </div>
                    )}
                    {v.remarks && (
                      <div className="flex items-start gap-2 text-[10px] font-medium text-foreground/50 tracking-tight leading-relaxed">
                        <div className="w-6 h-6 rounded-md bg-foreground/[0.03] flex items-center justify-center shrink-0 mt-0.5 border border-foreground/5">
                          <MessageSquare className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
                        </div>
                        <span className="line-clamp-2 text-foreground/40 italic">"{v.remarks}"</span>
                      </div>
                    )}
                  </div>
  
                  <div className="flex gap-2 pt-3 border-t border-foreground/[0.03] relative z-10">
                    <button
                      onClick={() => openEdit(v)}
                      className="flex-1 px-2 py-2 bg-background/50 border border-foreground/10 rounded-lg text-[8px] font-bold uppercase tracking-[0.15em] text-foreground/40 hover:text-foreground hover:bg-foreground hover:text-background transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Edit2 className="w-2.5 h-2.5" strokeWidth={2.5} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      className="w-8 h-8 bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 rounded-lg flex items-center justify-center transition-all text-rose-500 hover:text-white active:scale-90 group/del"
                    >
                      <Trash2 className="w-3 h-3 transition-transform group-hover/del:scale-110" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">{editingId ? "Edit Vendor" : "Add Vendor"}</h2>
                <p className="text-[12px] text-foreground/60 mt-1 tracking-wide">Enter vendor details carefully.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Vendor Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Apex Textiles"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm"
                  />
                </div>

                 <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm appearance-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {form.category === "Other" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Custom Category *</label>
                    <input
                      required
                      value={form.customCategory}
                      onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                      placeholder="e.g. Specialized Dyeing"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm"
                    />
                  </motion.div>
                )}

                 <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Mobile</label>
                  <input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm font-mono"
                  />
                </div>

                 <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    rows={3}
                    placeholder="Street address, City, Pincode"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. contact@vendor.com"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    value={form.leadTimeDays}
                    onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                    placeholder="e.g. 7"
                    min="0"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Pricing / Rate Notes</label>
                  <textarea
                    value={form.pricingNotes}
                    onChange={(e) => setForm({ ...form, pricingNotes: e.target.value })}
                    rows={2}
                    placeholder="e.g. Rs. 150/meter for GSM 200 cotton"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    rows={2}
                    placeholder="Additional details..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all shadow-sm resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[11px] font-bold text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-foreground/10"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Create Vendor"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
