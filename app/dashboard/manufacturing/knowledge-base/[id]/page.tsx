"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, User, Building, Edit, Save, Plus, Loader2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function KnowledgeBaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Editing notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");

  // Edit all fields modal
  const [editAllOpen, setEditAllOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    productName: "",
    designerId: "",
    fabricUsed: "",
    gsm: "",
    composition: "",
    printingTechnique: "",
    vendorId: "",
    accessoriesUsed: "",
    productionNotes: ""
  });

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/knowledge-base/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load entry details");
      setEntry(data);
      setNotesText(data.productionNotes || "");

      // Pre-fill form
      setForm({
        productName: data.productName || "",
        designerId: data.designerId || "",
        fabricUsed: data.fabricUsed || "",
        gsm: data.gsm || "",
        composition: data.composition || "",
        printingTechnique: data.printingTechnique || "",
        vendorId: data.vendorId || "",
        accessoriesUsed: data.accessoriesUsed || "",
        productionNotes: data.productionNotes || ""
      });

      // Load Users & Vendors list for drop-downs
      const usersRes = await mfgFetch("/api/admin/users/list");
      const usersData = await usersRes.json();
      if (usersRes.ok) setAllUsers(usersData);

      const vendorsRes = await mfgFetch("/api/admin/manufacturing/vendors");
      const vendorsData = await vendorsRes.json();
      if (vendorsRes.ok) setVendors(vendorsData);

    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveNotes = async () => {
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/knowledge-base/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ productionNotes: notesText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save production notes");
      showToast("Production notes updated");
      setEditingNotes(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAllSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/knowledge-base/${id}`, {
        method: "PATCH",
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record details");
      showToast("Knowledge Base record updated");
      setEditAllOpen(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !entry) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Opening Archive Page...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10"
    >
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

      {/* Back Button */}
      <div className="border-b border-foreground/5 pb-4">
        <Link href="/dashboard/manufacturing/knowledge-base" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/55 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Archive
        </Link>
      </div>

      {/* Main Glass Card */}
      <div className="glass-card rounded-[2rem] p-6 lg:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-foreground/5 pb-6">
          <div className="space-y-1">
            <span className="font-mono font-bold tracking-tight text-[11px] bg-foreground/[0.04] px-2.5 py-0.5 border border-foreground/5 rounded-full text-foreground/50">{entry.styleCode}</span>
            <h2 className="text-xl lg:text-2xl font-bold mt-1 text-foreground leading-tight">{entry.productName}</h2>
          </div>
          
          <div className="text-left sm:text-right font-medium">
            <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest leading-none">Approval Date</div>
            <div className="text-xs font-bold mt-1.5 text-foreground/80">
              {entry.approvalDate ? formatDateTimeIST(entry.approvalDate) : "-"}
            </div>
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Details */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 border-b border-foreground/5 pb-2">Technical Specifications</h3>
            
            <div className="space-y-3.5 text-xs font-medium">
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground/50">Designer / Creative Lead:</span>
                {entry.designerId ? (
                  <Link href={`/dashboard/manufacturing/employees/${entry.designerId}`} className="font-bold hover:underline flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-foreground/40" /> {entry.designer?.name || "Designer Profile"}
                  </Link>
                ) : (
                  <span className="font-bold">Unassigned</span>
                )}
              </div>

              <div className="flex justify-between py-1">
                <span className="text-foreground/50">Fabric Type Used:</span>
                <span className="font-bold">{entry.fabricUsed || "-"}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-foreground/50">Fabric GSM / Weight:</span>
                <span className="font-mono font-bold">{entry.gsm || "-"}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-foreground/50">Composition Specs:</span>
                <span className="font-bold">{entry.composition || "-"}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-foreground/50">Printing Technique:</span>
                <span className="font-bold">{entry.printingTechnique || "-"}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-foreground/50">Production Vendor:</span>
                {entry.vendor ? (
                  <Link href={`/dashboard/manufacturing/vendors`} className="font-bold hover:underline flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-foreground/40" /> {entry.vendor.name}
                  </Link>
                ) : (
                  <span className="font-bold">Unspecified</span>
                )}
              </div>

              <div className="flex justify-between py-1">
                <span className="text-foreground/50">Trimmings & Accessories:</span>
                <span className="font-bold text-right max-w-xs">{entry.accessoriesUsed || "-"}</span>
              </div>
            </div>

          </div>

          {/* Sample Images Gallery */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 border-b border-foreground/5 pb-2">Sample Run Photos</h3>
            
            {entry.sampleImages && entry.sampleImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {entry.sampleImages.map((url: string, index: number) => (
                  <a key={index} href={url} target="_blank" rel="noreferrer" className="block h-36 rounded-xl overflow-hidden border border-foreground/10 hover:border-foreground/30 transition-all bg-foreground/[0.02]">
                    <img src={url} alt={`Sample ${index + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-12 border border-dashed border-foreground/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-foreground/30">
                <BookOpen className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs uppercase font-bold tracking-widest">No images on record</span>
              </div>
            )}
          </div>

        </div>

        {/* Production Notes Text Editor */}
        <div className="space-y-4 border-t border-foreground/5 pt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">Production & Tailoring Notes</h3>
            {!editingNotes ? (
              <button
                type="button"
                onClick={() => setEditingNotes(true)}
                className="text-[9px] font-bold uppercase tracking-widest text-foreground/45 hover:text-foreground flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Notes
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveNotes}
                  className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesText(entry.productionNotes || "");
                  }}
                  className="text-[9px] font-bold uppercase tracking-widest text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            )}
          </div>

          {!editingNotes ? (
            <p className="text-xs text-foreground/80 bg-foreground/[0.01] p-5 rounded-2xl border border-foreground/5 leading-relaxed whitespace-pre-wrap min-h-24">
              {entry.productionNotes || "No specific tailoring or production remarks recorded on file. Double-click edit notes to write."}
            </p>
          ) : (
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={5}
              placeholder="Record tailoring guidelines, cutting specifications, stitching directions, wash tolerances details..."
              className="w-full bg-background border border-foreground/10 rounded-2xl p-4 text-xs text-foreground focus:outline-none resize-y"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-foreground/5 pt-6 bg-foreground/[0.01] px-4 py-3 rounded-2xl">
          <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 leading-none">Record auto-generated on sample approval</span>
          <button
            type="button"
            onClick={() => setEditAllOpen(true)}
            className="px-5 py-2.5 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            Edit All Fields
          </button>
        </div>

      </div>

      {/* --- Edit All Fields Modal --- */}
      <AnimatePresence>
        {editAllOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass-card rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-lg lg:text-xl font-bold uppercase tracking-tight text-foreground">Edit Product Specs</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Edit Knowledge Base Master File</p>
              </div>

              <form onSubmit={handleEditAllSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Product Name *</label>
                  <input
                    required
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="e.g. Dusk Bomber"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Designer</label>
                    <select
                      value={form.designerId}
                      onChange={(e) => setForm({ ...form, designerId: e.target.value })}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    >
                      <option value="">Select designer...</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Fabric Used</label>
                    <input
                      value={form.fabricUsed}
                      onChange={(e) => setForm({ ...form, fabricUsed: e.target.value })}
                      placeholder="e.g. Cotton French Terry"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">GSM</label>
                    <input
                      value={form.gsm}
                      onChange={(e) => setForm({ ...form, gsm: e.target.value })}
                      placeholder="e.g. 450"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-mono text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Composition</label>
                    <input
                      value={form.composition}
                      onChange={(e) => setForm({ ...form, composition: e.target.value })}
                      placeholder="e.g. 100% Organic Cotton"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Printing Technique</label>
                    <input
                      value={form.printingTechnique}
                      onChange={(e) => setForm({ ...form, printingTechnique: e.target.value })}
                      placeholder="e.g. puff print"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Production Vendor</label>
                    <select
                      value={form.vendorId}
                      onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    >
                      <option value="">Select vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Accessories Used</label>
                  <input
                    value={form.accessoriesUsed}
                    onChange={(e) => setForm({ ...form, accessoriesUsed: e.target.value })}
                    placeholder="e.g. zippers, metal tips"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Production Notes</label>
                  <textarea
                    value={form.productionNotes}
                    onChange={(e) => setForm({ ...form, productionNotes: e.target.value })}
                    rows={3}
                    placeholder="Tailoring requirements details..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditAllOpen(false)}
                    className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
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
