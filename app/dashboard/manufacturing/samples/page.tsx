"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FlaskConical, Search, RefreshCw, Beaker, ArrowRight, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function SamplesQueuePage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [q, setQ] = useState("");
  const [selStatus, setSelStatus] = useState("All");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/manufacturing/samples", window.location.origin);
      if (selStatus !== "All") url.searchParams.set("status", selStatus);
      const res = await mfgFetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load samples");
      setSamples(data);
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [selStatus]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Filter client-side
  const filteredSamples = samples.filter((s) => {
    return s.productName.toLowerCase().includes(q.toLowerCase()) || 
           s.styleCode.toLowerCase().includes(q.toLowerCase());
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "Pending Review": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Approved": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "Revision Required": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      default: return "bg-foreground/5 text-foreground/45 border border-foreground/10";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10"
    >
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[200] max-w-[90vw] w-max px-4 py-3 rounded-[1rem] text-[12px] font-bold shadow-2xl flex items-center justify-center gap-2 border backdrop-blur-xl ${
              toast.type === "ok" 
                ? "bg-background/90 text-foreground border-foreground/10" 
                : "bg-rose-500 text-white border-rose-500/20"
            }`}
          >
            {toast.type === "ok" && <Check className="w-4 h-4 text-emerald-500" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
            <FlaskConical className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Sample Queue</h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Quality Control · {filteredSamples.length} samples
            </p>
          </div>
        </div>

        <button
          onClick={loadSamples}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-[1.5rem] p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search samples (Style Code or Name)..."
            className="w-full bg-background/50 border border-foreground/10 rounded-xl pl-10 pr-4 py-2 text-[12px] font-medium text-foreground placeholder:text-foreground/30"
          />
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-1.5">
          {["All", "Pending Review", "Approved", "Rejected", "Revision Required"].map((status) => (
            <button
              key={status}
              onClick={() => setSelStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                selStatus === status 
                  ? "bg-foreground text-background border-foreground" 
                  : "bg-background/40 text-foreground/50 border-foreground/5 hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      {loading && samples.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
          <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Compiling Samples...</p>
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center glass-card rounded-[2rem] p-8">
          <Beaker className="w-12 h-12 text-foreground/20 mb-4" />
          <p className="text-[13px] font-bold text-foreground/60">No samples found</p>
          <p className="text-[11px] text-foreground/40 mt-1">Adjust your search or filters to see more.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSamples.map((s, i) => {
            const hasImages = s.images && s.images.length > 0;
            const firstImg = hasImages ? s.images[0].imageUrl : null;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-background/40 backdrop-blur-3xl border border-foreground/[0.06] hover:border-foreground/15 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col group relative"
              >
                {/* Image Section */}
                <div className="h-44 w-full bg-foreground/[0.02] border-b border-foreground/5 relative flex items-center justify-center overflow-hidden">
                  {firstImg ? (
                    <img 
                      src={firstImg} 
                      alt={s.productName} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <Beaker className="w-10 h-10 text-foreground/10 group-hover:scale-110 transition-transform duration-500" />
                  )}
                  
                  {/* Status Badge */}
                  <span className={`absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider backdrop-blur-md ${statusColor(s.status)}`}>
                    {s.status}
                  </span>

                  {/* Style Code */}
                  <span className="absolute bottom-4 left-4 font-mono font-bold tracking-tight text-[10px] bg-background/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-foreground/75 border border-foreground/5">
                    {s.styleCode}
                  </span>
                </div>

                {/* Details Section */}
                <div className="p-5 flex-1 flex flex-col space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-md font-bold text-foreground leading-tight">{s.productName}</h3>
                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider">
                      {s.designAssignment?.assignedTo?.name || "Unassigned"} · {s.designAssignment?.collection?.name || "No Collection"}
                    </p>
                  </div>

                  <div className="text-[10px] text-foreground/45 flex justify-between items-center pt-2 border-t border-foreground/5">
                    <span className="uppercase tracking-widest font-bold">Submitted Date:</span>
                    <span className="font-mono">{formatDateTimeIST(s.submittedAt).split(",")[0]}</span>
                  </div>

                  <Link href={`/dashboard/manufacturing/samples/${s.id}`} className="block pt-2">
                    <button className="w-full py-2.5 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1">
                      Review Sample <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
