"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, RefreshCw, Download, TrendingDown, TrendingUp, Activity, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MFG_STAGE_LABEL } from "@/lib/manufacturing/constants";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";
import { formatInr } from "@/lib/manufacturing/inr";

/** Highlight cost/unit column when above this (₹) - adjust for your margin targets */
const COST_PER_UNIT_WARN_THRESHOLD = 2500;

const MISC_EXPENSE_TYPES = [
  { value: "OTHER", label: "Other" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "COURIER", label: "Courier / logistics" },
  { value: "LABOUR", label: "Labour" },
  { value: "OVERHEAD", label: "Overhead" },
] as const;

type Summary = {
  totalWashSpend: number;
  totalPrintingSpend: number;
  totalEmbroiderySpend: number;
  totalTravelLogistics: number;
  totalFabricAttributed: number;
  totalMiscellaneous: number;
  grandTotalManufacturing: number;
};

type LedgerBatch = {
  batchId: string;
  batchCode: string;
  productName: string;
  quantity: number;
  currentStage: string;
  fabricCost: number;
  washCost: number;
  washCostPerUnit?: number;
  printingCost: number;
  embroideryCost: number;
  travelLogistics: number;
  miscellaneous: number;
  totalCost: number;
  costPerUnit: number;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
}

type TrendDeltas = Partial<Record<keyof Summary, number>>;

function DeltaBadge({ delta }: { delta: number | undefined }) {
  if (delta === undefined || !Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return <span className="text-[10px] text-foreground/35 font-medium">-</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {formatInr(Math.abs(delta), { maximumFractionDigits: 0 })}
    </span>
  );
}

