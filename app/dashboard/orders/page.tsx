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
      const url = `/api/admin/orders?limit=100&status=${statusFilter}&paymentStatus=${paymentFilter}&fulfillmentStatus=${fulfillmentFilter}&platform=${platformFilter}&search=${search}`;
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
    setToast("Initializing Shopify Sync...");
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setToast(`Sync Successful: ${data.synced?.orders || 0} orders updated`);
        fetchOrders();
      } else {
        setToast("Sync partial failure. Check logs.");
      }
    } catch (err) {
      setToast("Sync connection error");
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-32 space-y-10 pt-4">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-[100] glass-card px-6 py-3 rounded-2xl border border-foreground/10 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground shadow-2xl flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center shadow-2xl">
              <ShoppingBag className="w-6 h-6 text-foreground/30" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground uppercase">
                Order Manifest
              </h1>
              <p className="text-[11px] text-foreground/20 font-bold uppercase tracking-[0.4em] mt-1">
                Global Transactional Database
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="group flex items-center gap-3 px-8 py-3.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-700 ${syncing ? "animate-spin" : "group-hover:rotate-180"}`} />
            {syncing ? "Syncing..." : "Sync Shopify"}
          </button>
          <Link
            href="/dashboard/orders/new"
            className="flex items-center gap-3 px-10 py-3.5 bg-foreground text-background rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-95 transition-all shadow-2xl shadow-foreground/10"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Create
          </Link>
        </div>
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center border-b border-foreground/5 pb-10">
        <div className="xl:col-span-4 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/10 group-focus-within:text-foreground/40 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID, customer, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl pl-14 pr-6 py-4 text-[13px] text-foreground placeholder:text-foreground/10 outline-none focus:border-foreground/10 transition-all"
          />
        </div>
        
        <div className="xl:col-span-8 flex flex-wrap items-center justify-end gap-4">
          {[
            { value: platformFilter, onChange: setPlatformFilter, options: [
              { label: 'Platform: All', value: 'any' },
              { label: 'Platform: Web', value: 'web' },
              { label: 'Platform: App', value: 'mobile' }
            ]},
            { value: paymentFilter, onChange: setPaymentFilter, options: [
              { label: 'Payment: All', value: 'any' },
              { label: 'Settled', value: 'paid' },
              { label: 'Awaiting', value: 'pending' },
              { label: 'Failed', value: 'failed' }
            ]},
            { value: fulfillmentFilter, onChange: setFulfillmentFilter, options: [
              { label: 'Logistics: All', value: 'any' },
              { label: 'Dispatched', value: 'fulfilled' },
              { label: 'In Progress', value: 'unfulfilled' }
            ]}
          ].map((filter, i) => (
            <div key={i} className="relative group">
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="bg-foreground/[0.03] border border-foreground/5 hover:border-foreground/10 rounded-xl px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground/60 outline-none appearance-none cursor-pointer pr-12 transition-all"
              >
                {filter.options.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0A0A0A] text-foreground">{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/10 pointer-events-none group-hover:text-foreground/30 transition-colors" />
            </div>
          ))}

          <div className="h-10 w-[1px] bg-foreground/5 mx-2 hidden lg:block" />

          <div className="px-6 py-3 rounded-xl bg-foreground/5 border border-foreground/5 text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em]">
            <span className="text-foreground/60">{total}</span> Valid Signals
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-6 px-8 py-4 text-[10px] font-bold text-foreground/20 uppercase tracking-[0.3em]">
          <div className="col-span-3">Entity / Identification</div>
          <div className="col-span-3">Customer Identity</div>
          <div className="col-span-2">Settlement</div>
          <div className="col-span-2">Logistics</div>
          <div className="col-span-2 text-right">Market Value</div>
        </div>

        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="py-48 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-foreground/5" strokeWidth={1} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-foreground/20 animate-pulse" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-foreground/10">Reading Encrypted Logs...</p>
            </div>
          ) : orders.length === 0 ? (
             <div className="py-48 border border-dashed border-foreground/5 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-foreground/5 flex items-center justify-center border border-foreground/5">
                  <Package className="w-6 h-6 text-foreground/10" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-foreground/20">No matching transactions found</p>
             </div>
          ) : orders.map((order, i) => {
            const isMobile = order.shopifyOrderId.startsWith('ZB71') || (order as any).orderType === 'MOBILE_APP';
            
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015 }}
                className="group"
              >
                <Link 
                  href={`/dashboard/orders/${order.id}`}
                  className="grid grid-cols-12 gap-6 items-center px-8 py-6 rounded-[2rem] hover:bg-foreground/[0.02] border border-transparent hover:border-foreground/5 transition-all duration-500"
                >
                  <div className="col-span-3 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner transition-colors group-hover:bg-foreground/10 group-hover:border-foreground/10">
                      {isMobile ? (
                        <Smartphone className="w-5 h-5 text-foreground/40 group-hover:text-foreground/60 transition-colors" />
                      ) : (
                        <ShoppingCart className="w-5 h-5 text-foreground/30 group-hover:text-foreground/50 transition-colors" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-bold text-foreground tracking-tighter">
                          #{order.shopifyOrderId.replace('#', '')}
                        </span>
                        {isMobile && (
                          <div className="px-1.5 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 text-[8px] font-bold text-foreground/30 uppercase tracking-tighter">
                            APP
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-foreground/25 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <p className="text-[14px] font-bold text-foreground/80 tracking-tight mb-0.5">{order.customer?.name || "Guest Checkout"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-foreground/25 font-semibold truncate max-w-[200px]">
                      {order.customer?.email || order.customer?.phone || "Private Contact"}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={order.paymentStatus} />
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={order.deliveryStatus || order.fulfillmentStatus || 'unfulfilled'} />
                  </div>

                  <div className="col-span-2 text-right flex items-center justify-end gap-6">
                     <div className="text-right">
                        <p className="text-[16px] font-bold text-foreground tracking-tighter leading-none mb-1">
                          ₹{order.totalPrice.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-foreground/20 font-bold uppercase tracking-widest">
                          {order.items.length} Units
                        </p>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-foreground/10 translate-x-4 group-hover:translate-x-0">
                        <ChevronRight className="w-5 h-5 text-foreground/30" strokeWidth={2.5} />
                     </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
