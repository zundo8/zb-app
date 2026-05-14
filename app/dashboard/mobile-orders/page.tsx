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
  failed: { label: "Failed", bg: "bg-rose-500/10 text-rose-500", dot: "bg-rose-500" },
  delivered: { label: "Arrived", bg: "bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  manifested: { label: "Manifested", bg: "bg-blue-400/10 text-blue-400", dot: "bg-blue-400" },
  'in transit': { label: "In Transit", bg: "bg-indigo-400/10 text-indigo-400", dot: "bg-indigo-400" },
  'out for delivery': { label: "Out for Delivery", bg: "bg-amber-400/10 text-amber-400", dot: "bg-amber-400" },
  shipped: { label: "Shipped", bg: "bg-blue-500/10 text-blue-500", dot: "bg-blue-500" },
  open: { label: "Active", bg: "bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  fulfilled: { label: "Dispatched", bg: "bg-cyan-500/10 text-cyan-500", dot: "bg-cyan-500" },
  unfulfilled: { label: "Pending Fulfillment", bg: "bg-foreground/5 text-foreground/40", dot: "bg-foreground/20" },
  payment_pending: { label: "Awaiting Funds", bg: "bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
  cancelled: { label: "Cancelled", bg: "bg-rose-500/10 text-rose-500", dot: "bg-rose-500" },
};

export default function MobileOrdersPage() {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<'active' | 'abandoned'>('active');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setOffset(0);
    }

    try {
      const currentOffset = isLoadMore ? offset + 50 : 0;
      const res = await fetch(`/api/admin/mobile-orders?limit=50&offset=${currentOffset}${tab === 'abandoned' ? '&abandoned=true' : ''}${search ? `&search=${search}` : ''}`);
      const data = await res.json();
      
      if (data.success) {
        if (isLoadMore) {
          setOrders(prev => [...prev, ...data.orders]);
        } else {
          setOrders(data.orders);
        }
        setHasMore(data.hasMore);
        setTotal(data.total);
        if (isLoadMore) setOffset(currentOffset);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tab, search, offset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, search ? 500 : 0);
    return () => clearTimeout(timer);
  }, [tab, search]);

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
              onClick={() => { setTab('active'); setOrders([]); }}
              className={`px-6 py-2 rounded-lg text-[11px] font-semibold transition-all ${tab === 'active' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
            >
              Active
            </button>
            <button 
              onClick={() => { setTab('abandoned'); setOrders([]); }}
              className={`px-6 py-2 rounded-lg text-[11px] font-semibold transition-all ${tab === 'abandoned' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/40 hover:text-foreground'}`}
            >
              Abandoned
            </button>
          </div>
          <button onClick={() => fetchOrders()} className="p-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl border border-foreground/5 transition-all">
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
             <span className="text-[11px] font-semibold text-foreground/40 uppercase tracking-widest">{total} Records</span>
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
            orders.map((order, i) => {
              const isPendingSync = order.status === 'open' || !/^\d+$/.test(order.shopifyOrderId || '');
              
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="group"
                >
                  <div className="flex items-center gap-4">
                    <Link 
                      href={`/dashboard/orders/${order.id}`}
                      className="flex-1 grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl hover:bg-foreground/[0.03] border border-transparent hover:border-foreground/5 transition-all"
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
                        <StatusBadge status={isPendingSync ? 'awaiting_approval' : order.status} type="fulfillment" />
                      </div>

                      <div className="col-span-2 text-right">
                        <p className="text-[14px] font-semibold text-foreground tracking-tight">₹{order.totalPrice.toLocaleString()}</p>
                      </div>
                    </Link>

                    {isPendingSync && tab === 'active' && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          const confirmSync = confirm("Approve and Sync this order to Shopify?");
                          if (confirmSync) {
                            try {
                              const res = await fetch(`/api/admin/orders/${order.id}/approve`, { method: 'POST' });
                              const data = await res.json();
                              if (data.success) {
                                alert("Order synced successfully!");
                                fetchOrders();
                              } else {
                                alert("Sync failed: " + data.error);
                              }
                            } catch (err) {
                              alert("Sync error");
                            }
                          }
                        }}
                        className="px-4 py-2 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all mr-4 flex items-center gap-2"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Approve
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-10">
          <button 
            onClick={() => fetchOrders(true)}
            disabled={loadingMore}
            className="px-12 py-3 bg-foreground/[0.03] hover:bg-foreground hover:text-background border border-foreground/5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Expanding Records...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Load More Protocols
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, type = "payment" }: { status: string; type?: string }) {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, ' ');
  const theme = STATUS_THEME[normalizedStatus] || STATUS_THEME[status.toLowerCase()] || { 
    label: status.replace(/[_-]/g, ' '), 
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
