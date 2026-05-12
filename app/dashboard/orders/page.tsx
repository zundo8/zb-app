"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Search,
  Plus,
  X,
  Edit2,
  Check,
  Truck,
  CreditCard,
  Package,
  Calendar,
  Filter,
  ArrowRight,
  Clock,
  Smartphone,
  ShoppingBag,
  AlertCircle,
  MoreHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string | null;
  image: string | null;
}

interface Order {
  id: string;
  shopifyOrderId: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string | null;
  fulfillmentStatus: string;
  deliveryStatus: string;
  createdAt: string;
  note: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  items: OrderItem[];
  shipments: any[];
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  paid: { label: "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  pending: { label: "Pending", color: "text-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  refunded: { label: "Refunded", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  fulfilled: { label: "Dispatched", color: "text-blue-500", bg: "bg-blue-500/10", dot: "bg-blue-500" },
  unfulfilled: { label: "Draft", color: "text-foreground/40", bg: "bg-foreground/5", dot: "bg-foreground/20" },
  delivered: { label: "Delivered", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  awaiting_approval: { label: "Reviewing", color: "text-purple-500", bg: "bg-purple-500/10", dot: "bg-purple-500" },
  payment_failed: { label: "Failed", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
};

function StatusBadge({ status }: { status: string }) {
  const theme = STATUS_THEME[status.toLowerCase()] || { 
    label: status, 
    color: "text-foreground/40", 
    bg: "bg-foreground/5", 
    dot: "bg-foreground/20" 
  };
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-foreground/5 ${theme.bg}`}>
      <div className={`w-1 h-1 rounded-full ${theme.dot}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>
        {theme.label}
      </span>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [paymentFilter, setPaymentFilter] = useState("any");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("any");
  const [platformFilter, setPlatformFilter] = useState("any");
  const [toast, setToast] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/orders?limit=50&status=${statusFilter}&paymentStatus=${paymentFilter}&fulfillmentStatus=${fulfillmentFilter}&platform=${platformFilter}&search=${search}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setTotal(data.total || data.orders.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter, fulfillmentFilter, platformFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setToast("Global Sync Successful");
        fetchOrders();
      }
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-32 space-y-12 pt-4">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-[100] glass-vibrancy px-6 py-3 rounded-2xl border border-foreground/10 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground shadow-2xl flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-foreground/40" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/20">Commerce Grid</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Orders</h1>
          <p className="text-[13px] text-foreground/40 max-w-md font-medium leading-relaxed">
            Manage your store's transactional data across all platforms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="group flex items-center gap-3 px-6 py-3 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 transition-transform group-hover:rotate-180 duration-700 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
          <Link
            href="/dashboard/orders/new"
            className="flex items-center gap-3 px-8 py-3 bg-foreground text-background rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-foreground/5"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 border-b border-foreground/5 pb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/10 group-focus-within:text-foreground/40 transition-colors" />
          <input
            type="text"
            placeholder="Search manifest..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent pl-12 pr-4 py-2 text-[13px] text-foreground placeholder:text-foreground/10 outline-none"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-foreground/5 border border-foreground/5 focus:border-foreground/20 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/40 outline-none appearance-none cursor-pointer pr-10"
            >
              <option value="any">Platform: All</option>
              <option value="web">Platform: Web</option>
              <option value="mobile">Platform: App</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/10 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-foreground/5 border border-foreground/5 focus:border-foreground/20 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/40 outline-none appearance-none cursor-pointer pr-10"
            >
              <option value="any">Payment: All</option>
              <option value="paid">Settled</option>
              <option value="pending">Awaiting</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/10 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
              className="bg-foreground/5 border border-foreground/5 focus:border-foreground/20 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/40 outline-none appearance-none cursor-pointer pr-10"
            >
              <option value="any">Fulfillment: All</option>
              <option value="fulfilled">Dispatched</option>
              <option value="unfulfilled">Draft</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/10 pointer-events-none" />
          </div>

          <div className="px-4 py-2.5 rounded-xl border border-foreground/5 text-[11px] font-bold text-foreground/20 uppercase tracking-widest">
            {total} Records
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">
          <div className="col-span-3">Entity / ID</div>
          <div className="col-span-3">Customer</div>
          <div className="col-span-2">Payment</div>
          <div className="col-span-2">Logistics</div>
          <div className="col-span-2 text-right">Value</div>
        </div>

        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="py-40 flex flex-col items-center justify-center space-y-6">
              <Loader2 className="w-6 h-6 animate-spin text-foreground/10" />
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/10">Synchronizing...</p>
            </div>
          ) : orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="group"
            >
              <Link 
                href={`/dashboard/orders/${order.id}`}
                className="grid grid-cols-12 gap-4 items-center px-6 py-5 rounded-2xl hover:bg-foreground/[0.03] border border-transparent hover:border-foreground/5 transition-all"
              >
                <div className="col-span-3 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
                    <ShoppingCart className="w-4 h-4 text-foreground/20" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground tracking-tight">#{order.shopifyOrderId.replace('#', '')}</span>
                      {order.shopifyOrderId.startsWith('ZB71') && (
                        <Smartphone className="w-3 h-3 text-foreground/20" />
                      )}
                    </div>
                    <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="col-span-3">
                  <p className="text-[13px] font-semibold text-foreground/80">{order.customer?.name || "Guest"}</p>
                  <p className="text-[10px] text-foreground/20 font-medium truncate max-w-[150px]">{order.customer?.email}</p>
                </div>

                <div className="col-span-2">
                  <StatusBadge status={order.paymentStatus} />
                </div>

                <div className="col-span-2">
                  <StatusBadge status={order.deliveryStatus || order.fulfillmentStatus || 'unfulfilled'} />
                </div>

                <div className="col-span-2 text-right flex items-center justify-end gap-4">
                   <p className="text-[15px] font-bold text-foreground tracking-tight">₹{order.totalPrice.toLocaleString("en-IN")}</p>
                   <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-foreground/10 translate-x-2 group-hover:translate-x-0">
                      <ChevronRight className="w-4 h-4 text-foreground/20" />
                   </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
