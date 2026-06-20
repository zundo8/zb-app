"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Beaker, Check, ShieldCheck, X, RefreshCw, Plus, Image as ImageIcon, 
  Trash2, Mail, User, Building, AlertTriangle, Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function SampleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [sample, setSample] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Gallery
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [addImageModalOpen, setAddImageModalOpen] = useState(false);

  // Form states
  const [adminComments, setAdminComments] = useState("");
  
  // Modals
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [changeRequests, setChangeRequests] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSample = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sample details");
      setSample(data);
      setAdminComments(data.adminComments || "");
      if (data.images && data.images.length > 0) {
        setActiveImage(data.images[0].imageUrl);
      }
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return showToast("Image URL is required", "err");
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}/images`, {
        method: "POST",
        body: JSON.stringify({ imageUrl: newImageUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add image");
      showToast("Image added to gallery");
      setAddImageModalOpen(false);
      setNewImageUrl("");
      loadSample();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveComments = async () => {
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ adminComments })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save comments");
      showToast("Comments saved successfully");
      loadSample();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          action: "APPROVE", 
          adminComments 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve sample");
      showToast("Sample approved successfully!");
      setApproveConfirmOpen(false);
      loadSample();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return showToast("Rejection reason is required", "err");
    setSubmitting(true);
    try {
      const combinedComments = adminComments 
        ? `${adminComments}\n\nRejection Reason: ${rejectReason}`
        : `Rejection Reason: ${rejectReason}`;
      
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          action: "REJECT", 
          adminComments: combinedComments 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject sample");
      showToast("Sample rejected");
      setRejectModalOpen(false);
      setRejectReason("");
      loadSample();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeRequests.trim()) return showToast("Change requests description is required", "err");
    setSubmitting(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/samples/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          action: "REQUEST_REVISION", 
          changeRequests 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit revision request");
      showToast("Revision requested from designer");
      setRevisionModalOpen(false);
      setChangeRequests("");
      loadSample();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Pending Review": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Approved": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "Revision Required": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      default: return "bg-foreground/5 text-foreground/45 border border-foreground/10";
    }
  };

  if (loading && !sample) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Loading Quality Control specs...</p>
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

      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
        <Link href="/dashboard/manufacturing/samples" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/55 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Queue
        </Link>
        
        <button
          onClick={loadSample}
          disabled={submitting}
          className="p-2 hover:bg-foreground/5 rounded-xl text-foreground/40 hover:text-foreground transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${submitting ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* Left Column (60%) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Gallery Widget */}
          <div className="glass-card rounded-[2rem] overflow-hidden p-6 space-y-4">
            <div className="h-96 bg-foreground/[0.02] border border-foreground/5 rounded-2xl flex items-center justify-center overflow-hidden relative">
              {activeImage ? (
                <img 
                  src={activeImage} 
                  alt="Sample Runway" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-2">
                  <ImageIcon className="w-12 h-12 text-foreground/10 mx-auto" />
                  <p className="text-xs font-bold text-foreground/30 uppercase tracking-widest">No images uploaded</p>
                </div>
              )}
              
              <button
                onClick={() => setAddImageModalOpen(true)}
                className="absolute bottom-4 right-4 bg-background/90 hover:bg-foreground hover:text-background backdrop-blur border border-foreground/10 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Image
              </button>
            </div>

            {sample.images && sample.images.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto py-2 custom-scrollbar">
                {sample.images.map((img: any) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(img.imageUrl)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border shrink-0 transition-all ${
                      activeImage === img.imageUrl 
                        ? "border-foreground scale-[1.05]" 
                        : "border-foreground/10 hover:border-foreground/30"
                    }`}
                  >
                    <img src={img.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Card */}
          <div className="glass-card rounded-[2rem] p-6 lg:p-8 space-y-6">
            <div>
              <span className="font-mono font-bold tracking-tight text-xs text-foreground/40 bg-foreground/[0.03] px-2.5 py-0.5 border border-foreground/5 rounded-full">{sample.styleCode}</span>
              <h2 className="text-xl lg:text-2xl font-bold mt-1 text-foreground leading-tight">{sample.productName}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-foreground/5 pt-5">
              
              {/* Fabric */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Fabric Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-foreground/50">Type:</span> <span className="font-bold">{sample.fabricType || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-foreground/50">GSM:</span> <span className="font-bold">{sample.gsm || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-foreground/50">Composition:</span> <span className="font-bold">{sample.composition || "-"}</span></div>
                </div>
              </div>

              {/* Manufacturing */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Manufacturing Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-foreground/50">Printing:</span> <span className="font-bold">{sample.printingTechnique || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-foreground/50">Embroidery:</span> <span className="font-bold">{sample.embroideryDetails || "-"}</span></div>
                </div>
              </div>

              {/* Accessories */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Accessories Used</h4>
                <p className="text-xs font-bold leading-normal">{sample.accessoriesUsed || "None specified"}</p>
              </div>

              {/* Vendor */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Sample Vendor</h4>
                {sample.vendor ? (
                  <Link href={`/dashboard/manufacturing/vendors`} className="flex items-center gap-2 text-xs font-bold text-foreground/80 hover:text-foreground">
                    <Building className="w-3.5 h-3.5 text-foreground/45" /> {sample.vendor.name}
                  </Link>
                ) : (
                  <span className="text-xs text-foreground/40">Not specified</span>
                )}
              </div>

            </div>

            {sample.remarks && (
              <div className="space-y-2 border-t border-foreground/5 pt-5">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Designer Remarks</h4>
                <p className="text-xs text-foreground/75 leading-relaxed bg-foreground/[0.01] p-4 rounded-xl border border-foreground/5">{sample.remarks}</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (40%) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Card */}
          <div className="glass-card rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Sample Status</h3>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest leading-none ${statusColor(sample.status)}`}>
                {sample.status}
              </span>
            </div>
            
            <div className="space-y-2 text-xs border-t border-foreground/5 pt-4 text-foreground/65 font-medium leading-relaxed">
              <div className="flex justify-between">
                <span>Submitted at:</span>
                <span className="font-mono">{formatDateTimeIST(sample.submittedAt)}</span>
              </div>
              {sample.reviewedAt && (
                <>
                  <div className="flex justify-between border-t border-foreground/5 pt-2">
                    <span>Reviewed at:</span>
                    <span className="font-mono">{formatDateTimeIST(sample.reviewedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reviewed by:</span>
                    <span className="font-bold">{sample.reviewedBy?.name || "QC Admin"}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Designer Card */}
          <div className="glass-card rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Designer Info</h3>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
                {sample.designAssignment?.assignedTo?.name?.substring(0, 2).toUpperCase() || "DS"}
              </div>
              <div>
                <div className="text-xs font-bold">{sample.designAssignment?.assignedTo?.name || "Unassigned"}</div>
                <div className="text-[10px] text-foreground/40 font-mono">{sample.designAssignment?.assignedTo?.email || "-"}</div>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-foreground/5 pt-4 text-foreground/65 font-medium">
              <div className="flex justify-between">
                <span>Collection Name:</span>
                <span className="font-bold">{sample.designAssignment?.collection?.name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Submission deadline:</span>
                <span className="font-bold text-amber-400">{sample.designAssignment?.submissionDeadline ? formatDateTimeIST(sample.designAssignment?.submissionDeadline).split(",")[0] : "-"}</span>
              </div>
            </div>
          </div>

          {/* Admin Comments */}
          <div className="glass-card rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">QC Admin Comments</h3>
            <textarea
              value={adminComments}
              onChange={(e) => setAdminComments(e.target.value)}
              rows={3}
              placeholder="Provide quality control feedback, comments or approvals checklist details..."
              className="w-full bg-background border border-foreground/10 rounded-xl p-3 text-xs text-foreground focus:outline-none"
            />
            <button
              disabled={submitting}
              onClick={handleSaveComments}
              className="w-full py-2 bg-background border border-foreground/10 text-foreground hover:bg-foreground/[0.02] text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
            >
              {submitting ? "Saving..." : "Save Comments"}
            </button>
          </div>

          {/* Action Buttons Stack */}
          {sample.status === "Pending Review" && (
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setApproveConfirmOpen(true)}
                className="w-full py-3 bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Approve Sample
              </button>

              <button
                onClick={() => setRejectModalOpen(true)}
                className="w-full py-3 bg-rose-500 text-white hover:bg-rose-600 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" /> Reject Sample
              </button>

              <button
                onClick={() => setRevisionModalOpen(true)}
                className="w-full py-3 bg-amber-400 text-background hover:opacity-95 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-400/25 flex items-center justify-center gap-1.5"
              >
                <Beaker className="w-4 h-4 text-background" /> Request Revision
              </button>
            </div>
          )}

          {/* Revisions History Section */}
          {sample.revisions && sample.revisions.length > 0 && (
            <div className="glass-card rounded-[2rem] p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Revision History</h3>
              
              <div className="space-y-4 divide-y divide-foreground/5">
                {sample.revisions.map((rev: any, index: number) => (
                  <div key={rev.id} className={`space-y-2 text-xs ${index > 0 ? "pt-3" : ""}`}>
                    <div className="flex justify-between items-center text-[10px] text-foreground/40 font-bold uppercase">
                      <span>Revision #{rev.revisionNumber}</span>
                      <span className="font-mono">{formatDateTimeIST(rev.createdAt).split(",")[0]}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-rose-400 font-bold uppercase text-[8px] tracking-wider block">Change Requests:</span>
                      <p className="italic text-foreground/80">"{rev.changeRequests}"</p>
                    </div>

                    {rev.designerResponse && (
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold uppercase text-[8px] tracking-wider block">Designer Response:</span>
                        <p className="font-medium text-foreground/90">"{rev.designerResponse}"</p>
                        {rev.resubmissionDate && (
                          <div className="text-[8px] text-foreground/35 font-mono mt-0.5">Resubmitted: {formatDateTimeIST(rev.resubmissionDate)}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Approve Confirm Modal */}
      <AnimatePresence>
        {approveConfirmOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl text-center"
            >
              <Beaker className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Approve Physical Sample?</h3>
                <p className="text-xs text-foreground/50 leading-relaxed max-w-xs mx-auto">
                  Approving this sample will mark the style assignment as Approved, award +5 score delta to the designer, and auto-register this entry in the Product Knowledge Base.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApproveConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={handleApprove}
                  className="flex-1 py-2.5 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all"
                >
                  {submitting ? "Approving..." : "Yes, Approve"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Reject Sample Run</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Physical Sample Quality Rejection</p>
              </div>

              <form onSubmit={handleReject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">Rejection Reason *</label>
                  <textarea
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Provide description for rejection (e.g. incorrect sizing parameters, fabric specs mismatch...)"
                    className="w-full bg-background border border-foreground/10 rounded-xl p-3 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-all"
                  >
                    {submitting ? "Rejecting..." : "Reject Sample"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revision Modal */}
      <AnimatePresence>
        {revisionModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Request Sample Revision</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Physical Sample Iteration Round</p>
              </div>

              <form onSubmit={handleRequestRevision} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">Revision Change Requests *</label>
                  <textarea
                    required
                    value={changeRequests}
                    onChange={(e) => setChangeRequests(e.target.value)}
                    rows={4}
                    placeholder="List all styling updates, sewing parameter changes, printing relocations needed for resubmission..."
                    className="w-full bg-background border border-foreground/10 rounded-xl p-3 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRevisionModalOpen(false)}
                    className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-400 text-background text-[9px] font-bold uppercase tracking-widest rounded-xl hover:opacity-95 transition-all animate-pulse"
                  >
                    {submitting ? "Requesting..." : "Send Revision Request"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Image Modal */}
      <AnimatePresence>
        {addImageModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm glass-card rounded-[1.5rem] border border-foreground/10 p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-md font-bold uppercase tracking-tight text-foreground">Add Sample Image</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Attach photograph of physical sample</p>
              </div>

              <form onSubmit={handleAddImage} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1 font-inter">Image Link / URL *</label>
                  <input
                    required
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://workdrive.zoho.in/...jpg"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[12px] text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddImageModalOpen(false)}
                    className="flex-1 py-2.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-1 py-2.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-widest rounded-xl hover:opacity-95"
                  >
                    {submitting ? "Uploading..." : "Save Image"}
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
