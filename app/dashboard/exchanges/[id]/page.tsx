"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Check, X, Clock, Package, TruckIcon, CheckCircle2, XCircle, CreditCard, AlertTriangle, RefreshCw, User, Mail, Phone, ArrowRight, ShoppingBag, ClipboardCheck, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_STEPS = [
  { key: "pending_approval", label: "Requested", icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "received", label: "Received", icon: Package },
  { key: "qc_passed", label: "QC Passed", icon: ClipboardCheck },
  { key: "new_order_created", label: "Order Created", icon: ShoppingBag },
  { key: "completed", label: "Completed", icon: Check },
];

const STATUS_INDEX: Record<string, number> = {
  pending_approval: 0,
  approved: 1,
  return_created: 1,
  received: 2,
  qc_passed: 3,
  new_order_created: 4,
  shipped: 5,
  completed: 5,
  rejected: -1,
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending_approval: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Pending Approval" },
  approved: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Approved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Rejected" },
  return_created: { color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", label: "Return Created" },
  received: { color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20", label: "Received" },
  qc_passed: { color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "QC Passed" },
  new_order_created: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "New Order Created" },
  shipped: { color: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20", label: "Shipped" },
  completed: { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", label: "Completed" },
  REQUESTED: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Requested" },
  APPROVED: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Approved" },
  REJECTED: { color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Rejected" },
  RECEIVED: { color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20", label: "Received" },
  QC_PASSED: { color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "QC Passed" },
  NEW_ORDER_CREATED: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Order Created" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_approval;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace('text-', 'bg-')} ${status === 'pending_approval' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

export default function ExchangeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exchangeId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // QC Modal
  const [showQcModal, setShowQcModal] = useState(false);
  const [qcNotes, setQcNotes] = useState("");
  const [qcStatus, setQcStatus] = useState<"passed" | "failed">("passed");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.exchangeRequest || json.exchange || json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [exchangeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        showToast("Exchange approved! Return order created.");
        fetchDetail();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading("reject");
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin rejected" }),
      });
      if (res.ok) {
        showToast("Exchange rejected");
        fetchDetail();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceive = async () => {
    setActionLoading("receive");
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qcStatus, qcNotes }),
      });
      if (res.ok) {
        showToast("Items received & QC completed");
        setShowQcModal(false);
        fetchDetail();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateShopifyOrder = async () => {
    setActionLoading("create-order");
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Shopify order created: ${result.shopifyOrderId || "Success"}`);
        fetchDetail();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(newStatus);
    try {
      const res = await fetch(`/api/admin/exchanges/${exchangeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Status updated to ${newStatus}`);
        fetchDetail();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-foreground/20" />
        <p className="text-[11px] text-foreground/50 uppercase tracking-widest">Exchange not found</p>
        <button onClick={() => router.push("/dashboard/exchanges")} className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">← Back to Exchanges</button>
      </div>
    );
  }

  const currentStatus = (data.status || "pending_approval").toLowerCase();
  const currentStepIndex = STATUS_INDEX[currentStatus] ?? 0;
  const isRejected = currentStatus === "rejected";
  const order = data.order;
  const customer = order?.customer;
  const exchanges = data.exchanges || [];
  const linkedReturn = data.linkedReturn;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pb-20 relative z-10">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -20, x: "-50%" }} className="fixed top-8 left-1/2 z-50 bg-background border border-foreground/[0.05] rounded-md px-4 py-2 text-[10px] font-medium text-foreground shadow-sm flex items-center gap-2 uppercase tracking-wide">
            <Check className="w-3 h-3 text-green-500" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/exchanges")} className="p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Exchange #{(data.id || exchangeId).slice(0, 8)}</h1>
              <StatusBadge status={currentStatus} />
            </div>
            <p className="text-[10px] text-foreground/40 mt-0.5">
              Created {new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <button onClick={fetchDetail} className="flex items-center gap-2 px-3 py-1.5 border border-foreground/[0.05] rounded-md text-[9px] font-medium uppercase tracking-widest hover:bg-foreground/[0.02]">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Status Timeline */}
      {!isRejected && (
        <div className="bg-background border border-foreground/[0.05] rounded-xl p-6">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-6">Exchange Workflow</p>
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-[2px] bg-foreground/[0.05]">
              <motion.div
                className="h-full bg-foreground/60 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>

            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10">
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent ? "bg-foreground text-background border-foreground scale-110" :
                      isActive ? "bg-foreground/80 text-background border-foreground/60" :
                      "bg-background text-foreground/30 border-foreground/10"
                    }`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: isCurrent ? 1.1 : 1 }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </motion.div>
                  <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-widest mt-2 whitespace-nowrap text-center ${isCurrent ? "text-foreground" : isActive ? "text-foreground/60" : "text-foreground/25"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rejected Banner */}
      {isRejected && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-rose-500">Exchange Request Rejected</p>
            {data.reason && <p className="text-[10px] text-rose-400/70 mt-1">Reason: {data.reason}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exchange Items */}
          <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-foreground/[0.05]">
              <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">Exchange Items ({exchanges.length})</p>
            </div>
            <div className="divide-y divide-foreground/[0.03]">
              {exchanges.map((ex: any, idx: number) => (
                <div key={idx} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <StatusBadge status={ex.status || "REQUESTED"} />
                    {ex.qcStatus && (
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${ex.qcStatus === 'passed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        QC: {ex.qcStatus}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Original Product */}
                    <div className="flex-1 p-3 rounded-xl bg-rose-500/[0.03] border border-rose-500/10">
                      <p className="text-[8px] font-bold text-rose-500/60 uppercase tracking-widest mb-2">Returning</p>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-foreground/[0.02] border border-foreground/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                          {ex.originalProduct?.featuredImage ? (
                            <img src={ex.originalProduct.featuredImage} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Package className="w-4 h-4 text-foreground/20" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-foreground truncate">{ex.originalProduct?.title || "Original Item"}</p>
                          <p className="text-[9px] text-foreground/40">SKU: {ex.originalProduct?.sku || "N/A"}</p>
                          <p className="text-[10px] font-semibold text-foreground mt-0.5">₹{(ex.originalProduct?.price || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-foreground/20 shrink-0" />

                    {/* New Product */}
                    <div className="flex-1 p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10">
                      <p className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest mb-2">Replacement</p>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-foreground/[0.02] border border-foreground/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                          {ex.newProduct?.featuredImage ? (
                            <img src={ex.newProduct.featuredImage} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Package className="w-4 h-4 text-foreground/20" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-foreground truncate">{ex.newProduct?.title || "Replacement"}</p>
                          <p className="text-[9px] text-foreground/40">SKU: {ex.newProduct?.sku || "N/A"}</p>
                          <p className="text-[10px] font-semibold text-foreground mt-0.5">₹{(ex.newProduct?.price || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {ex.qcNotes && (
                    <div className="mt-3 p-2 bg-foreground/[0.02] rounded-lg">
                      <p className="text-[9px] text-foreground/50"><span className="font-bold">QC Notes:</span> {ex.qcNotes}</p>
                    </div>
                  )}
                  {ex.reason && (
                    <div className="mt-2 p-2 bg-foreground/[0.02] rounded-lg">
                      <p className="text-[9px] text-foreground/50"><span className="font-bold">Reason:</span> {ex.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Linked Return Order */}
          {linkedReturn && (
            <div className="bg-background border border-indigo-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-[0.3em]">Linked Return Order</p>
                <button
                  onClick={() => router.push(`/dashboard/returns/${linkedReturn.id}`)}
                  className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold uppercase tracking-widest hover:underline"
                >
                  View Return <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Return ID</p>
                  <p className="text-[11px] font-semibold text-foreground mt-1">#{linkedReturn.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Status</p>
                  <p className="text-[11px] font-semibold text-foreground mt-1 capitalize">{linkedReturn.status}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Items</p>
                  <p className="text-[11px] font-semibold text-foreground mt-1">{linkedReturn.returns?.length || 0}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Created</p>
                  <p className="text-[11px] font-semibold text-foreground mt-1">{new Date(linkedReturn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Original Order */}
          {order && (
            <div className="bg-background border border-foreground/[0.05] rounded-xl p-5">
              <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-4">Original Order</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Shopify Order</p>
                  <p className="text-[12px] font-semibold text-foreground mt-1">#{order.shopifyOrderId}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Order Total</p>
                  <p className="text-[12px] font-semibold text-foreground mt-1">₹{order.totalPrice?.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Payment</p>
                  <p className="text-[12px] font-semibold text-foreground mt-1 capitalize">{order.paymentStatus}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">Date</p>
                  <p className="text-[12px] font-semibold text-foreground mt-1">{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          {customer && (
            <div className="bg-background border border-foreground/[0.05] rounded-xl p-5">
              <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-4">Customer</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-foreground/[0.05] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-foreground/40" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{customer.name || "Unknown"}</p>
                  </div>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Mail className="w-3 h-3" />
                    <span className="text-[10px]">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Phone className="w-3 h-3" />
                    <span className="text-[10px]">{customer.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price Difference */}
          <div className="bg-background border border-foreground/[0.05] rounded-xl p-5">
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-4">Payment Details</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-foreground/50">Price Difference</span>
                <span className={`text-[14px] font-bold ${data.priceDifference > 0 ? 'text-rose-500' : data.priceDifference < 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                  {data.priceDifference > 0 ? '+' : ''}₹{Math.abs(data.priceDifference || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-foreground/50">Payment Status</span>
                <span className="text-[10px] font-semibold text-foreground capitalize">{(data.paymentStatus || "not_required").replace("_", " ")}</span>
              </div>
              {data.paymentId && (
                <div className="flex justify-between items-center pt-2 border-t border-foreground/[0.05]">
                  <span className="text-[10px] text-foreground/50">Payment ID</span>
                  <span className="text-[9px] font-mono text-foreground/60">{data.paymentId}</span>
                </div>
              )}
              {data.newShopifyOrderId && (
                <div className="flex justify-between items-center pt-2 border-t border-foreground/[0.05]">
                  <span className="text-[10px] text-foreground/50">Shopify Order</span>
                  <span className="text-[10px] font-semibold text-blue-500">#{data.newShopifyOrderId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-background border border-foreground/[0.05] rounded-xl p-5">
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-4">Actions</p>
            <div className="space-y-2">
              {currentStatus === "pending_approval" && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className="w-full py-2.5 bg-foreground text-background rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading === "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve Exchange
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!!actionLoading}
                    className="w-full py-2.5 border border-rose-500/20 text-rose-500 rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-rose-500/5"
                  >
                    {actionLoading === "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reject"}
                  </button>
                </>
              )}
              {(currentStatus === "approved" || currentStatus === "return_created") && (
                <button
                  onClick={() => setShowQcModal(true)}
                  disabled={!!actionLoading}
                  className="w-full py-2.5 bg-teal-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === "receive" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                  Mark as Received & QC
                </button>
              )}
              {(currentStatus === "received" || currentStatus === "qc_passed") && (
                <button
                  onClick={handleCreateShopifyOrder}
                  disabled={!!actionLoading}
                  className="w-full py-2.5 bg-emerald-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === "create-order" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                  Create Shopify Order (₹0)
                </button>
              )}
              {currentStatus === "new_order_created" && (
                <button
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={!!actionLoading}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === "completed" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Mark as Completed
                </button>
              )}
              {(currentStatus === "completed" || isRejected) && (
                <p className="text-[10px] text-foreground/40 text-center py-2">No further actions available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QC Modal */}
      <AnimatePresence>
        {showQcModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="absolute inset-0 z-0" onClick={() => setShowQcModal(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-background w-full max-w-sm rounded-xl p-6 border border-foreground/[0.05] shadow-lg relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[12px] font-semibold text-foreground tracking-widest uppercase">Receive & Quality Check</h2>
                <button onClick={() => setShowQcModal(false)} className="text-foreground/40 hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/50 mb-2">Quality Check Result</label>
                  <div className="flex gap-2">
                    <button onClick={() => setQcStatus("passed")} className={`flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${qcStatus === "passed" ? "bg-emerald-500 text-white border-emerald-500" : "border-foreground/10 text-foreground/40"}`}>
                      ✓ Passed
                    </button>
                    <button onClick={() => setQcStatus("failed")} className={`flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${qcStatus === "failed" ? "bg-rose-500 text-white border-rose-500" : "border-foreground/10 text-foreground/40"}`}>
                      ✗ Failed
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/50 mb-1.5">QC Notes (Optional)</label>
                  <textarea
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] text-foreground outline-none resize-none"
                    placeholder="Add any quality check observations..."
                  />
                </div>
                <button
                  onClick={handleReceive}
                  disabled={!!actionLoading}
                  className="w-full py-2.5 bg-foreground text-background rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {actionLoading === "receive" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  Confirm Receipt & QC
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
