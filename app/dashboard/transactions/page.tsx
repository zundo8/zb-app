"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  X,
  FileText
} from "lucide-react";
import Link from "next/link";

interface Transaction {
  paymentId: string;
  razorpayOrderId: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  capturedAt: string;
  classification: "Matched" | "Orphaned" | "Mismatched";
  mismatchReason: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  localOrder: {
    id: string;
    internalOrderNumber: string | null;
    shopifyOrderId: string | null;
    totalPrice: number;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
  } | null;
  notes: Record<string, string>;
  card?: {
    network?: string;
    last4?: string;
    type?: string;
  } | null;
  vpa?: string | null;
}

interface Summary {
  totalCaptured: number;
  matchedCount: number;
  orphanedCount: number;
  mismatchedCount: number;
}

interface CustomItem {
  title: string;
  quantity: number;
  price: number;
  sku: string;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCaptured: 0,
    matchedCount: 0,
    orphanedCount: 0,
    mismatchedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "orphaned" | "mismatched" | "matched">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Recovery Modal State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/transactions?status=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.payments || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const handleOpenRecoveryModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setRecoveryError(null);
    setRecoverySuccess(null);
    setCustomerNote(`Recovered manually from Admin Transactions page for Razorpay payment ${tx.paymentId}`);
    // Initialize with 1 item matching payment amount
    setCustomItems([
      {
        title: "Order Item",
        quantity: 1,
        price: tx.amount,
        sku: "RECOVERED-ITEM"
      }
    ]);
  };

  const handleAddItem = () => {
    setCustomItems([...customItems, { title: "", quantity: 1, price: 0, sku: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setCustomItems(customItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof CustomItem, value: any) => {
    const updated = [...customItems];
    updated[index] = { ...updated[index], [field]: value };
    setCustomItems(updated);
  };

  const handleConfirmRecovery = async () => {
    if (!selectedTx || !selectedTx.razorpayOrderId) {
      setRecoveryError("Missing Razorpay order ID for recovery");
      return;
    }

    setRecovering(true);
    setRecoveryError(null);
    setRecoverySuccess(null);

    try {
      const res = await fetch("/api/admin/transactions/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: selectedTx.razorpayOrderId,
          razorpayPaymentId: selectedTx.paymentId,
          adminCustomItems: customItems,
          customerNote
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Recovery failed");
      }

      setRecoverySuccess(`Order ${data.internalOrderNumber || data.orderId} created successfully!`);
      setTimeout(() => {
        setSelectedTx(null);
        fetchTransactions();
      }, 1800);
    } catch (err: any) {
      setRecoveryError(err.message || "An unexpected error occurred during order recovery.");
    } finally {
      setRecovering(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    return (
      tx.paymentId.toLowerCase().includes(q) ||
      (tx.razorpayOrderId && tx.razorpayOrderId.toLowerCase().includes(q)) ||
      tx.customer.name.toLowerCase().includes(q) ||
      tx.customer.email.toLowerCase().includes(q) ||
      tx.customer.phone.includes(q) ||
      (tx.localOrder?.internalOrderNumber && tx.localOrder.internalOrderNumber.toLowerCase().includes(q))
    );
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20 relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Razorpay Transactions</h1>
          <p className="text-[11px] text-foreground/50 tracking-wide mt-0.5">
            Live ground-truth from Razorpay API cross-referenced against local database records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-[11px] font-medium transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <div className="flex items-center justify-between text-foreground/40 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Captured</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight">₹{summary.totalCaptured.toLocaleString("en-IN")}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <div className="flex items-center justify-between text-foreground/40 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Matched Orders</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-emerald-400">{summary.matchedCount}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <div className="flex items-center justify-between text-foreground/40 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Orphaned Payments</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-rose-400">{summary.orphanedCount}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-foreground/[0.05]">
          <div className="flex items-center justify-between text-foreground/40 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Mismatched Status</span>
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-400">{summary.mismatchedCount}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-foreground/[0.02] p-2 rounded-2xl border border-foreground/[0.05]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["all", "orphaned", "mismatched", "matched"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-[11px] font-medium capitalize transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab
                  ? "bg-foreground text-background font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {tab}
              {tab === "orphaned" && summary.orphanedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-rose-500 text-white font-bold">
                  {summary.orphanedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            placeholder="Search payment ID, email, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-background/50 rounded-xl border border-foreground/10 text-[11px] text-foreground focus:outline-none focus:border-foreground/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl border border-foreground/[0.05] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-foreground/[0.02] text-foreground/50 border-b border-foreground/[0.05] font-semibold uppercase tracking-wider text-[9px]">
              <tr>
                <th className="py-3 px-4">Payment ID / Razorpay Order</th>
                <th className="py-3 px-4">Captured At</th>
                <th className="py-3 px-4">Amount & Method</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Local Order</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-foreground/40">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Fetching transactions from Razorpay API...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-foreground/40">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.paymentId} className="hover:bg-foreground/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium">
                      <div className="text-foreground">{tx.paymentId}</div>
                      <div className="text-[9px] text-foreground/40">{tx.razorpayOrderId || "N/A"}</div>
                    </td>

                    <td className="py-3.5 px-4 text-foreground/60 whitespace-nowrap">
                      {new Date(tx.capturedAt).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground">₹{tx.amount.toLocaleString("en-IN")}</div>
                      <div className="text-[9px] text-foreground/50 uppercase tracking-wider flex items-center gap-1">
                        {tx.method} {tx.card?.last4 ? `(•${tx.card.last4})` : tx.vpa ? `(${tx.vpa})` : ""}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{tx.customer.name}</div>
                      <div className="text-[10px] text-foreground/50">{tx.customer.email}</div>
                      <div className="text-[9px] text-foreground/40">{tx.customer.phone}</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tx.classification === "Matched" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Matched
                        </span>
                      )}
                      {tx.classification === "Orphaned" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> Orphaned
                        </span>
                      )}
                      {tx.classification === "Mismatched" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <HelpCircle className="w-3 h-3" /> Mismatched
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[10px]">
                      {tx.localOrder ? (
                        <Link
                          href={`/dashboard/orders/${tx.localOrder.id}`}
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {tx.localOrder.internalOrderNumber || tx.localOrder.id.slice(0, 8)}
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-foreground/30 italic">No Local Order</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {tx.classification !== "Matched" && (
                        <button
                          onClick={() => handleOpenRecoveryModal(tx)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-all inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Create Order
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Recovery Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border border-foreground/10 space-y-6 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    Recover Orphaned Payment
                  </h2>
                  <p className="text-[10px] text-foreground/50 mt-0.5">
                    Razorpay Payment ID: <span className="font-mono text-foreground/80">{selectedTx.paymentId}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-full hover:bg-foreground/10 text-foreground/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Payment Context Card */}
              <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.05] space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-foreground/40 block text-[9px] uppercase tracking-wider">Amount Captured</span>
                    <span className="text-sm font-bold text-foreground">₹{selectedTx.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-foreground/40 block text-[9px] uppercase tracking-wider">Razorpay Order ID</span>
                    <span className="font-mono text-foreground/80">{selectedTx.razorpayOrderId || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-foreground/40 block text-[9px] uppercase tracking-wider">Customer Name</span>
                    <span className="font-medium text-foreground">{selectedTx.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-foreground/40 block text-[9px] uppercase tracking-wider">Email / Contact</span>
                    <span className="text-foreground/80">{selectedTx.customer.email} | {selectedTx.customer.phone}</span>
                  </div>
                </div>
              </div>

              {/* Recovery Error / Success Alerts */}
              {recoveryError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {recoveryError}
                </div>
              )}

              {recoverySuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {recoverySuccess}
                </div>
              )}

              {/* Custom Line Items Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground">Order Line Items</label>
                  <button
                    onClick={handleAddItem}
                    className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {customItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-background/40 p-2.5 rounded-xl border border-foreground/10">
                      <input
                        type="text"
                        placeholder="Item Title"
                        value={item.title}
                        onChange={(e) => handleItemChange(idx, "title", e.target.value)}
                        className="flex-1 bg-transparent border-none text-[11px] text-foreground focus:outline-none placeholder:text-foreground/30"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                        className="w-14 bg-background/60 px-2 py-1 rounded-lg border border-foreground/10 text-[11px] text-foreground text-center"
                      />
                      <input
                        type="number"
                        placeholder="Price ₹"
                        value={item.price}
                        onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                        className="w-24 bg-background/60 px-2 py-1 rounded-lg border border-foreground/10 text-[11px] text-foreground text-right"
                      />
                      {customItems.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer / Audit Note */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Internal Note / Remarks</label>
                <textarea
                  rows={2}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full bg-background/40 p-2.5 rounded-xl border border-foreground/10 text-[11px] text-foreground focus:outline-none focus:border-foreground/30 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-foreground/10 pt-4">
                <button
                  onClick={() => setSelectedTx(null)}
                  disabled={recovering}
                  className="px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/70 text-[11px] font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRecovery}
                  disabled={recovering}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20"
                >
                  {recovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Confirm Recovery & Create Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
