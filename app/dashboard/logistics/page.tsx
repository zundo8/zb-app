"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Truck,
  Package,
  Search,
  RefreshCw,
  Printer,
  Calendar,
  ExternalLink,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calculator,
  ArrowRight,
  Zap,
  Globe,
  Loader2,
  Box,
  CornerDownRight,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Shipment {
  id: string;
  orderId: string;
  awb: string | null;
  courier: string | null;
  status: string;
  trackingUrl: string | null;
  createdAt: string;
  order: {
    shopifyOrderId: string;
    fulfillmentStatus?: string;
    customer: {
      name: string | null;
    };
  };
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  manifested: { label: "Manifested", color: "text-cyan-400", bg: "bg-cyan-500/10", dot: "bg-cyan-400" },
  manifest_required: { label: "Awaiting Action", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  in_transit: { label: "In Transit", color: "text-blue-400", bg: "bg-blue-500/10", dot: "bg-blue-400" },
  out_for_delivery: { label: "Out for Delivery", color: "text-purple-400", bg: "bg-purple-500/10", dot: "bg-purple-400" },
  delivered: { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  rto: { label: "RTO", color: "text-rose-400", bg: "bg-rose-500/10", dot: "bg-rose-400" },
};

export default function LogisticsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tat, setTat] = useState({ origin: "", dest: "", result: null as any });
  const [calculating, setCalculating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/logistics/shipments?search=${search}`);
      const data = await res.json();
      if (data.success) setShipments(data.shipments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleTat = async () => {
    if (!tat.origin || !tat.dest) return;
    setCalculating(true);
    try {
      const res = await fetch(`/api/admin/logistics/tat?origin=${tat.origin}&destination=${tat.dest}`);
      const data = await res.json();
      if (data.success) setTat(prev => ({ ...prev, result: data.tat }));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-32 space-y-12 pt-4">
      {/* Apple Minimalist Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-foreground/40" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/20">Supply Chain</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Logistics</h1>
          <p className="text-[13px] text-foreground/40 max-w-md font-medium leading-relaxed">
            Global shipment orchestration and terminal manifest management.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end gap-1 px-8 border-r border-foreground/5">
            <span className="text-[9px] font-bold text-foreground/10 uppercase tracking-[0.2em]">Grid Status</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-tight italic">Operational</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
          <Link
            href="/dashboard/logistics/labels"
            className="flex items-center gap-3 px-8 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-foreground/5"
          >
            <Printer className="w-4 h-4" />
            Terminal Output
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Shipment Feed */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center gap-6 p-2 glass-card rounded-[24px] border border-foreground/5 shadow-2xl">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/10 group-focus-within:text-foreground/40 transition-colors" />
              <input
                type="text"
                placeholder="Query waybill manifest..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent pl-12 pr-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground/10 outline-none"
              />
            </div>
            <button onClick={fetchShipments} className="p-2.5 text-foreground/20 hover:text-foreground transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
            </button>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">
              <div className="col-span-4">Waybill / Order</div>
              <div className="col-span-4">Status / Carrier</div>
              <div className="col-span-4 text-right">Actions</div>
            </div>

            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="py-40 flex flex-col items-center justify-center space-y-6">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground/10" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-foreground/10 italic">Querying Nodes...</p>
                </div>
              ) : shipments.length === 0 ? (
                <div className="py-40 flex flex-col items-center justify-center space-y-6 border border-dashed border-foreground/5 rounded-[32px]">
                  <Box className="w-8 h-8 text-foreground/5" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/10">No live streams</p>
                </div>
              ) : (
                shipments.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl hover:bg-foreground/[0.03] border border-transparent hover:border-foreground/5 transition-all">
                      <div className="col-span-4 flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
                            <Layers className="w-4 h-4 text-foreground/20" />
                         </div>
                         <div>
                            <p className="text-[14px] font-semibold text-foreground tracking-tight">{s.awb || "SIGNAL_PENDING"}</p>
                            <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest mt-0.5">ORD #{s.order.shopifyOrderId.replace('#', '')}</p>
                         </div>
                      </div>

                      <div className="col-span-4">
                        <StatusBadge status={s.status} />
                        <p className="text-[10px] text-foreground/20 font-semibold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                          <Globe className="w-2.5 h-2.5" />
                          {s.courier || "Delhivery B2C"}
                        </p>
                      </div>

                      <div className="col-span-4 text-right flex items-center justify-end gap-2">
                        {s.awb ? (
                          <>
                            <button className="p-3 bg-foreground/5 hover:bg-foreground text-background border border-foreground/10 rounded-xl transition-all shadow-xl">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <a href={s.trackingUrl || "#"} target="_blank" className="p-3 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-foreground/40 hover:text-foreground transition-all shadow-xl">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <Link href={`/dashboard/orders/${s.orderId.replace('pending-', '')}`} className="px-6 py-2.5 bg-blue-500 text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-blue-500/20">
                            Manifest
                          </Link>
                        )}
                        <Link href={`/dashboard/orders/${s.orderId.replace('pending-', '')}`} className="p-3 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-foreground/20 hover:text-foreground transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Intelligence Tools Panel */}
        <div className="lg:col-span-4 space-y-12">
          {/* TAT Estimator - Apple Style */}
          <div className="glass-card rounded-[40px] border border-foreground/5 p-10 space-y-10 relative overflow-hidden">
             <div className="absolute -left-20 -top-20 w-40 h-40 bg-blue-500/10 blur-[80px] rounded-full" />
             
            <div className="space-y-2 relative z-10">
              <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em]">Temporal Engine</h3>
              <p className="text-[18px] font-semibold text-foreground tracking-tight italic">Expected TAT Estimator</p>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest ml-1">Origin</label>
                    <input 
                      type="text" 
                      placeholder="122001"
                      value={tat.origin}
                      onChange={(e) => setTat({...tat, origin: e.target.value})}
                      className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-[13px] text-foreground outline-none focus:border-foreground/20 transition-all font-mono placeholder:opacity-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest ml-1">Target</label>
                    <input 
                      type="text" 
                      placeholder="400001"
                      value={tat.dest}
                      onChange={(e) => setTat({...tat, dest: e.target.value})}
                      className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-[13px] text-foreground outline-none focus:border-foreground/20 transition-all font-mono placeholder:opacity-10"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleTat}
                  disabled={calculating}
                  className="w-full py-4 bg-foreground text-background rounded-[20px] text-[10px] font-bold uppercase tracking-[0.3em] shadow-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 group flex items-center justify-center gap-3"
                >
                  {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-background" />}
                  {calculating ? "Negotiating..." : "Execute Query"}
                </button>
              </div>

              <AnimatePresence>
                {tat.result && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-[24px] bg-foreground/[0.03] border border-foreground/5 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest italic">Arrival Window</span>
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                    <p className="text-[16px] font-bold text-foreground tracking-tight uppercase italic">{tat.result.expected_delivery_date || "D-Node Error"}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Infrastructure Metrics */}
          <div className="glass-card rounded-[40px] border border-foreground/5 p-10 space-y-8 bg-gradient-to-br from-white/[0.03] to-transparent shadow-2xl">
            <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em]">Grid Metrics</h3>
            <div className="space-y-6">
              {[
                { label: "Delivery Reach", value: "28,000+ Pins", color: "bg-blue-500" },
                { label: "Sync Latency", value: "0.8ms", color: "bg-emerald-500" },
                { label: "Webhook Node", value: "Operational", color: "bg-purple-500" },
              ].map((m, i) => (
                <div key={i} className="space-y-2.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-foreground/60 uppercase tracking-widest">{m.label}</span>
                    <span className="font-mono text-foreground/20 font-bold">{m.value}</span>
                  </div>
                  <div className="h-[1px] w-full bg-foreground/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: '100%' }} 
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                      className={`h-full ${m.color}`} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const theme = STATUS_THEME[status.toLowerCase()] || { 
    label: status.replace('_', ' '), 
    color: "text-foreground/40", 
    bg: "bg-foreground/5", 
    dot: "bg-foreground/20" 
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-foreground/5 ${theme.bg}`}>
      <div className={`w-1 h-1 rounded-full ${theme.dot}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>{theme.label}</span>
    </div>
  );
}
