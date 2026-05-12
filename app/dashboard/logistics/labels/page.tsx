"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Printer,
  Package,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Download,
  ChevronLeft,
  X,
  ExternalLink,
  Square,
  CheckSquare,
  Zap,
  Box
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Shipment {
  id: string;
  awb: string | null;
  status: string;
  order: {
    shopifyOrderId: string;
    customer: {
      name: string | null;
    };
  };
}

export default function ShippingLabelsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchManifested = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logistics/shipments?status=manifested");
      const data = await res.json();
      if (data.success) setShipments(data.shipments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManifested();
  }, [fetchManifested]);

  const toggleSelect = (awb: string) => {
    setSelected(prev => 
      prev.includes(awb) ? prev.filter(a => a !== awb) : [...prev, awb]
    );
  };

  const selectAll = () => {
    if (selected.length === shipments.length) setSelected([]);
    else setSelected(shipments.map(s => s.awb!).filter(Boolean));
  };

  const handleGenerateLabels = async () => {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/logistics/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waybills: selected })
      });
      const data = await res.json();
      if (data.success) setLabelUrl(data.labelUrl);
    } finally {
      setGenerating(false);
    }
  };

  const filtered = shipments.filter(s => 
    s.awb?.toLowerCase().includes(search.toLowerCase()) || 
    s.order.shopifyOrderId.toLowerCase().includes(search.toLowerCase()) ||
    s.order.customer.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-32 pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/dashboard/logistics" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all">
              <ChevronLeft className="w-4 h-4 text-white/40" />
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Terminal Output</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Labels</h1>
          <p className="text-[13px] text-white/40 max-w-md font-medium leading-relaxed">
            Bulk manifest processing and terminal-ready output control.
          </p>
        </div>
        
        {selected.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 bg-white p-1.5 pl-6 rounded-2xl shadow-2xl"
          >
            <span className="text-[11px] font-bold text-black uppercase tracking-widest">{selected.length} Manifests Selected</span>
            <button 
              onClick={handleGenerateLabels}
              disabled={generating}
              className="flex items-center gap-3 px-8 py-3 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Generate Batch
            </button>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
             <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-white/40 transition-colors" />
              <input
                type="text"
                placeholder="Filter manifested queue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent pl-12 pr-4 py-2.5 text-[13px] text-white outline-none"
              />
            </div>
            <button 
              onClick={selectAll}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all border border-white/5"
            >
              {selected.length === shipments.length ? "Deselect" : "Select All"}
            </button>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
              <div className="col-span-1"></div>
              <div className="col-span-5">Waybill / ID</div>
              <div className="col-span-4">Status</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-4">
                   <Loader2 className="w-6 h-6 animate-spin text-white/10" />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-white/10">Querying Log...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-4 border border-dashed border-white/5 rounded-[32px]">
                   <Box className="w-8 h-8 text-white/5" />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-white/10">Queue empty</p>
                </div>
              ) : (
                filtered.map((s) => (
                  <motion.div 
                    key={s.id}
                    onClick={() => s.awb && toggleSelect(s.awb)}
                    className={`grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl border transition-all cursor-pointer group ${selected.includes(s.awb!) ? 'bg-white/[0.08] border-white/20' : 'border-transparent hover:bg-white/[0.03] hover:border-white/5'}`}
                  >
                    <div className="col-span-1">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${selected.includes(s.awb!) ? 'bg-white border-white' : 'border-white/10 bg-white/5'}`}>
                        {selected.includes(s.awb!) ? <CheckCircle2 className="w-3.5 h-3.5 text-black" /> : null}
                      </div>
                    </div>
                    <div className="col-span-5">
                      <p className="text-[14px] font-semibold text-white tracking-tight">{s.awb}</p>
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">ORD #{s.order.shopifyOrderId.replace('#', '')} | {s.order.customer.name}</p>
                    </div>
                    <div className="col-span-4">
                      <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">Manifested</span>
                    </div>
                    <div className="col-span-2 text-right">
                       <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mx-auto opacity-40 group-hover:opacity-100 transition-all">
                          <Printer className="w-3.5 h-3.5 text-white" />
                       </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="glass-card rounded-[40px] border border-white/5 p-10 space-y-10 min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
             <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-emerald-500/10 blur-[80px] rounded-full" />
             
            <AnimatePresence mode="wait">
              {labelUrl ? (
                <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 w-full relative z-10">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-2xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight uppercase">Batch Ready</h3>
                    <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">Terminal output initialized</p>
                  </div>
                  <div className="grid gap-3">
                    <a href={labelUrl} target="_blank" className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all">
                      <Printer className="w-4 h-4" />
                      Print Batch
                    </a>
                    <button onClick={() => setLabelUrl(null)} className="w-full py-4 text-[10px] font-bold text-white/20 uppercase tracking-widest hover:text-white transition-all">Dismiss</button>
                  </div>
                </motion.div>
              ) : generating ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 relative z-10">
                   <div className="w-12 h-12 border-2 border-white/5 border-t-white rounded-full animate-spin mx-auto" />
                   <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20 italic">Compiling Terminal Data...</p>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 relative z-10">
                   <FileText className="w-12 h-12 text-white/5 mx-auto" />
                   <p className="text-[11px] text-white/20 font-medium leading-relaxed max-w-[200px] mx-auto">
                     Select waybills from the queue to generate high-fidelity shipping manifests.
                   </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
