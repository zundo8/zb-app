"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, ArrowLeft, CheckCircle2, History, RefreshCw, ArrowRightLeft, Wallet, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

type TransactionRecord = {
  id: string;
  source: string;
  type: string;
  amount: number;
  status: string;
  gateway: string;
  orderId: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  date: string;
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/history?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, limit, offset]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = transactions.filter(t => {
    if (typeFilter === "all") return true;
    if (typeFilter === "payment") return t.source === "payment";
    if (typeFilter === "store_credit") return t.source === "store_credit";
    if (typeFilter === "refund") return t.type.toLowerCase().includes("refund");
    return true;
  });

  const getAmountColor = (t: TransactionRecord) => {
    const isRefund = t.type.toLowerCase().includes("refund");
    const isDebit = t.type.toLowerCase() === "debit";
    if (isRefund || isDebit) return "text-rose-500";
    return "text-emerald-500";
  };

  const getAmountPrefix = (t: TransactionRecord) => {
    const isRefund = t.type.toLowerCase().includes("refund");
    const isDebit = t.type.toLowerCase() === "debit";
    if (isRefund || isDebit) return "- ₹";
    return "+ ₹";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pb-20 relative z-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payments" className="p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground/60" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-amber-500" /> Transaction History
          </h1>
          <p className="text-[11px] text-foreground/50 tracking-wide">Unified ledger showing all gateway charges, refunds, and wallet adjustments.</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Total Transacted Items</p>
          <p className="text-2xl font-bold tracking-tighter">{transactions.length}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Razorpay Gateway Activity</p>
          <p className="text-2xl font-bold tracking-tighter">{transactions.filter(t => t.gateway === 'razorpay').length}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Store Credit Adjustments</p>
          <p className="text-2xl font-bold tracking-tighter">{transactions.filter(t => t.gateway === 'store_credit').length}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input
            type="text"
            placeholder="Search by order, customer, description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="w-full bg-background border border-foreground/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-[11px] outline-none focus:border-foreground/10 transition-colors"
          />
        </div>
        <div className="flex items-center bg-background border border-foreground/[0.05] rounded-xl p-1 self-stretch shrink-0 overflow-x-auto">
          {[
            { key: "all", label: "All" },
            { key: "payment", label: "Gateway Payments" },
            { key: "store_credit", label: "Store Credit Transactions" },
            { key: "refund", label: "All Refunds" }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTypeFilter(item.key)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-widest transition-all whitespace-nowrap ${
                typeFilter === item.key ? "bg-foreground text-background shadow-sm" : "text-foreground/40 hover:bg-foreground/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button onClick={fetchTransactions} disabled={loading} className="p-2.5 border border-foreground/[0.05] rounded-xl hover:bg-foreground/[0.02] disabled:opacity-50 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Transaction Table */}
      <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
              <tr>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Transaction Details</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Customer</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Channel / Gateway</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Amount</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Status</th>
                <th className="px-5 py-4 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground/20" />
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <p className="text-[11px] font-medium text-foreground/30 uppercase tracking-widest">No transactions logged</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-foreground/[0.01] transition-all">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-foreground/[0.03] flex items-center justify-center">
                          {t.gateway === "store_credit" ? (
                            <Wallet className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-foreground max-w-[220px] truncate" title={t.description}>
                            {t.description}
                          </div>
                          <div className="text-[9px] text-foreground/40 font-mono mt-0.5">{t.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[11px] font-semibold text-foreground">{t.customerName}</div>
                      <div className="text-[9px] text-foreground/40 mt-0.5">{t.customerEmail}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-foreground/[0.03] border border-foreground/[0.05] text-foreground/60">
                        {t.gateway === "razorpay" ? "💳 Razorpay" : "💼 Wallet"}
                      </span>
                      <span className="ml-2 text-[9px] text-foreground/30 font-medium">({t.type})</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-bold ${getAmountColor(t)}`}>
                        {getAmountPrefix(t)}{Math.abs(t.amount).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                        t.status === "COMPLETED" || t.status === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}>
                        <CheckCircle2 className="w-2.5 h-2.5" /> {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-[10px] text-foreground/50">{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-[9px] text-foreground/30 mt-0.5">{new Date(t.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
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
