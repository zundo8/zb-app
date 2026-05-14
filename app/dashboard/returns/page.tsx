"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, CheckCircle2, XCircle, RefreshCw, Package, CreditCard, AlertTriangle, Check, X, Clock, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ReturnRequest = {
  returnRequestId: string;
  orderId: string;
  shopifyOrderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  estimatedRefund: number;
  actualRefund: number | null;
  createdAt: string;
  items: any[];
};

type Summary = {
  requested: number;
  approved: number;
  rejected: number;
  total: number;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending_approval: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Pending Approval" },
  approved: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Approved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Rejected" },
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

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [summary, setSummary] = useState<Summary>({ requested: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [refundModal, setRefundModal] = useState<ReturnRequest | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  const [refundType, setRefundType] = useState<"original_method" | "store_credit">("original_method");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/returns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
        
        let pending = 0, approved = 0, rejected = 0;
        data.returns.forEach((r: any) => {
          if (r.status === "pending_approval") pending++;
          if (r.status === "approved") approved++;
          if (r.status === "rejected") rejected++;
        });
        setSummary({ requested: pending, approved, rejected, total: data.total });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleAction = async (id: string, action: "approve" | "reject", extra?: any) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/returns/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra || {}),
      });
      if (res.ok) {
        showToast(`Return request ${action}d successfully`);
        fetchReturns();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      showToast("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundSubmit = () => {
    if (!refundModal) return;
    handleAction(refundModal.returnRequestId, "approve", { 
      actualRefund: parseFloat(refundAmount) || refundModal.estimatedRefund,
      isStoreCredit: refundType === "store_credit",
      customerId: refundModal.userId
    });
    setRefundModal(null);
    setRefundAmount("");
  };

  const summaryCards = [
    { label: "Pending", statusKey: "pending_approval", count: summary.requested, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Approved", statusKey: "approved", count: summary.approved, icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Rejected", statusKey: "rejected", count: summary.rejected, icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pb-20 relative z-10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -20, x: "-50%" }} className="fixed top-8 left-1/2 z-50 bg-background border border-foreground/[0.05] rounded-md px-4 py-2 text-[10px] font-medium text-foreground shadow-sm flex items-center gap-2 uppercase tracking-wide">
            <Check className="w-3 h-3 text-green-500" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Returns</h1>
          <p className="text-[11px] text-foreground/50 tracking-wide max-w-xl">Manage return requests, view reasons, and process approvals/refunds.</p>
        </div>
        <button onClick={fetchReturns} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button key={card.label} onClick={() => setStatusFilter(card.statusKey)} className={`glass-card p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden ${statusFilter === card.statusKey ? "ring-1 ring-foreground/20" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em]">{card.label}</span>
                <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}><Icon className={`w-3.5 h-3.5 ${card.color}`} /></div>
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tighter">{card.count}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex items-center bg-background border border-foreground/[0.05] rounded-md p-1">
          {["all", "pending_approval", "approved", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-[4px] text-[8px] font-medium uppercase tracking-[0.15em] transition-colors whitespace-nowrap ${statusFilter === s ? "bg-foreground text-background" : "text-foreground/50 hover:bg-foreground/[0.03]"}`}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
              <tr>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Order</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Customer</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Items</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Refund</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest text-center">Date</th>
                <th className="px-4 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.03]">
              {loading && returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-foreground/30" />
                    <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40">Loading returns...</p>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Inbox className="w-8 h-8 text-foreground/10 mx-auto mb-3" />
                    <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-tight">No returns found</p>
                  </td>
                </tr>
              ) : (
                returns.map((req) => (
                  <tr key={req.returnRequestId} className="hover:bg-foreground/[0.01] transition-all">
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold text-foreground">#{req.shopifyOrderId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] font-medium text-foreground">{req.userName}</div>
                      <div className="text-[9px] text-foreground/40 mt-0.5">{req.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] whitespace-normal">
                      {req.items?.map((item: any, idx: number) => (
                        <div key={idx} className="text-[10px] text-foreground/70 mb-1">
                          <span className="font-semibold">{item.product?.title || "Item"}</span> - {item.reason}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold text-foreground">₹{(req.actualRefund || req.estimatedRefund).toLocaleString("en-IN")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[10px] text-foreground/50">{new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === "pending_approval" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleAction(req.returnRequestId, "reject", { reason: "Admin rejected" })} disabled={actionLoading === req.returnRequestId} className="px-3 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/5 border border-rose-500/10 text-[8px] font-bold uppercase tracking-widest disabled:opacity-50">
                            Reject
                          </button>
                          <button onClick={() => { setRefundModal(req); setRefundAmount(String(req.estimatedRefund)); }} disabled={actionLoading === req.returnRequestId} className="px-3 py-1.5 bg-foreground text-background rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center gap-1">
                            {actionLoading === req.returnRequestId ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve & Refund"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {refundModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="absolute inset-0 z-0" onClick={() => setRefundModal(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-background w-full max-w-sm rounded-xl p-6 border border-foreground/[0.05] shadow-lg relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[12px] font-semibold text-foreground tracking-widest uppercase">Approve & Issue Refund</h2>
                <button onClick={() => setRefundModal(null)} className="text-foreground/40 hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-4">
                <div className="bg-foreground/[0.02] border border-foreground/[0.05] rounded-lg p-3 space-y-1">
                  <p className="text-[10px] text-foreground/50 uppercase tracking-widest">Order #{refundModal.shopifyOrderId}</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setRefundType("original_method")} className={`flex-1 py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${refundType === "original_method" ? "bg-foreground text-background" : "border-foreground/[0.05] text-foreground/40"}`}>Original Method</button>
                  <button onClick={() => setRefundType("store_credit")} className={`flex-1 py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${refundType === "store_credit" ? "bg-foreground text-background" : "border-foreground/[0.05] text-foreground/40"}`}>Store Credit</button>
                </div>

                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/50 mb-1.5">Refund Amount (₹)</label>
                  <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2.5 text-[14px] font-semibold text-foreground outline-none" placeholder="0.00" />
                </div>

                <button onClick={handleRefundSubmit} className="w-full py-2.5 bg-emerald-500 text-white rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:bg-emerald-600 transition-colors mt-2 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
