"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  Palette, Plus, Search, RefreshCw, Edit, Trash2, X, ChevronRight, Download, 
  Upload, Eye, Check, Loader2, ArrowLeftRight, Beaker, FileText, ClipboardList, Activity, ArrowRight 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

const CATEGORIES = ["Hoodie", "T-Shirt", "Leather Jacket", "Denim Jacket", "Sweatshirt", "Joggers", "Other"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["Not Started", "In Progress", "Submitted", "Approved", "Rejected"];

export default function DesignsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [designs, setDesigns] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [selCollection, setSelCollection] = useState("All");
  const [selCategory, setSelCategory] = useState("All");
  const [selStatus, setSelStatus] = useState("All");
  const [selPriority, setSelPriority] = useState("All");

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals / Panels
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "attachments" | "sample" | "revisions" | "activity">("overview");

  // Add/Edit Attachment Modals
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attType, setAttType] = useState("Reference Image");
  const [attUrl, setAttUrl] = useState("");
  const [attName, setAttName] = useState("");

  // Submit Sample Modal
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleForm, setSampleForm] = useState({
    fabricType: "",
    gsm: "",
    composition: "",
    printingTechnique: "",
    embroideryDetails: "",
    accessoriesUsed: "",
    vendorId: "",
    remarks: ""
  });

  // Designer revision response state
  const [designerRevisionResponse, setDesignerRevisionResponse] = useState("");

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [designForm, setDesignForm] = useState({
    collectionId: "",
    productCategory: "Hoodie",
    styleName: "",
    styleCode: "",
    assignedToId: "",
    submissionDeadline: "",
    priority: "MEDIUM",
    notes: ""
  });

  const [newColForm, setNewColForm] = useState({
    name: "",
    season: "",
    status: "ACTIVE"
  });

  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch designs
      const url = new URL("/api/admin/manufacturing/designs", window.location.origin);
      if (selCollection !== "All") url.searchParams.set("collectionId", selCollection);
      if (selStatus !== "All") url.searchParams.set("status", selStatus);
      const res = await mfgFetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load designs");
      setDesigns(data);

      // Fetch collections
      const colRes = await mfgFetch("/api/admin/manufacturing/collections");
      const colData = await colRes.json();
      if (colRes.ok) setCollections(colData);

      // Fetch Users
      const usersRes = await mfgFetch("/api/admin/users/list");
      const usersData = await usersRes.json();
      if (usersRes.ok) setUsers(usersData);

      // Fetch Vendors
      const vendorsRes = await mfgFetch("/api/admin/manufacturing/vendors");
      const vendorsData = await vendorsRes.json();
      if (vendorsRes.ok) setVendors(vendorsData);

    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [selCollection, selStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Assign Modal if ?new=true or pre-fill search 'q'
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setAssignModalOpen(true);
      // Strip query param so it doesn't reopen
      router.replace("/dashboard/manufacturing/designs");
    }
    const queryQ = searchParams.get("q");
    if (queryQ) {
      setQ(queryQ);
    }
  }, [searchParams, router]);

  useEffect(() => {
    const designId = searchParams.get("designId");
    if (designId && designs.length > 0) {
      const found = designs.find(d => d.id === designId);
      if (found) {
        openSlideOver(found);
      }
    }
  }, [searchParams, designs]);

  // Auto styleCode generation helper
  const handleCategoryChange = (cat: string) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const catClean = cat.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const catCode = catClean.substring(0, 3).padEnd(3, "X");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    setDesignForm(prev => ({
      ...prev,
      productCategory: cat,
      styleCode: `ZB${year}${catCode}${rand}`
    }));
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColForm.name.trim()) return showToast("Collection Name is required", "err");
    setSubmitting(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/collections", {
        method: "POST",
        body: JSON.stringify(newColForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create collection");
      
      showToast("Collection added");
      setCollectionModalOpen(false);
      setNewColForm({ name: "", season: "", status: "ACTIVE" });
      
      // Reload collections and pre-select new one
      const colRes = await mfgFetch("/api/admin/manufacturing/collections");
      const colData = await colRes.json();
      if (colRes.ok) {
        setCollections(colData);
        setDesignForm(prev => ({ ...prev, collectionId: data.id }));
      }
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDesignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designForm.collectionId || !designForm.styleName || !designForm.styleCode) {
      return showToast("Please fill all required fields", "err");
    }
    setSubmitting(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId 
        ? `/api/admin/manufacturing/designs/${editingId}`
        : "/api/admin/manufacturing/designs";

      const currentUserId = (session?.user as any)?.id || null;

      const payload = editingId ? {
        priority: designForm.priority,
        notes: designForm.notes,
        submissionDeadline: designForm.submissionDeadline
      } : {
        ...designForm,
        assignedById: currentUserId
      };

      const res = await mfgFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save design assignment");

      showToast(editingId ? "Assignment updated" : "Assignment created");
      setAssignModalOpen(false);
      setEditingId(null);
      setDesignForm({
        collectionId: "",
        productCategory: "Hoodie",
        styleName: "",
        styleCode: "",
        assignedToId: "",
        submissionDeadline: "",
        priority: "MEDIUM",
        notes: ""
      });
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (d: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(d.id);
    setDesignForm({
      collectionId: d.collectionId,
      productCategory: d.productCategory,
      styleName: d.styleName,
      styleCode: d.styleCode,
      assignedToId: d.assignedToId || "",
      submissionDeadline: d.submissionDeadline ? d.submissionDeadline.split("T")[0] : "",
      priority: d.priority,
      notes: d.notes || ""
    });
    setAssignModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this design assignment? This will permanently delete all attachments and samples on record.")) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Deletion failed");
      showToast("Design deleted");
      if (selectedDesign?.id === id) setSlideOverOpen(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const openSlideOver = async (d: any) => {
    setSelectedDesign(d);
    setDetailTab("overview");
    setSlideOverOpen(true);
    
    // Refresh specific design details to get revisions/images/logs
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${d.id}`);
      const data = await res.json();
      if (res.ok) setSelectedDesign(data);
    } catch {}
  };

  const refreshSlideOver = async () => {
    if (!selectedDesign) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${selectedDesign.id}`);
      const data = await res.json();
      if (res.ok) setSelectedDesign(data);
    } catch {}
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedDesign) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${selectedDesign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error("Status update failed");
      showToast("Status updated");
      refreshSlideOver();
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attUrl.trim()) return showToast("File URL is required", "err");
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${selectedDesign.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ type: attType, fileUrl: attUrl, fileName: attName || null })
      });
      if (!res.ok) throw new Error("Attachment creation failed");
      showToast("Attachment uploaded");
      setAttachmentModalOpen(false);
      setAttUrl("");
      setAttName("");
      refreshSlideOver();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/designs/${selectedDesign.id}/attachments/${attachmentId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete attachment");
      showToast("Attachment deleted");
      refreshSlideOver();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const handleSampleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/samples", {
        method: "POST",
        body: JSON.stringify({
          ...sampleForm,
          designAssignmentId: selectedDesign.id,
          styleCode: selectedDesign.styleCode,
          productName: selectedDesign.styleName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit sample");
      showToast("Sample submitted for QC");
      setSampleModalOpen(false);
      setSampleForm({
        fabricType: "",
        gsm: "",
        composition: "",
        printingTechnique: "",
        embroideryDetails: "",
        accessoriesUsed: "",
        vendorId: "",
        remarks: ""
      });
      refreshSlideOver();
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const submitRevisionResponse = async (sampleId: string, revisionId: string) => {
    if (!designerRevisionResponse.trim()) return showToast("Response is required", "err");
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${sampleId}/revisions`, {
        method: "PATCH",
        body: JSON.stringify({
          revisionId,
          designerResponse: designerRevisionResponse,
          resubmissionDate: new Date()
        })
      });
      if (!res.ok) throw new Error("Failed to submit response");
      showToast("Response submitted. Sample is now back in review.");
      setDesignerRevisionResponse("");
      refreshSlideOver();
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter clientside
  const filteredDesigns = designs.filter(d => {
    const matchesSearch = d.styleCode.toLowerCase().includes(q.toLowerCase()) || 
                          d.styleName.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = selCategory === "All" || d.productCategory === selCategory;
    const matchesPriority = selPriority === "All" || d.priority === selPriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });

  const totalPages = Math.ceil(filteredDesigns.length / limit);
  const paginatedDesigns = filteredDesigns.slice((page - 1) * limit, page * limit);

  // Badge stylings
  const statusColor = (status: string) => {
    switch (status) {
      case "Not Started": return "bg-foreground/5 text-foreground/40 border border-foreground/10";
      case "In Progress": return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "Submitted": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Approved": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      default: return "bg-foreground/5 text-foreground/40";
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "URGENT": return "bg-rose-500 text-white shadow-sm shadow-rose-500/25";
      case "HIGH": return "bg-orange-500 text-white shadow-sm shadow-orange-500/25";
      case "MEDIUM": return "bg-amber-400 text-background font-bold";
      case "LOW": return "bg-foreground/5 text-foreground/45 border border-foreground/10";
      default: return "bg-foreground/5 text-foreground/50";
    }
  };

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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
            <Palette className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Design Assignments</h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Design Studio · {filteredDesigns.length} assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setDesignForm({
                collectionId: collections[0]?.id || "",
                productCategory: "Hoodie",
                styleName: "",
                styleCode: "",
                assignedToId: "",
                submissionDeadline: "",
                priority: "MEDIUM",
                notes: ""
              });
              // Generate initial style code for default Hoodie
              const year = new Date().getFullYear().toString().slice(-2);
              const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
              setDesignForm(prev => ({
                ...prev,
                styleCode: `ZB${year}HOO${rand}`
              }));
              setAssignModalOpen(true);
            }}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/15"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Assign Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-[1.5rem] p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search assignments (Style Code or Name)..."
            className="w-full bg-background/50 border border-foreground/10 rounded-xl pl-10 pr-4 py-2 text-[12px] font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"
          />
        </div>

        {/* Collection Dropdown */}
        <select
          value={selCollection}
          onChange={(e) => setSelCollection(e.target.value)}
          className="bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
        >
          <option value="All">All Collections</option>
          {collections.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.season || "No Season"})</option>
          ))}
        </select>

        {/* Category Dropdown */}
        <select
          value={selCategory}
          onChange={(e) => setSelCategory(e.target.value)}
          className="bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={selStatus}
          onChange={(e) => setSelStatus(e.target.value)}
          className="bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Priority Dropdown */}
        <select
          value={selPriority}
          onChange={(e) => setSelPriority(e.target.value)}
          className="bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
        >
          <option value="All">All Priorities</option>
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Main Table View */}
      <div className="glass-card rounded-[1.5rem] overflow-hidden">
        {loading && designs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
            <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Loading Design Studio...</p>
          </div>
        ) : paginatedDesigns.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Palette className="w-12 h-12 text-foreground/20 mb-4" />
            <p className="text-[13px] font-bold text-foreground/60">No assignments found</p>
            <p className="text-[11px] text-foreground/40 mt-1">Refine filters or add a new design assignment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-foreground/15 text-[10px] uppercase font-bold text-foreground/50 tracking-widest bg-foreground/[0.01]">
                  <th className="px-6 py-4">Style Code</th>
                  <th className="px-6 py-4">Style Name</th>
                  <th className="px-6 py-4">Collection</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Deadline</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {paginatedDesigns.map((d) => (
                  <tr 
                    key={d.id} 
                    onClick={() => openSlideOver(d)}
                    className="hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors cursor-pointer text-xs"
                  >
                    <td className="px-6 py-4 font-mono font-bold tracking-tight text-[11px]">{d.styleCode}</td>
                    <td className="px-6 py-4 font-bold text-sm">{d.styleName}</td>
                    <td className="px-6 py-4 text-foreground/60">{d.collection?.name || "-"}</td>
                    <td className="px-6 py-4 text-foreground/60">{d.productCategory}</td>
                    <td className="px-6 py-4 text-foreground/60">{d.assignedTo?.name || "Unassigned"}</td>
                    <td className="px-6 py-4 text-foreground/60 font-medium">{d.submissionDeadline ? formatDateTimeIST(d.submissionDeadline).split(",")[0] : "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${priorityColor(d.priority)}`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusColor(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={(e) => openEdit(d, e)}
                        className="p-1.5 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-foreground/65 hover:text-foreground transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(d.id, e)}
                        className="p-1.5 bg-rose-500/5 hover:bg-rose-500 hover:text-white rounded-lg text-rose-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-foreground/5 flex justify-between items-center bg-foreground/[0.01]">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3.5 py-1.5 bg-background border border-foreground/10 text-foreground text-[10px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50 hover:bg-foreground/[0.02] active:scale-95 transition-all"
            >
              Previous
            </button>
            <span className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest font-mono">
              Page {page} of {totalPages}
            </span>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-3.5 py-1.5 bg-background border border-foreground/10 text-foreground text-[10px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50 hover:bg-foreground/[0.02] active:scale-95 transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* --- Assign Design Task Modal --- */}
      <AnimatePresence>
        {assignModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass-card rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-lg lg:text-xl font-bold uppercase tracking-tight text-foreground">
                  {editingId ? "Edit Design Assignment" : "Assign Design Task"}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">
                  Design Studio · Configure Style
                </p>
              </div>

              <form onSubmit={handleDesignSubmit} className="space-y-4">
                {/* Collection Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50">Collection *</label>
                    <button 
                      type="button" 
                      onClick={() => setCollectionModalOpen(true)}
                      className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground flex items-center gap-0.5"
                    >
                      [+ New Collection]
                    </button>
                  </div>
                  <select
                    disabled={!!editingId}
                    required
                    value={designForm.collectionId}
                    onChange={(e) => setDesignForm({ ...designForm, collectionId: e.target.value })}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all appearance-none disabled:opacity-50"
                  >
                    <option value="" disabled>Select collection...</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.season || "No Season"})</option>
                    ))}
                  </select>
                </div>

                {/* Product Category & Style Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Product Category *</label>
                    <select
                      disabled={!!editingId}
                      value={designForm.productCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all disabled:opacity-50"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Style Name *</label>
                    <input
                      disabled={!!editingId}
                      required
                      value={designForm.styleName}
                      onChange={(e) => setDesignForm({ ...designForm, styleName: e.target.value })}
                      placeholder="e.g. Dusk Leather Bomber"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Style Code (auto-populated and editable) */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Style Code (Unique Identifier) *</label>
                  <input
                    disabled={!!editingId}
                    required
                    value={designForm.styleCode}
                    onChange={(e) => setDesignForm({ ...designForm, styleCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. ZB26HOO1234"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-mono text-foreground focus:outline-none focus:border-foreground/30 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Assigned To */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Assigned To (Designer) *</label>
                  <select
                    disabled={!!editingId}
                    value={designForm.assignedToId}
                    onChange={(e) => setDesignForm({ ...designForm, assignedToId: e.target.value })}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all disabled:opacity-50"
                  >
                    <option value="">Select designer...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                    ))}
                  </select>
                </div>

                {/* Submission Deadline & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Submission Deadline *</label>
                    <input
                      required
                      type="date"
                      value={designForm.submissionDeadline}
                      onChange={(e) => setDesignForm({ ...designForm, submissionDeadline: e.target.value })}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Priority</label>
                    <select
                      value={designForm.priority}
                      onChange={(e) => setDesignForm({ ...designForm, priority: e.target.value })}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Design Notes & Specification requirements</label>
                  <textarea
                    value={designForm.notes}
                    onChange={(e) => setDesignForm({ ...designForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Enter style briefing, fabric recommendations, stitching requirements..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all resize-none"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Assign Design"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Mini Modal: Add New Collection --- */}
      <AnimatePresence>
        {collectionModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Create New Collection</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Manufacturing Hub Season Registry</p>
              </div>

              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">Collection Name *</label>
                  <input
                    required
                    value={newColForm.name}
                    onChange={(e) => setNewColForm({ ...newColForm, name: e.target.value })}
                    placeholder="e.g. Core Manifesto"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">Season / Year</label>
                  <input
                    value={newColForm.season}
                    onChange={(e) => setNewColForm({ ...newColForm, season: e.target.value })}
                    placeholder="e.g. FW26"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCollectionModalOpen(false)}
                    className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-1 py-2.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-widest rounded-xl hover:opacity-95"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Save Collection"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Design Detail Slide-Over Panel --- */}
      <AnimatePresence>
        {slideOverOpen && selectedDesign && (
          <div className="fixed inset-0 z-[140] flex justify-end">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlideOverOpen(false)}
              className="absolute inset-0 bg-background/50 backdrop-blur-sm"
            />
            
            {/* Slide-over panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-[600px] h-full bg-background/95 backdrop-blur-2xl border-l border-foreground/10 shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-foreground/10 flex justify-between items-start gap-4 shrink-0 bg-background/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold tracking-tight text-[12px] bg-foreground/[0.04] border border-foreground/10 px-2 py-0.5 rounded-full text-foreground/50">{selectedDesign.styleCode}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${priorityColor(selectedDesign.priority)}`}>{selectedDesign.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusColor(selectedDesign.status)}`}>{selectedDesign.status}</span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">{selectedDesign.styleName}</h2>
                </div>
                <button 
                  onClick={() => setSlideOverOpen(false)}
                  className="p-1.5 hover:bg-foreground/5 rounded-xl text-foreground/40 hover:text-foreground transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs list */}
              <div className="px-6 py-2 border-b border-foreground/5 flex gap-4 text-[10px] font-bold uppercase tracking-wider shrink-0 bg-foreground/[0.01]">
                {(["overview", "attachments", "sample", "revisions", "activity"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`pb-2 border-b-2 transition-all ${
                      detailTab === tab 
                        ? "border-foreground text-foreground" 
                        : "border-transparent text-foreground/40 hover:text-foreground/75"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scrollable Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* 1. Overview Tab */}
                {detailTab === "overview" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Collection</div>
                        <div className="text-xs font-bold mt-1">{selectedDesign.collection?.name || "-"}</div>
                      </div>
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Product Category</div>
                        <div className="text-xs font-bold mt-1">{selectedDesign.productCategory}</div>
                      </div>
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Assigned To</div>
                        <div className="text-xs font-bold mt-1">{selectedDesign.assignedTo?.name || "Unassigned"}</div>
                      </div>
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Assigned By</div>
                        <div className="text-xs font-bold mt-1">{selectedDesign.assignedBy?.name || "System"}</div>
                      </div>
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Assignment Date</div>
                        <div className="text-xs font-bold mt-1">{formatDateTimeIST(selectedDesign.assignmentDate).split(",")[0]}</div>
                      </div>
                      <div className="p-3 bg-foreground/[0.02] border border-foreground/5 rounded-xl">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Submission Deadline</div>
                        <div className="text-xs font-bold mt-1 text-amber-400">{selectedDesign.submissionDeadline ? formatDateTimeIST(selectedDesign.submissionDeadline).split(",")[0] : "-"}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-foreground/5 pt-4">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50">Update Design Status</label>
                      <select
                        value={selectedDesign.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] text-foreground focus:outline-none"
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {selectedDesign.notes && (
                      <div className="space-y-1.5 border-t border-foreground/5 pt-4">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/50">Briefing & Notes</div>
                        <p className="text-xs text-foreground/80 bg-foreground/[0.01] border border-foreground/5 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">{selectedDesign.notes}</p>
                      </div>
                    )}

                    {(selectedDesign.status === "In Progress" || selectedDesign.status === "Submitted") && (
                      <button 
                        onClick={() => setDetailTab("sample")}
                        className="w-full py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1 shadow-md"
                      >
                        <Beaker className="w-4 h-4" /> Request / Submit Sample
                      </button>
                    )}
                  </div>
                )}

                {/* 2. Attachments Tab */}
                {detailTab === "attachments" && (
                  <div className="space-y-6">
                    {(["Reference Image", "Mood Board", "Design File", "Tech Pack"] as const).map(type => {
                      const files = (selectedDesign.attachments || []).filter((a: any) => a.type === type);
                      return (
                        <div key={type} className="space-y-3 bg-foreground/[0.01] border border-foreground/5 p-4 rounded-xl">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground/60">{type}s</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setAttType(type);
                                setAttachmentModalOpen(true);
                              }}
                              className="text-[9px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground flex items-center gap-0.5"
                            >
                              [+ Add {type}]
                            </button>
                          </div>

                          {files.length === 0 ? (
                            <p className="text-[10px] text-foreground/35 uppercase tracking-widest py-2">No {type}s uploaded</p>
                          ) : (
                            <div className="space-y-2">
                              {files.map((f: any) => (
                                <div key={f.id} className="flex justify-between items-center p-2.5 bg-background/40 border border-foreground/5 rounded-lg text-xs">
                                  <span className="truncate max-w-[250px] font-medium">{f.fileName || "Unnamed file"}</span>
                                  <div className="flex items-center gap-2">
                                    <a href={f.fileUrl} target="_blank" rel="noreferrer" className="p-1 bg-foreground/5 hover:bg-foreground/10 rounded text-foreground/70 hover:text-foreground">
                                      <Eye className="w-3.5 h-3.5" />
                                    </a>
                                    <button 
                                      onClick={() => handleDeleteAttachment(f.id)}
                                      className="p-1 bg-rose-500/5 hover:bg-rose-500 hover:text-white rounded text-rose-400"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Sample Tab */}
                {detailTab === "sample" && (
                  <div className="space-y-6">
                    {selectedDesign.samples && selectedDesign.samples.length > 0 ? (
                      selectedDesign.samples.map((s: any) => (
                        <div key={s.id} className="glass-card rounded-xl p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Physical Sample</div>
                              <h4 className="text-sm font-bold mt-0.5">{s.productName}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${statusColor(s.status)}`}>
                              {s.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed border-t border-foreground/5 pt-3">
                            <div><span className="text-foreground/40 font-bold uppercase text-[9px] tracking-wider block">Fabric Type:</span> {s.fabricType || "-"}</div>
                            <div><span className="text-foreground/40 font-bold uppercase text-[9px] tracking-wider block">GSM / Composition:</span> {s.gsm || "-"} / {s.composition || "-"}</div>
                            <div><span className="text-foreground/40 font-bold uppercase text-[9px] tracking-wider block">Printing Technique:</span> {s.printingTechnique || "-"}</div>
                            <div><span className="text-foreground/40 font-bold uppercase text-[9px] tracking-wider block">Vendor:</span> {s.vendor?.name || "-"}</div>
                          </div>

                          {s.status === "Revision Required" && s.revisions && s.revisions.length > 0 && (
                            <div className="p-3 border border-rose-500/20 bg-rose-500/5 text-rose-300 rounded-lg text-xs space-y-1">
                              <span className="font-bold uppercase text-[9px] tracking-wider block text-rose-400">Latest Revision Request:</span>
                              <p className="italic">"{s.revisions[s.revisions.length - 1].changeRequests}"</p>
                            </div>
                          )}

                          <Link href={`/dashboard/manufacturing/samples/${s.id}`}>
                            <button className="w-full py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1 mt-2">
                              View Full Sample Details <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center border border-dashed border-foreground/15 rounded-2xl flex flex-col items-center justify-center p-6 space-y-4">
                        <Beaker className="w-10 h-10 text-foreground/20" />
                        <div className="space-y-1 text-center">
                          <p className="text-sm font-bold text-foreground/60">No sample submitted yet</p>
                          <p className="text-[11px] text-foreground/35 max-w-xs">Coordinate with vendors to build a physical prototype of this design assignment.</p>
                        </div>
                        <button
                          onClick={() => setSampleModalOpen(true)}
                          className="px-5 py-2 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90"
                        >
                          Submit Sample Run
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Revisions Tab */}
                {detailTab === "revisions" && (
                  <div className="space-y-6">
                    {selectedDesign.samples && selectedDesign.samples.some((s: any) => s.revisions && s.revisions.length > 0) ? (
                      selectedDesign.samples.flatMap((s: any) => (s.revisions || []).map((r: any) => (
                        <div key={r.id} className="p-4 bg-foreground/[0.02] border border-foreground/5 rounded-xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] font-bold uppercase tracking-widest">Revision #{r.revisionNumber}</span>
                            <span className="text-[10px] text-foreground/45 font-mono">{formatDateTimeIST(r.createdAt)}</span>
                          </div>
                          
                          <div className="space-y-1 text-xs">
                            <span className="text-rose-400 font-bold uppercase text-[9px] tracking-wider block">Change Requests:</span>
                            <p className="text-foreground/80 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 font-medium">"{r.changeRequests}"</p>
                          </div>

                          <div className="space-y-1 text-xs">
                            <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider block">Designer Response:</span>
                            {r.designerResponse ? (
                              <p className="text-foreground/80 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 font-medium">"{r.designerResponse}"</p>
                            ) : (
                              <>
                                {/* Show submission response box if logged user is the designer and revision needs response */}
                                {s.status === "Revision Required" && (
                                  <div className="space-y-2 mt-2">
                                    <textarea
                                      value={designerRevisionResponse}
                                      onChange={(e) => setDesignerRevisionResponse(e.target.value)}
                                      rows={2}
                                      placeholder="Write your explanation, changes made, resubmission details..."
                                      className="w-full bg-background border border-foreground/10 rounded-xl p-3 text-[12px] text-foreground focus:outline-none"
                                    />
                                    <button
                                      disabled={submitting}
                                      onClick={() => submitRevisionResponse(s.id, r.id)}
                                      className="px-4 py-2 bg-foreground text-background text-[9px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90"
                                    >
                                      {submitting ? "Submitting..." : "Submit Response"}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )))
                    ) : (
                      <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                        No revision records on file
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Activity Tab */}
                {detailTab === "activity" && (
                  <div className="space-y-4">
                    {selectedDesign.auditLogs && selectedDesign.auditLogs.length > 0 ? (
                      <div className="relative pl-4 border-l border-foreground/10 space-y-4 py-2">
                        {selectedDesign.auditLogs.map((log: any) => (
                          <div key={log.id} className="relative space-y-1 text-xs">
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-foreground/30 border-2 border-background" />
                            <div className="flex items-center justify-between text-[10px] text-foreground/40">
                              <span className="font-bold uppercase tracking-wider">{log.action}</span>
                              <span className="font-mono">{formatDateTimeIST(log.createdAt)}</span>
                            </div>
                            <p className="font-medium text-foreground/80 leading-snug">
                              By <span className="font-bold text-foreground">{log.actorName}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                        No activity logged
                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Add Attachment Modal --- */}
      <AnimatePresence>
        {attachmentModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Add Design Attachment</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Attach specs, sketches, or tech packs</p>
              </div>

              <form onSubmit={handleAddAttachment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Attachment Type</label>
                  <select
                    value={attType}
                    onChange={(e) => setAttType(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  >
                    <option value="Reference Image">Reference Image</option>
                    <option value="Mood Board">Mood Board</option>
                    <option value="Design File">Design File</option>
                    <option value="Tech Pack">Tech Pack</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">File Name / Label</label>
                  <input
                    required
                    value={attName}
                    onChange={(e) => setAttName(e.target.value)}
                    placeholder="e.g. bomber-stitching-guide.pdf"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">File Link / URL *</label>
                  <input
                    required
                    value={attUrl}
                    onChange={(e) => setAttUrl(e.target.value)}
                    placeholder="https://workdrive.zoho.in/..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAttachmentModalOpen(false)}
                    className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-1 py-2.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-widest rounded-xl hover:opacity-95"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Attach File"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Submit Sample Run Modal --- */}
      <AnimatePresence>
        {sampleModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass-card rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-lg lg:text-xl font-bold uppercase tracking-tight text-foreground">Submit Sample Run</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Physical Product Quality Control</p>
              </div>

              <form onSubmit={handleSampleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Fabric Type</label>
                    <input
                      value={sampleForm.fabricType}
                      onChange={(e) => setSampleForm({ ...sampleForm, fabricType: e.target.value })}
                      placeholder="e.g. Heavyweight Cotton Terry"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">GSM</label>
                    <input
                      value={sampleForm.gsm}
                      onChange={(e) => setSampleForm({ ...sampleForm, gsm: e.target.value })}
                      placeholder="e.g. 450"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Composition</label>
                  <input
                    value={sampleForm.composition}
                    onChange={(e) => setSampleForm({ ...sampleForm, composition: e.target.value })}
                    placeholder="e.g. 100% Organic Cotton"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Printing Technique</label>
                    <input
                      value={sampleForm.printingTechnique}
                      onChange={(e) => setSampleForm({ ...sampleForm, printingTechnique: e.target.value })}
                      placeholder="e.g. High density puff print"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Embroidery Details</label>
                    <input
                      value={sampleForm.embroideryDetails}
                      onChange={(e) => setSampleForm({ ...sampleForm, embroideryDetails: e.target.value })}
                      placeholder="e.g. Satin stitch logo"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Accessories Used</label>
                  <input
                    value={sampleForm.accessoriesUsed}
                    onChange={(e) => setSampleForm({ ...sampleForm, accessoriesUsed: e.target.value })}
                    placeholder="e.g. Custom YKK silver zipper, metal drawstring aglets"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Sample Vendor *</label>
                  <select
                    required
                    value={sampleForm.vendorId}
                    onChange={(e) => setSampleForm({ ...sampleForm, vendorId: e.target.value })}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Designer Remarks</label>
                  <textarea
                    value={sampleForm.remarks}
                    onChange={(e) => setSampleForm({ ...sampleForm, remarks: e.target.value })}
                    rows={2}
                    placeholder="Describe details regarding sizing fit, print positioning, quality notes..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSampleModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Sample Run"}
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
