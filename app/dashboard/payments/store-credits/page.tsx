"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, Wallet, Plus, History, Check, X, ArrowUpRight, ArrowDownLeft, User, CreditCard, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type CustomerCredit = {
  id: string;
  name: string;
  email: string;
  storeCredits: number;
  shopifyId: string;
};

type CreditTxn = {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

export default function StoreCreditsPage() {
  const [customers, setCustomers] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [history, setHistory] = useState<CreditTxn[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState<CustomerCredit | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState("ADD"); // ADD or SUBTRACT
  const [adjustDesc, setAdjustDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<{ totalOutstanding: number; activeCustomers: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "has_balance" | "no_balance">("all");
  const [sortBy, setSortBy] = useState<"balance_desc" | "balance_asc" | "name_asc" | "name_desc">("balance_desc");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCustomers = useCallback(async (searchQuery = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/store-credits?search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
        setOverview(data.overview || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredAndSortedCustomers = customers
    .filter((c) => {
      if (filter === "has_balance") return c.storeCredits > 0;
      if (filter === "no_balance") return c.storeCredits === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "balance_desc") return b.storeCredits - a.storeCredits;
      if (sortBy === "balance_asc") return a.storeCredits - b.storeCredits;
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
      return 0;
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchCustomers]);

  const fetchHistory = async (customerId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/store-credits?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustModal || !adjustAmount) return;
    setSubmitting(true);
    try {
      const amount = parseFloat(adjustAmount) * (adjustType === "SUBTRACT" ? -1 : 1);
      const res = await fetch("/api/admin/payments/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: adjustModal.id,
          amount,
          type: "MANUAL",
          description: adjustDesc || (adjustType === "ADD" ? "Manual Credit Addition" : "Manual Credit Adjustment"),
        }),
      });

      if (res.ok) {
        showToast("Credit balance updated successfully");
        setAdjustModal(null);
        setAdjustAmount("");
        setAdjustDesc("");
        fetchCustomers(search);
        if (selectedCustomer?.id === adjustModal.id) {
          fetchHistory(adjustModal.id);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update credit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pb-20 relative z-10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -20, x: "-50%" }} className="fixed top-8 left-1/2 z-50 bg-foreground border border-foreground/[0.05] rounded-md px-4 py-2 text-[10px] font-medium text-background shadow-lg flex items-center gap-2 uppercase tracking-wide">
            <Check className="w-3 h-3" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Store Credits</h1>
          <p className="text-[11px] text-foreground/50 tracking-wide">Manage customer wallets and view transaction history.</p>
        </div>
        <div className="bg-foreground/[0.02] border border-foreground/[0.05] rounded-xl px-4 py-2 flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest leading-none mb-1">Total Members</div>
            <div className="text-[14px] font-bold text-foreground leading-none">{total}</div>
          </div>
          <div className="w-[1px] h-6 bg-foreground/10 mx-1" />
          <Users className="w-5 h-5 text-foreground/40" />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Total Outstanding Credits</p>
          <p className="text-2xl font-bold tracking-tighter">₹{(overview?.totalOutstanding ?? 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Active Wallets (&gt; ₹0)</p>
          <p className="text-2xl font-bold tracking-tighter">{overview?.activeCustomers ?? 0}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">Average Wallet Balance</p>
          <p className="text-2xl font-bold tracking-tighter">
            ₹{overview && overview.activeCustomers > 0 
              ? Math.round(overview.totalOutstanding / overview.activeCustomers).toLocaleString("en-IN") 
              : 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
              <input
                type="text"
                placeholder="Search by name, email or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-foreground/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-[11px] outline-none focus:border-foreground/10 transition-colors"
              />
            </div>
            
            <div className="flex items-center bg-background border border-foreground/[0.05] rounded-xl p-1 self-stretch shrink-0">
              {[
                { key: "all", label: "All" },
                { key: "has_balance", label: "With Balance" },
                { key: "no_balance", label: "No Balance" }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-widest transition-all whitespace-nowrap ${
                    filter === item.key ? "bg-foreground text-background shadow-sm" : "text-foreground/40 hover:bg-foreground/5"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative group shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-background border border-foreground/[0.05] hover:border-foreground/10 rounded-xl px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-foreground/40 hover:text-foreground/60 outline-none cursor-pointer transition-all"
              >
                <option value="balance_desc">Balance: High to Low</option>
                <option value="balance_asc">Balance: Low to High</option>
                <option value="name_asc">Name: A-Z</option>
                <option value="name_desc">Name: Z-A</option>
              </select>
            </div>
          </div>

          <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest">Customer</th>
                    <th className="px-4 py-3 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest text-right">Balance</th>
                    <th className="px-4 py-3 text-[9px] font-semibold text-foreground/40 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/[0.03]">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-foreground/20" />
                      </td>
                    </tr>
                  ) : filteredAndSortedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-[10px] text-foreground/40 uppercase tracking-widest">No customers found</td>
                    </tr>
                  ) : (
                    filteredAndSortedCustomers.map((c) => (
                      <tr 
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c); fetchHistory(c.id); }}
                        className={`hover:bg-foreground/[0.01] transition-all cursor-pointer ${selectedCustomer?.id === c.id ? "bg-foreground/[0.02]" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-[11px] font-semibold text-foreground">{c.name || "Unknown"}</div>
                          <div className="text-[9px] text-foreground/40">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[11px] font-bold text-foreground">₹{c.storeCredits.toLocaleString("en-IN")}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAdjustModal(c); }}
                            className="p-1.5 hover:bg-foreground/5 rounded-lg text-foreground/60 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: History Panel */}
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-2xl border border-foreground/[0.05] min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em]">Activity History</h3>
              <History className="w-4 h-4 text-foreground/20" />
            </div>

            {!selectedCustomer ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-40">
                <User className="w-8 h-8 mb-4 stroke-1" />
                <p className="text-[10px] font-medium uppercase tracking-widest leading-relaxed">Select a customer<br/>to view history</p>
              </div>
            ) : historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-foreground/20" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-[10px] text-foreground/40 text-center py-20 uppercase tracking-widest">No transactions found</p>
            ) : (
              <div className="space-y-4">
                {history.map((txn) => (
                  <div key={txn.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-foreground/[0.02] transition-colors border border-transparent hover:border-foreground/[0.05]">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${txn.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {txn.amount > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-foreground truncate">{txn.description}</p>
                        <p className={`text-[11px] font-bold ${txn.amount > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {txn.amount > 0 ? "+" : ""}₹{Math.abs(txn.amount).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <p className="text-[9px] text-foreground/40 mt-0.5">
                        {new Date(txn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjust Credit Modal */}
      <AnimatePresence>
        {adjustModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="absolute inset-0 z-0" onClick={() => setAdjustModal(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-background w-full max-w-sm rounded-xl p-6 border border-foreground/[0.05] shadow-2xl relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.05] flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-foreground/40" />
                  </div>
                  <h2 className="text-[12px] font-semibold text-foreground tracking-widest uppercase">Adjust Credit</h2>
                </div>
                <button onClick={() => setAdjustModal(null)} className="text-foreground/40 hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-5">
                <div className="p-3 bg-foreground/[0.02] border border-foreground/[0.05] rounded-xl">
                  <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.2em] mb-1">Customer</p>
                  <p className="text-[12px] font-semibold text-foreground">{adjustModal.name}</p>
                  <p className="text-[10px] text-foreground/40">{adjustModal.email}</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setAdjustType("ADD")}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${adjustType === "ADD" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 shadow-sm" : "border-foreground/[0.05] text-foreground/40 hover:bg-foreground/[0.02]"}`}
                  >
                    Add Credit
                  </button>
                  <button 
                    onClick={() => setAdjustType("SUBTRACT")}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${adjustType === "SUBTRACT" ? "bg-rose-500/10 border-rose-500/20 text-rose-600 shadow-sm" : "border-foreground/[0.05] text-foreground/40 hover:bg-foreground/[0.02]"}`}
                  >
                    Deduct Credit
                  </button>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-foreground/40 mb-2 ml-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={adjustAmount} 
                    onChange={(e) => setAdjustAmount(e.target.value)} 
                    className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-xl px-4 py-3 text-lg font-bold text-foreground outline-none transition-all placeholder:text-foreground/10"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-foreground/40 mb-2 ml-1">Reason / Note</label>
                  <textarea 
                    value={adjustDesc} 
                    onChange={(e) => setAdjustDesc(e.target.value)} 
                    className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-xl px-4 py-3 text-[11px] text-foreground outline-none min-h-[80px] resize-none transition-all placeholder:text-foreground/10"
                    placeholder="Brief description for the customer..."
                  />
                </div>

                <button 
                  onClick={handleAdjustSubmit} 
                  disabled={submitting || !adjustAmount}
                  className="w-full py-3.5 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Update Balance</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