export default function CostLedgerPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trendDeltas, setTrendDeltas] = useState<TrendDeltas | null>(null);
  const prevSummaryRef = useRef<Summary | null>(null);

  const [batches, setBatches] = useState<LedgerBatch[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [batchId, setBatchId] = useState("");
  const [stage, setStage] = useState("");

  const [batchOptions, setBatchOptions] = useState<{ id: string; batchCode: string }[]>([]);

  const [miscOpen, setMiscOpen] = useState(false);
  const [miscBatch, setMiscBatch] = useState("");
  const [miscExpenseType, setMiscExpenseType] = useState("OTHER");
  const [miscAmount, setMiscAmount] = useState("");
  const [miscDesc, setMiscDesc] = useState("");
  const [miscDate, setMiscDate] = useState("");
  const [miscErr, setMiscErr] = useState<Record<string, string>>({});

  const showToast = (m: string, t: "ok" | "err" = "ok") => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 4000);
  };

  const loadBatches = useCallback(async () => {
    try {
      const res = await mfgFetch("/api/admin/manufacturing/batches");
      const data = await res.json();
      if (!Array.isArray(data)) {
        setBatchOptions([]);
        return;
      }
      setBatchOptions(
        data.map((b: { id: string; batchCode: string }) => ({ id: b.id, batchCode: b.batchCode }))
      );
    } catch {
      setBatchOptions([]);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/manufacturing/cost-ledger", window.location.origin);
      if (from) url.searchParams.set("from", new Date(from).toISOString());
      if (to) url.searchParams.set("to", new Date(to).toISOString());
      if (batchId) url.searchParams.set("batchId", batchId);
      if (stage) url.searchParams.set("stage", stage);
      const res = await mfgFetch(url.toString());
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const raw = data.summary || {};
      const newSummary: Summary = {
        totalWashSpend: num(raw.totalWashSpend),
        totalPrintingSpend: num(raw.totalPrintingSpend),
        totalEmbroiderySpend: num(raw.totalEmbroiderySpend),
        totalTravelLogistics: num(raw.totalTravelLogistics),
        totalFabricAttributed: num(raw.totalFabricAttributed),
        totalMiscellaneous: num(raw.totalMiscellaneous),
        grandTotalManufacturing: num(raw.grandTotalManufacturing),
      };

      const prev = prevSummaryRef.current;
      prevSummaryRef.current = newSummary;
      if (prev) {
        const keys: (keyof Summary)[] = [
          "totalWashSpend",
          "totalPrintingSpend",
          "totalEmbroiderySpend",
          "totalTravelLogistics",
          "totalFabricAttributed",
          "totalMiscellaneous",
          "grandTotalManufacturing",
        ];
        const d: TrendDeltas = {};
        for (const k of keys) d[k] = newSummary[k] - prev[k];
        setTrendDeltas(d);
      } else {
        setTrendDeltas(null);
      }

      setSummary(newSummary);
      setBatches(
        Array.isArray(data.batches)
          ? data.batches.map((b: LedgerBatch) => ({
              ...b,
              fabricCost: num(b.fabricCost),
              washCost: num(b.washCost),
              washCostPerUnit: num(b.washCostPerUnit),
              printingCost: num(b.printingCost),
              embroideryCost: num(b.embroideryCost),
              travelLogistics: num(b.travelLogistics),
              miscellaneous: num(b.miscellaneous),
              totalCost: num(b.totalCost),
              costPerUnit: num(b.costPerUnit),
              quantity: num(b.quantity),
            }))
          : []
      );
      setRange(data.range || null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to load", "err");
      setSummary(null);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, batchId, stage]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const saveMisc = async () => {
    const e: Record<string, string> = {};
    const amt = num(miscAmount);
    if (!miscDesc.trim()) e.description = "Description required";
    if (!Number.isFinite(amt) || amt <= 0) e.amount = "Enter a valid amount";
    setMiscErr(e);
    if (Object.keys(e).length) return;

    try {
      const d = miscDate ? new Date(miscDate) : new Date();
      const res = await mfgFetch("/api/admin/manufacturing/misc", {
        method: "POST",
        body: JSON.stringify({
          batchId: miscBatch.trim() || undefined,
          expenseType: miscExpenseType,
          amount: amt,
          description: miscDesc.trim(),
          expenseDate: d.toISOString(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      showToast("Miscellaneous expense saved");
      setMiscOpen(false);
      setMiscBatch("");
      setMiscExpenseType("OTHER");
      setMiscAmount("");
      setMiscDesc("");
      setMiscDate("");
      setMiscErr({});
      loadLedger();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "err");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Batch code",
      "Style",
      "Qty",
      "Stage",
      "Fabric",
      "Wash",
      "Wash/unit",
      "Printing",
      "Embroidery",
      "Travel",
      "Misc",
      "Total",
      "Cost/unit",
    ];
    const rows = batches.map((b) => [
      b.batchCode,
      b.productName.replace(/"/g, '""'),
      String(b.quantity),
      MFG_STAGE_LABEL[b.currentStage] || b.currentStage,
      b.fabricCost.toFixed(2),
      b.washCost.toFixed(2),
      num(b.washCostPerUnit).toFixed(2),
      b.printingCost.toFixed(2),
      b.embroideryCost.toFixed(2),
      b.travelLogistics.toFixed(2),
      b.miscellaneous.toFixed(2),
      b.totalCost.toFixed(2),
      b.costPerUnit.toFixed(2),
    ]);
    const esc = (c: string) => `"${c}"`;
    const body = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cost-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("CSV downloaded");
  };

  const cards: {
    key: keyof Summary;
    label: string;
    highlight?: boolean;
  }[] = summary
    ? [
        { key: "totalFabricAttributed", label: "Fabric (attributed)" },
        { key: "totalWashSpend", label: "Total wash" },
        { key: "totalPrintingSpend", label: "Printing" },
        { key: "totalEmbroiderySpend", label: "Embroidery" },
        { key: "totalTravelLogistics", label: "Travel / logistics" },
        { key: "totalMiscellaneous", label: "Miscellaneous" },
        { key: "grandTotalManufacturing", label: "Grand total", highlight: true },
      ]
    : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10 overflow-hidden"
    >
      {/* Vibrant Orb Backgrounds */}
      <div className="absolute -right-24 -top-24 w-96 h-96 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -left-24 top-1/2 w-72 h-72 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[200] max-w-[90vw] w-max px-4 py-3 rounded-[1rem] text-[12px] font-bold shadow-2xl flex items-center justify-center gap-2 border backdrop-blur-xl ${
              toast.t === "ok" 
                ? "bg-background/90 text-foreground border-foreground/10" 
                : "bg-rose-500 text-foreground border-rose-500/20"
            }`}
          >
            {toast.t === "ok" && <Check className="w-4 h-4 text-emerald-500" />}
            {toast.m}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 lg:mb-10 relative z-10">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl lg:rounded-[2rem] bg-foreground/5 flex items-center justify-center text-foreground/50 dark:text-foreground/30 border border-foreground/5 shadow-2xl shrink-0">
            <Activity className="w-6 h-6 lg:w-8 lg:h-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground uppercase tracking-tighter leading-none truncate">
              Cost Ledger
            </h1>
            <p className="text-[9px] lg:text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em] lg:tracking-[0.3em] mt-1.5 lg:mt-2">
              Spectrum Financial Audit
            </p>
          </div>
        </div>
        
        <p className="text-[11px] lg:text-[12px] text-foreground/70 tracking-wide max-w-xl font-medium leading-relaxed hidden xl:block">
           Real-time cost attribution across all node stages. Audit trail of manufacturing capital flows.
        </p>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadLedger}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-3 bg-background dark:bg-foreground/[0.03] border border-foreground/[0.08] text-foreground rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
            Refresh
          </button>
          
          <button
            onClick={exportCsv}
            disabled={batches.length === 0}
             className="flex items-center gap-3 px-6 py-3 bg-background dark:bg-foreground/[0.03] border border-foreground/[0.08] text-foreground rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
            Export CSV
          </button>
 
          <button
            onClick={() => {
              setMiscOpen(true);
              setMiscErr({});
            }}
            className="flex items-center gap-3 px-8 py-3 bg-foreground text-background rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-foreground/20"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Record Misc
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 relative z-10">
        {loading && !summary ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/40 mb-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Computing ledger</span>
          </div>
        ) : (
          cards.map((c, i) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              key={c.key}
              className={`glass-card p-5 lg:p-6 relative overflow-hidden group rounded-[1.5rem] lg:rounded-[2rem] ${
                c.highlight 
                  ? "border-foreground/10 bg-foreground/[0.02] shadow-sm"
                  : ""
              }`}
            >
               <div className="flex justify-between items-start mb-3 lg:mb-4">
                <p className={`text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.2em] ${c.highlight ? "text-foreground" : "text-foreground/40"} `}>{c.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner ${
                    c.highlight ? "bg-foreground text-background border-transparent" : "bg-foreground/5 text-foreground/50 border-foreground/5"
                }`}>
                  <Activity className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
              </div>

              <div className="relative z-10">
                <p className={`text-xl lg:text-3xl font-bold tracking-tighter mb-2 ${
                    c.highlight ? "text-foreground" : "text-foreground/90"
                }`}>
                  {summary ? formatInr(summary[c.key]) : "₹ 0.00"}
                </p>
                <div className="flex items-center gap-2">
                   <DeltaBadge delta={trendDeltas?.[c.key]} />
                   {trendDeltas?.[c.key] !== undefined && trendDeltas?.[c.key] !== 0 && (
                     <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest leading-none mt-[1px]">vs Pre</span>
                   )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="glass-card rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-8 flex flex-col gap-6"
      >
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:flex-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 ml-1">From Date</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2.5 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 ml-1">To Date</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2.5 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Batch Code</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2.5 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm transition-all appearance-none"
              >
                <option value="">All Batches</option>
                {batchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.batchCode}</option>
                ))}
              </select>
            </div>
             <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2.5 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm transition-all appearance-none"
              >
                <option value="">All Stages</option>
                {Object.entries(MFG_STAGE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-foreground/5" />

      {/* Table Section */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="min-w-[900px] w-full">
             <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b border-foreground/5 text-[10px] uppercase font-bold text-foreground/40 tracking-[0.2em]">
                  <th className="px-4 py-4">Batch Details</th>
                  <th className="px-4 py-4">Stage</th>
                  <th className="px-4 py-4">Fabric</th>
                  <th className="px-4 py-4">Wash</th>
                  <th className="px-4 py-4">Print</th>
                  <th className="px-4 py-4">Emb</th>
                  <th className="px-4 py-4">Misc</th>
                  <th className="px-4 py-4 relative">
                     <span className="bg-foreground/5 px-2 py-1 rounded text-foreground/80 absolute top-1/2 -translate-y-1/2">Total</span>
                  </th>
                  <th className="px-4 py-4 relative">
                     <span className="bg-foreground/5 px-2 py-1 rounded text-foreground/80 absolute top-1/2 -translate-y-1/2">₹ / Unit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.03]">
                {loading && batches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Loading entries</span>
                      </div>
                    </td>
                  </tr>
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                       <p className="text-[12px] font-bold text-foreground/40 uppercase tracking-[0.3em]">No spectrum data matched</p>
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.batchId} className="hover:bg-foreground/[0.01] transition-all group duration-500">
                      <td className="px-4 py-4">
                        <div className="font-bold text-foreground/60 text-[10px] uppercase tracking-widest tabular-nums">{b.batchCode}</div>
                        <div className="font-semibold text-foreground text-[14px] leading-tight mb-1">{b.productName}</div>
                        <div className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">Qty: {b.quantity}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider bg-foreground/5 px-2 py-1 rounded-md">
                          {MFG_STAGE_LABEL[b.currentStage] || b.currentStage}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[13px] font-medium tabular-nums text-foreground/70">{formatInr(b.fabricCost)}</td>
                      <td className="px-4 py-4 text-[13px] font-medium tabular-nums text-foreground/70">{formatInr(b.washCost)}</td>
                      <td className="px-4 py-4 text-[13px] font-medium tabular-nums text-foreground/70">{formatInr(b.printingCost)}</td>
                      <td className="px-4 py-4 text-[13px] font-medium tabular-nums text-foreground/70">{formatInr(b.embroideryCost)}</td>
                      <td className="px-4 py-4 text-[13px] font-medium tabular-nums text-foreground/70">{formatInr(b.miscellaneous + b.travelLogistics)}</td>
                      <td className="px-4 py-4 text-[14px] font-bold tabular-nums text-foreground">{formatInr(b.totalCost)}</td>
                      <td className="px-4 py-4 tabular-nums">
                        <span className={`text-[12px] font-bold tracking-widest px-2 py-1 rounded-md border ${
                            b.costPerUnit > COST_PER_UNIT_WARN_THRESHOLD
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          }`}>
                          {formatInr(b.costPerUnit)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Misc Expense Modal */}
      <AnimatePresence>
        {miscOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Record Miscellaneous</h2>
                <p className="text-[12px] text-foreground/60 mt-1 tracking-wide">Batch linkage is optional.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Batch Linkage</label>
                  <select
                    value={miscBatch}
                    onChange={(e) => setMiscBatch(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm appearance-none"
                  >
                    <option value="">Unallocated</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.id}>{b.batchCode}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Expense Type</label>
                  <select
                    value={miscExpenseType}
                    onChange={(e) => setMiscExpenseType(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm appearance-none"
                  >
                    {MISC_EXPENSE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Amount (₹) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={miscAmount}
                    onChange={(e) => setMiscAmount(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm tabular-nums"
                  />
                  {miscErr.amount && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-widest ml-1">{miscErr.amount}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Description *</label>
                  <input
                    value={miscDesc}
                    onChange={(e) => setMiscDesc(e.target.value)}
                    placeholder="e.g. Courier, Labour"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                  />
                  {miscErr.description && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-widest ml-1">{miscErr.description}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Date</label>
                  <input
                    type="date"
                    value={miscDate}
                    onChange={(e) => setMiscDate(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setMiscOpen(false)}
                  className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[11px] font-bold text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMisc}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] hover:opacity-90 transition-all shadow-lg shadow-foreground/10"
                >
                  Commit Expense
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
