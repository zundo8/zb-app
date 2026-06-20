"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, Search, RefreshCw, Eye, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/manufacturing/knowledge-base", window.location.origin);
      if (q.trim()) url.searchParams.set("search", q.trim());
      const res = await mfgFetch(url.toString());
      const data = await res.json();
      if (res.ok) setEntries(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [q]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(loadData, 300);
    return () => clearTimeout(handler);
  }, [q, loadData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
            <BookOpen className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Product Knowledge Base</h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Approved Products Archive · {entries.length} entries
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card rounded-[1.5rem] p-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by Style Code or Product Name..."
            className="w-full bg-background/50 border border-foreground/10 rounded-xl pl-11 pr-4 py-2.5 text-[12px] font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card rounded-[1.5rem] overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
            <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Opening Archive...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-8">
            <BookOpen className="w-12 h-12 text-foreground/20 mb-4" />
            <p className="text-[13px] font-bold text-foreground/60">No approved products yet</p>
            <p className="text-[11px] text-foreground/40 mt-1 max-w-sm">Products appear here automatically when samples are approved by administrators.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
              <thead>
                <tr className="border-b border-foreground/15 text-[10px] uppercase font-bold text-foreground/50 tracking-widest bg-foreground/[0.01]">
                  <th className="px-6 py-4">Style Code</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Designer</th>
                  <th className="px-6 py-4">Fabric</th>
                  <th className="px-6 py-4">Printing Technique</th>
                  <th className="px-6 py-4">Approval Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5 font-medium">
                {entries.map((e) => (
                  <tr 
                    key={e.id}
                    className="hover:bg-foreground/[0.01] active:bg-foreground/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-[11px]">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.styleCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.productName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground/60">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.designer?.name || "Unassigned"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground/60">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.fabricUsed || "-"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground/60">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.printingTechnique || "-"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground/60">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="block">
                        {e.approvalDate ? formatDateTimeIST(e.approvalDate).split(",")[0] : "-"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/manufacturing/knowledge-base/${e.id}`} className="p-1.5 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-foreground/75 inline-block">
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
