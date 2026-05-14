"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, ArrowRightLeft, CheckCircle2, XCircle, Clock, RefreshCw, Filter, Download, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type RefundRecord = {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: string;
  date: string;
  reason: string;
  items: string;
};

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments/refunds");
      if (res.ok) {
        const data = await res.json();
        setRefunds(data.refunds || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const filteredRefunds = refunds.filter(r => 
    r.orderId.toLowerCase().includes(search.toLowerCase()) || 
    r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    r.customerEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRefunded = refunds.reduce((acc, r) => acc + r.amount, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pb-20 relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Refunds</h1>
          <p className="text-[11px] text-foreground/50 tracking-wide">Track all financial reversals and product return refunds.</p>
        </div>
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2 border border-foreground/[0.05] rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-foreground/[0.02] transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
          <button onClick={fetchRefunds} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Total Refunded</p>
          <p className="text-2xl font-bold tracking-tighter">₹{totalRefunded.toLocaleString("en-IN")}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Refund Transactions</p>
          <p className="text-2xl font-bold tracking-tighter">{refunds.length}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Success Rate</p>
          <p className="text-2xl font-bold tracking-tighter">100%</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input
            type="text"
            placeholder="Search by order ID, customer name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-foreground/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-[11px] outline-none focus:border-foreground/10 transition-colors"
          />
        </div>
        <div className="flex items-center bg-background border border-foreground/[0.05] rounded-xl p-1 self-stretch">
          {["all", "completed", "pending"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-widest transition-all ${statusFilter === s ? "bg-foreground text-background shadow-sm" : "text-foreground/40 hover:bg-foreground/5"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
              <tr>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Order & Customer</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Items / Reason</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Amount</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Status</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground/20" />
                  </td>
                </tr>
              ) : filteredRefunds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <p className="text-[11px] font-medium text-foreground/30 uppercase tracking-widest">No refunds found</p>
                  </td>
                </tr>
              ) : (
                filteredRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-foreground/[0.01] transition-all">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-foreground/[0.03] flex items-center justify-center">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-foreground/30" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-foreground">#{r.orderId}</div>
                          <div className="text-[9px] text-foreground/40">{r.customerName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[11px] font-medium text-foreground truncate max-w-[250px]">{r.items}</div>
                      <div className="text-[9px] text-foreground/40 mt-0.5">{r.reason}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] font-bold text-foreground">₹{r.amount.toLocaleString("en-IN")}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-[10px] text-foreground/50">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-[9px] text-foreground/30 mt-0.5">{new Date(r.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
