"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Smartphone,
  Search,
  RefreshCw,
  ChevronRight,
  Filter,
  CreditCard,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface MobileOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  paymentStatus: string;
  status: string;
  deliveryStatus: string;
  customer: {
    name: string;
    email: string;
  };
}

const STATUS_THEME: Record<string, { label: string; bg: string; dot: string }> = {
  paid: { label: "Settled", bg: "bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  success: { label: "Settled", bg: "bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  pending: { label: "Pending", bg: "bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
  awaiting_approval: { label: "Review Required", bg: "bg-purple-500/10 text-purple-500", dot: "bg-purple-500" },
  payment_failed: { label: "Failed", bg: "bg-rose-500/10 text-rose-500", dot: "bg-rose-500" },
  delivered: { label: "Arrived", bg: "bg-blue-500/10 text-blue-500", dot: "bg-blue-500" },
  open: { label: "Active", bg: "bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  fulfilled: { label: "Dispatched", bg: "bg-cyan-500/10 text-cyan-500", dot: "bg-cyan-500" },
  unfulfilled: { label: "Pending Fulfillment", bg: "bg-foreground/5 text-foreground/40", dot: "bg-foreground/20" },
  payment_pending: { label: "Awaiting Funds", bg: "bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
};

export default function MobileOrdersPage() {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<'active' | 'abandoned'>('active');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/mobile-orders?limit=50${tab === 'abandoned' ? '&abandoned=true' : ''}`);
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-32 pt-4">
      {/* Apple-Style Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-foreground/40" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/20">Mobile Ecosystem</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">App Orders</h1>
          <p className="text-[13px] text-foreground/40 max-w-md font-medium leading-relaxed">
            Manage transactions originating from the native mobile client.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-foreground/5 p-1 rounded-xl border border-foreground/5">
            <button 
              onClick={() => setTab('active')}
              className={`px-6 py-2 rounded-lg text-[11px] font-semibold transition-all ${tab === 'active' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setTab('abandoned')}
              className={`px-6 py-2 rounded-lg text-[11px] font-semibold transition-all ${tab === 'abandoned' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
            >
              Abandoned
            </button>
          </div>
          <button onClick={fetchOrders} className="p-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl border border-foreground/5 transition-all">
            <RefreshCw className={`w-4 h-4 text-foreground/40 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub-Header & Filters */}
      <div className="flex items-center gap-4 border-b border-foreground/5 pb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/10 group-focus-within:text-foreground/40 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent pl-12 pr-4 py-2 text-[13px] text-foreground placeholder:text-foreground/10 outline-none"
          />
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
             <span className="text-[11px] font-semibold text-foreground/40 uppercase tracking-widest">{orders.length} Records</span>
           </div>
        </div>
      </div>

      {/* Orders List - Ultra Minimal */}
      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">
          <div className="col-span-3">Entity / ID</div>
          <div className="col-span-3">Customer Profile</div>
          <div className="col-span-2">Settlement</div>
          <div className="col-span-2">Fulfillment</div>
          <div className="col-span-2 text-right">Value</div>
        </div>

        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="py-32 flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="w-6 h-6 animate-spin text-foreground/10" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/20">Syncing Node Data...</p>
            </motion.div>
          ) : orders.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="py-32 flex flex-col items-center justify-center space-y-4 border border-dashed border-foreground/5 rounded-3xl"
            >
              <Zap className="w-8 h-8 text-foreground/5" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/20">No active signals found</p>
            </motion.div>
          ) : (
            orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group"
              >
                <Link 
                  href={`/dashboard/orders/${order.id}`}
                  className="grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl hover:bg-foreground/[0.03] border border-transparent hover:border-foreground/5 transition-all"
                >
                  <div className="col-span-3 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5">
                      <Smartphone className="w-4 h-4 text-foreground/40" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground tracking-tight">#{order.orderNumber || order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-[10px] text-foreground/30 font-medium mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <p className="text-[12px] font-semibold text-foreground/80">{order.customer?.name || "Guest"}</p>
                    <p className="text-[10px] text-foreground/20 font-medium truncate max-w-[150px]">{order.customer?.email}</p>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={order.paymentStatus} />
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={order.status} type="fulfillment" />
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="flex items-center justify-end gap-3 group/row">
                      <p className="text-[14px] font-semibold text-foreground tracking-tight">₹{order.totalPrice.toLocaleString()}</p>
                      <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-foreground/10 translate-x-2 group-hover:translate-x-0">
                        <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusBadge({ status, type = "payment" }: { status: string; type?: string }) {
  const theme = STATUS_THEME[status.toLowerCase()] || { 
    label: status.replace('_', ' '), 
    bg: "bg-foreground/5 text-foreground/40", 
    dot: "bg-foreground/20" 
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-foreground/5 ${theme.bg}`}>
      <div className={`w-1 h-1 rounded-full ${theme.dot}`} />
      <span className="text-[9px] font-bold uppercase tracking-widest">{theme.label}</span>
    </div>
  );
}
