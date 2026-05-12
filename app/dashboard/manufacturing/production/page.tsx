"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Plus, RefreshCw, LayoutGrid, Table2, ChevronDown, ChevronUp, Check, Search, Activity, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";
import { formatInr } from "@/lib/manufacturing/inr";
import {
  MFG_STAGE_LABEL,
  MFG_STAGE_BADGE_CLASS,
  MFG_STAGE_EMOJI,
  MFG_STAGE_KEYS,
} from "@/lib/manufacturing/constants";
import { 
  Package, 
  Scissors, 
  Shirt, 
  Palette as PaletteIcon, 
  Sparkles, 
  Waves, 
  CheckCircle2, 
  Beaker, 
  Award, 
  AlertOctagon 
} from "lucide-react";
import { BatchDrawer } from "../_components/BatchDrawer";

const STAGE_ICONS: Record<string, any> = {
  READY_FOR_PRODUCTION: Package,
  IN_PRODUCTION_CUTTING: Scissors,
  IN_PRODUCTION_STITCHING: Shirt,
  SENT_PRINTING: PaletteIcon,
  SENT_EMBROIDERY: Sparkles,
  SENT_WASH: Waves,
  RETURNED_COMBINED: CheckCircle2,
  SENT_SAMPLE: Beaker,
  QC_PASSED: Award,
  REJECTED_REWORK: AlertOctagon,
};

type FabricOpt = { id: string; sku: string; name: string; costPerMeter: number };

type BatchRow = {
  id: string;
  batchCode: string;
  productName: string;
  quantity: number;
  currentStage: string;
  isSampleDone: boolean;
  isCuttingDone: boolean;
  isStitchingDone: boolean;
  isPrintingDone: boolean;
  isEmbroideryDone: boolean;
  isWashingDone: boolean;
  washCostTotal?: number;
  totalCostSoFar?: number;
  updatedAt: string;
  fabric: FabricOpt | null;
  notes?: string | null;
};

type ActionKey =
  | "START_CUTTING"
  | "SEND_WASH"
  | "RETURN_WASH"
  | "SEND_PRINTING"
  | "RETURN_PRINTING"
  | "SEND_EMBROIDERY"
  | "RETURN_EMBROIDERY"
  | "SEND_STITCHING"
  | "RETURN_STITCHING"
  | "MARK_SAMPLE"
  | "QC_PASS"
  | "QC_REJECT";

const emptyActionForm = {
  quantity: "",
  pricePerUnit: "",
  travel: "",
  vendor: "",
  dateDispatched: "",
  dateReturned: "",
  notes: "",
  damageLoss: "",
  designRef: "",
  washTotalCost: "",
  totalCharges: "",
  remarks: "",
};

type ActionFormState = typeof emptyActionForm;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
}

function actionsForBatch(batch: BatchRow): { key: ActionKey; label: string }[] {
  const { currentStage, isSampleDone, isCuttingDone, isStitchingDone, isPrintingDone, isEmbroideryDone, isWashingDone } = batch;

  // 1. If Sample is NOT done, and we haven't started cutting, show Sample options
  if (!isSampleDone && !isCuttingDone && currentStage === "READY_FOR_PRODUCTION") {
    return [
      { key: "MARK_SAMPLE", label: "Mark as Sample" },
      { key: "START_CUTTING", label: "Start Production (Cutting)" },
    ];
  }

  if (currentStage === "SENT_SAMPLE") {
    return [
      { key: "QC_PASS", label: "Sample QC Pass (Approve for Production)" },
      { key: "QC_REJECT", label: "Sample QC Reject" },
    ];
  }

  // 2. Production Flow
  switch (currentStage) {
    case "READY_FOR_PRODUCTION":
      return [{ key: "START_CUTTING", label: "Start Cutting" }];

    case "IN_PRODUCTION_CUTTING":
      return [
        { key: "SEND_STITCHING", label: "Send to Stitching" },
        { key: "SEND_PRINTING", label: "Send to Printing" },
        { key: "SEND_EMBROIDERY", label: "Send to Embroidery" },
        { key: "SEND_WASH", label: "Send to Wash" },
        { key: "QC_PASS", label: "Final QC Pass" },
        { key: "QC_REJECT", label: "Final QC Reject" },
      ];

    case "IN_PRODUCTION_STITCHING":
      return [
        { key: "RETURN_STITCHING", label: "Returned from Stitching" },
        { key: "SEND_PRINTING", label: "Send to Printing" },
        { key: "SEND_EMBROIDERY", label: "Send to Embroidery" },
        { key: "SEND_WASH", label: "Send to Wash" },
        { key: "QC_PASS", label: "Final QC Pass" },
        { key: "QC_REJECT", label: "Final QC Reject" },
      ];

    case "SENT_PRINTING":
      return [{ key: "RETURN_PRINTING", label: "Returned from Printing" }];

    case "SENT_EMBROIDERY":
      return [{ key: "RETURN_EMBROIDERY", label: "Returned from Embroidery" }];

    case "SENT_WASH":
      return [{ key: "RETURN_WASH", label: "Returned from Wash" }];

    case "RETURNED_COMBINED":
      const actions: { key: ActionKey; label: string }[] = [];
      if (!isStitchingDone) actions.push({ key: "SEND_STITCHING", label: "Send to Stitching" });
      if (!isPrintingDone) actions.push({ key: "SEND_PRINTING", label: "Send to Printing" });
      if (!isEmbroideryDone) actions.push({ key: "SEND_EMBROIDERY", label: "Send to Embroidery" });
      if (!isWashingDone) actions.push({ key: "SEND_WASH", label: "Send to Wash" });
      
      actions.push({ key: "QC_PASS", label: "Final QC Pass" });
      actions.push({ key: "QC_REJECT", label: "Final QC Reject" });
      return actions;

    case "QC_PASSED":
    case "REJECTED_REWORK":
      return []; // Completed or locked for rework

    default:
      return [];
  }
}

function stageProgressIndex(stage: string): number {
  const i = MFG_STAGE_KEYS.indexOf(stage as (typeof MFG_STAGE_KEYS)[number]);
  if (i >= 0) return i;
  return 0;
}

export default function ProductionTrackerPage() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [fabrics, setFabrics] = useState<FabricOpt[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [q, setQ] = useState("");
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "table">("card");

  const [newOpen, setNewOpen] = useState(false);
  const [nb, setNb] = useState({
    productName: "",
    quantity: "",
    fabricId: "",
    fabricMeters: "",
    notes: "",
    estCpu: "",
    currentStage: "READY_FOR_PRODUCTION",
  });
  const [nbErr, setNbErr] = useState<Record<string, string>>({});

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [modal, setModal] = useState<{ batch: BatchRow; action: ActionKey } | null>(null);
  const [act, setAct] = useState<ActionFormState>({ ...emptyActionForm });
  const [actErr, setActErr] = useState<Record<string, string>>({});

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandData, setExpandData] = useState<Record<string, { breakdown: unknown } | null>>({});
  const [expandLoad, setExpandLoad] = useState<Record<string, boolean>>({});

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFabrics = useCallback(async () => {
    const res = await mfgFetch("/api/admin/manufacturing/fabric");
    const data = await res.json();
    setFabrics(
      Array.isArray(data)
        ? data.map((f: FabricOpt) => ({
            ...f,
            costPerMeter: num(f.costPerMeter),
          }))
        : []
    );
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      const res = await mfgFetch("/api/admin/manufacturing/vendors");
      const data = await res.json();
      if (Array.isArray(data)) setVendors(data);
    } catch {}
  }, []);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/manufacturing/batches", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (filterStage) url.searchParams.set("stage", filterStage);
      const res = await mfgFetch(url.toString());
      const data = await res.json();
      if (!Array.isArray(data)) {
        setBatches([]);
        if (data?.error) showToast(String(data.error), "err");
        return;
      }
      setBatches(
        data.map((b: BatchRow) => ({
          ...b,
          quantity: num(b.quantity),
          washCostTotal: num(b.washCostTotal),
          totalCostSoFar: num(b.totalCostSoFar),
        }))
      );
    } catch {
      showToast("Could not load batches", "err");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [q, filterStage]);

  useEffect(() => {
    loadFabrics();
    loadVendors();
  }, [loadFabrics, loadVendors]);

  useEffect(() => {
    const t = setTimeout(loadBatches, 280);
    return () => clearTimeout(t);
  }, [loadBatches]);

  const toggleExpand = async (id: string) => {
    const next = !expanded[id];
    setExpanded((e) => ({ ...e, [id]: next }));
    if (next && !expandData[id]) {
      setExpandLoad((l) => ({ ...l, [id]: true }));
      try {
        const res = await mfgFetch(`/api/admin/manufacturing/batches/${id}/detail`);
        const j = await res.json();
        if (res.ok) setExpandData((d) => ({ ...d, [id]: j }));
      } finally {
        setExpandLoad((l) => ({ ...l, [id]: false }));
      }
    }
  };

  const createBatch = async () => {
    const err: Record<string, string> = {};
    if (!nb.productName.trim()) err.productName = "Required";
    const qty = Number(nb.quantity);
    if (!Number.isFinite(qty) || qty <= 0) err.quantity = "Enter a positive quantity";
    const meters = Number(nb.fabricMeters);
    if (nb.fabricId && (!Number.isFinite(meters) || meters < 0)) err.fabricMeters = "Invalid meters";
    if (Object.keys(err).length) {
      setNbErr(err);
      return;
    }
    setNbErr({});
    try {
      const res = await mfgFetch("/api/admin/manufacturing/batches", {
        method: "POST",
        body: JSON.stringify({
          productName: nb.productName.trim(),
          quantity: qty,
          fabricId: nb.fabricId || null,
          fabricMetersConsumed: nb.fabricId ? meters : 0,
          notes: nb.notes.trim() || null,
          estimatedCostPerUnit: nb.estCpu ? Number(nb.estCpu) : null,
          currentStage: nb.currentStage,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      showToast("Batch created and saved");
      setNewOpen(false);
      setNb({
        productName: "",
        quantity: "",
        fabricId: "",
        fabricMeters: "",
        notes: "",
        estCpu: "",
        currentStage: "READY_FOR_PRODUCTION",
      });
      loadBatches();
      loadFabrics();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "err");
    }
  };

  const openAction = (batch: BatchRow, action: ActionKey) => {
    setModal({ batch, action });
    setAct({ ...emptyActionForm });
    setActErr({});
  };

  const validateAction = (): boolean => {
    if (!modal) return false;
    const e: Record<string, string> = {};
    const a = modal.action;
    if (
      ["SEND_WASH", "SEND_PRINTING", "SEND_EMBROIDERY", "SEND_STITCHING", "RETURN_WASH", "RETURN_PRINTING", "RETURN_EMBROIDERY", "RETURN_STITCHING", "MARK_SAMPLE"].includes(a) &&
      !act.quantity.trim()
    ) {
      e.quantity = "Required";
    }
    if (["SEND_WASH", "SEND_PRINTING", "SEND_EMBROIDERY", "SEND_STITCHING"].includes(a) && !act.pricePerUnit.trim()) {
      e.pricePerUnit = "Required";
    }
    if (["RETURN_WASH"].includes(a) && !act.washTotalCost.trim()) {
      e.washTotalCost = "Enter total wash charges";
    }
    setActErr(e);
    return Object.keys(e).length === 0;
  };

  const submitAction = async () => {
    if (!modal || !validateAction()) return;
    const body: Record<string, unknown> = {
      action: modal.action,
      quantity: act.quantity ? Number(act.quantity) : undefined,
      pricePerUnit: act.pricePerUnit ? Number(act.pricePerUnit) : undefined,
      travel: act.travel ? Number(act.travel) : undefined,
      travelExpense: act.travel ? Number(act.travel) : undefined,
      vendor: act.vendor || undefined,
      vendorName: act.vendor || undefined,
      artisanName: act.vendor || undefined,
      dateDispatched: act.dateDispatched || undefined,
      dateReturned: act.dateReturned || undefined,
      notes: act.notes || undefined,
      damageLoss: act.damageLoss ? Number(act.damageLoss) : undefined,
      designRef: act.designRef || undefined,
      washTotalCost: act.washTotalCost ? Number(act.washTotalCost) : undefined,
      remarks: act.remarks || undefined,
      costAmount: act.totalCharges ? Number(act.totalCharges) : undefined,
    };
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/batches/${modal.batch.id}/action`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");

      // Trigger Production Update Email to Vendor
      if (body.vendor) {
        try {
          // Find vendor email if available in vendors state
          const vendorObj = vendors.find(v => v.id === body.vendor || v.name === body.vendor);
          const vEmail = (vendorObj as any)?.email || process.env.VENDOR_NOTIFICATION_EMAIL || 'vendors@zicabella.com';
          
          await fetch('/api/email/production-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vendorEmail: vEmail,
              vendorName: body.vendorName || body.vendor,
              taskId: modal.batch.id,
              productName: modal.batch.productName,
              fromStage: modal.batch.currentStage,
              toStage: j.newStage || modal.action, // Use the new stage from response
              notes: body.notes,
              dashboardUrl: `https://app.zicabella.com/dashboard/manufacturing/production?id=${modal.batch.id}`,
            }),
          });
        } catch (emailErr) {
          console.error('Failed to send production update email:', emailErr);
        }
      }

      showToast("Saved - stage updated");
      setModal(null);
      loadBatches();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "err");
    }
  };

  const openDrawer = (id: string) => {
    setDrawerId(id);
    setDrawerOpen(true);
  };

  const pipelineClick = (key: string) => {
    setFilterStage((s) => (s === key ? null : key));
  };

  const progressPct = (stage: string) => {
    const idx = stageProgressIndex(stage);
    return Math.round(((idx + 1) / MFG_STAGE_KEYS.length) * 100);
  };

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

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner shrink-0">
             <ClipboardList className="w-5 h-5 text-foreground/40" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-foreground tracking-tight leading-none truncate uppercase">
              Production Tracker
            </h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Operations · {batches.length} batches
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
          <div className="bg-foreground/[0.03] p-0.5 rounded-lg flex border border-foreground/5">
            <button
              onClick={() => setView("card")}
              className={`p-1.5 rounded-md transition-all ${
                view === "card" ? "bg-background shadow-md text-foreground" : "text-foreground/40 hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
             <button
              onClick={() => setView("table")}
              className={`p-1.5 rounded-md transition-all ${
                view === "table" ? "bg-background shadow-md text-foreground" : "text-foreground/40 hover:text-foreground"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={loadBatches}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
            Refresh
          </button>

          <button
            onClick={() => {
              setNewOpen(true);
              setNbErr({});
            }}
            className="flex items-center gap-2 px-5 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/15"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New Batch
          </button>
        </div>

        <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.8 }}
        className="glass-card rounded-[1.2rem] lg:rounded-[2rem] p-3 lg:p-6 flex flex-col gap-4 lg:gap-5"
      >
        {/* Stage Pipeline */}
        <div className="bg-foreground/[0.03] backdrop-blur-xl rounded-2xl p-1.5 border border-foreground/5 overflow-hidden shadow-inner">
          <div className="flex overflow-x-auto custom-scrollbar gap-2 py-1 px-1 hide-scroll">
            {MFG_STAGE_KEYS.map((key) => {
              const Icon = STAGE_ICONS[key] || Activity;
              return (
                <button
                  key={key}
                  onClick={() => setFilterStage((s) => (s === key ? null : key))}
                  className={`px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-all flex items-center gap-2 group ${
                    filterStage === key
                      ? "bg-foreground text-background shadow-2xl scale-[1.02]"
                      : "text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${filterStage === key ? "text-background" : "text-foreground/40 group-hover:text-foreground"}`} strokeWidth={2.5} />
                  {MFG_STAGE_LABEL[key]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full sm:max-w-md">
           <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search batches..."
            className="w-full bg-background/50 border border-foreground/10 rounded-xl pl-10 pr-4 py-2 lg:py-2.5 text-[12px] font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30 transition-all shadow-sm"
          />
        </div>

        {loading && batches.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-foreground/40">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Computing nodes</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <LayoutGrid className="w-12 h-12 text-foreground/20 mb-4" />
            <p className="text-[13px] font-bold text-foreground/60">No batches match</p>
            <p className="text-[11px] text-foreground/40 mt-1 max-w-sm">Create a new batch with style, quantity, optional fabric consumption to log automatically.</p>
          </div>
        ) : view === "table" ? (
          <div className="w-full rounded-2xl border border-foreground/10 overflow-hidden bg-background shadow-sm overflow-x-auto">
            <div className="min-w-[800px] w-full custom-scrollbar">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-foreground/[0.02] border-b border-foreground/10 text-[10px] uppercase font-bold text-foreground/50 tracking-widest">
                <tr>
                  <th className="px-5 py-4">Batch</th>
                  <th className="px-5 py-4">Style</th>
                  <th className="px-5 py-4">Qty</th>
                  <th className="px-5 py-4">Stage</th>
                  <th className="px-5 py-4">Fabric</th>
                  <th className="px-5 py-4">Cost so far</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-foreground/[0.02] transition-colors group">
                    <td className="px-5 py-4 font-mono text-[11px] font-medium text-foreground/70">{b.batchCode}</td>
                    <td className="px-5 py-4 font-bold text-[13px] text-foreground">{b.productName}</td>
                    <td className="px-5 py-4 font-medium text-[12px]">{b.quantity}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold tracking-wider ${
                          MFG_STAGE_BADGE_CLASS[b.currentStage] || "bg-foreground/5 text-foreground/60"
                        }`}
                      >
                       {MFG_STAGE_EMOJI[b.currentStage]} {MFG_STAGE_LABEL[b.currentStage] || b.currentStage}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-foreground/60 font-medium">
                      {b.fabric ? (
                        <span className="font-mono text-[11px]">{b.fabric.sku}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-[13px]">{formatInr(num(b.totalCostSoFar))}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openDrawer(b.id)}
                        className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {batches.map((b) => {
              const ex = expanded[b.id];
              const ed = expandData[b.id] as { breakdown?: Record<string, number> } | null;
              const pct = progressPct(b.currentStage);
              const StageIcon = STAGE_ICONS[b.currentStage] || Activity;
              
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="bg-background/40 backdrop-blur-3xl border border-foreground/[0.06] hover:border-foreground/15 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col relative group/card"
                >
                  {/* Progress bar background at top */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-foreground/[0.03]">
                    <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${pct}%` }}
                       className="h-full bg-gradient-to-r from-foreground/40 to-foreground shadow-[0_0_10px_rgba(0,0,0,0.1)]" 
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => openDrawer(b.id)}
                    className="w-full text-left p-5 lg:p-6 pt-7 pb-3 focus:outline-none flex flex-col h-full group"
                  >
                    <div className="flex justify-between items-start gap-4 mb-5">
                      <div className="font-mono text-[9px] font-bold text-foreground/40 backdrop-blur-md bg-foreground/[0.03] px-2.5 py-1 rounded-full border border-foreground/5">{b.batchCode}</div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[0.2em] leading-none flex items-center gap-2 border ${
                          MFG_STAGE_BADGE_CLASS[b.currentStage] || "bg-foreground/5 text-foreground/60 border border-foreground/10"
                        }`}
                      >
                        <StageIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                        {MFG_STAGE_LABEL[b.currentStage]}
                      </span>
                    </div>
                    
                    <h3 className="text-lg lg:text-xl font-bold text-foreground leading-tight tracking-tighter mb-5 group-hover:text-foreground/80 transition-colors">
                      {b.productName}
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-2 mb-5 w-full">
                      <div className="bg-foreground/[0.02] backdrop-blur-md rounded-xl p-3 border border-foreground/5 space-y-1 group-hover:bg-foreground/[0.04] transition-colors">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-[0.15em]">Units</div>
                        <div className="text-[16px] font-bold text-foreground tabular-nums leading-none tracking-tight">{b.quantity}</div>
                      </div>
                      <div className="bg-foreground/[0.02] backdrop-blur-md rounded-xl p-3 border border-foreground/5 space-y-1 group-hover:bg-foreground/[0.04] transition-colors">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-[0.15em]">Valuation</div>
                        <div className="text-[16px] font-bold text-foreground tabular-nums leading-none tracking-tight">{formatInr(num(b.totalCostSoFar))}</div>
                      </div>
                      <div className="bg-foreground/[0.02] backdrop-blur-md rounded-xl p-3 border border-foreground/5 space-y-1 group-hover:bg-foreground/[0.04] transition-colors">
                        <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-[0.15em]">Wash</div>
                        <div className="text-[16px] font-bold text-foreground tabular-nums leading-none tracking-tight">{formatInr(num(b.washCostTotal))}</div>
                      </div>
                    </div>

                    {b.fabric && (
                      <div className="flex items-center gap-3 mt-auto pt-4 text-[11px] font-medium text-foreground/50 border-t border-foreground/5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-foreground/5 border border-foreground/5"><LayoutGrid className="w-3.5 h-3.5 opacity-60" /></div>
                        <span className="font-mono font-bold tracking-tight text-foreground/70">{b.fabric.sku}</span>
                        <span className="truncate flex-1 font-medium">{b.fabric.name}</span>
                      </div>
                    )}
                  </button>

                  <div className="px-6 lg:px-8 pb-6 pt-2">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {actionsForBatch(b).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAction(b, key);
                          }}
                          className="px-3 py-1.5 bg-foreground text-background rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all hover:opacity-90 shadow-sm"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(b.id);
                        }}
                        className="px-3 py-1.5 bg-background border border-foreground/10 rounded-lg text-[9px] font-bold uppercase tracking-wider text-foreground/60 hover:text-foreground transition-all flex items-center gap-1 ml-auto shadow-sm"
                      >
                        {ex ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Breakdown
                      </button>
                    </div>

                    <AnimatePresence>
                      {ex && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 pb-1">
                            {expandLoad[b.id] ? (
                              <div className="py-4 flex justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-foreground/40" />
                              </div>
                            ) : ed?.breakdown ? (
                              <BreakdownMini b={ed.breakdown as Record<string, number>} />
                            ) : (
                              <p className="text-[10px] text-foreground/40 uppercase tracking-widest text-center py-4">No metadata found.</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* New batch modal */}
      <AnimatePresence>
        {newOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 max-h-[92vh] overflow-y-auto flex flex-col gap-6"
            >
              <div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Initiate Batch</h2>
                <p className="text-[12px] text-foreground/60 mt-1 tracking-wide">Batch ID auto-generates linked to current date.</p>
              </div>
              
              <div className="space-y-5">
                <Field
                  label="Style / Product Name *"
                  value={nb.productName}
                  onChange={(v) => setNb((s) => ({ ...s, productName: v }))}
                  error={nbErr.productName}
                />
                <Field
                  label="Unit Quantity *"
                  type="number"
                  value={nb.quantity}
                  onChange={(v) => setNb((s) => ({ ...s, quantity: v }))}
                  error={nbErr.quantity}
                />
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Fabric Association</label>
                  <select
                    value={nb.fabricId}
                    onChange={(e) => setNb((s) => ({ ...s, fabricId: e.target.value }))}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm appearance-none"
                  >
                    <option value="">None (Optional)</option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.sku} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                {nb.fabricId ? (
                  <motion.div initial={{ opacity:0, height: 0 }} animate={{ opacity:1, height: 'auto' }}>
                    <Field
                      label="Fabric meters (logs OUT) *"
                      type="number"
                      value={nb.fabricMeters}
                      onChange={(v) => setNb((s) => ({ ...s, fabricMeters: v }))}
                      error={nbErr.fabricMeters}
                    />
                  </motion.div>
                ) : null}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">Initial Stage</label>
                  <select
                    value={nb.currentStage}
                    onChange={(e) => setNb((s) => ({ ...s, currentStage: e.target.value }))}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm appearance-none"
                  >
                    {MFG_STAGE_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {MFG_STAGE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Internal Notes"
                  textarea
                  value={nb.notes}
                  onChange={(v) => setNb((s) => ({ ...s, notes: v }))}
                />
                <Field
                  label="Est cost per unit (₹)"
                  type="number"
                  value={nb.estCpu}
                  onChange={(v) => setNb((s) => ({ ...s, estCpu: v }))}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[11px] font-bold text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createBatch}
                  className="flex-[2] flex items-center justify-center px-4 py-3 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] hover:opacity-90 transition-all shadow-lg shadow-foreground/10"
                >
                  Initiate Batch
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-full max-w-md glass rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">{modal.action.replace(/_/g, " ")}</h2>
                <p className="text-[12px] text-foreground/60 mt-1 tracking-wide">Recording transition for batch: <span className="font-mono text-foreground">{modal.batch.batchCode}</span></p>
              </div>
              
              <div className="space-y-4">
                <ActionFields 
                  action={modal.action} 
                  act={act} 
                  setAct={setAct} 
                  actErr={actErr} 
                  vendors={vendors}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[11px] font-bold text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitAction}
                  className="flex-[2] flex items-center justify-center px-4 py-3 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] hover:opacity-90 transition-all shadow-lg shadow-foreground/10"
                >
                  Record Sync
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BatchDrawer
        batchId={drawerId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
        }}
        onSaved={() => loadBatches()}
      />
    </motion.div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
  error?: string;
}) {
  const { label, value, onChange, type = "text", textarea, error } = props;
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
        />
      )}
      {error && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
}

function BreakdownMini({ b }: { b: Record<string, number> }) {
  const rows: [string, string][] = [
    ["Fabric Node", "fabricCost"],
    ["Wash Ref", "washCost"],
    ["Wash / Unit", "washCostPerUnit"],
    ["Print Nodes", "printingCost"],
    ["Embroidery Nodes", "embroideryCost"],
    ["Logistics Pool", "travelLogistics"],
    ["Metadata Misc", "miscellaneous"],
    ["Net Valuation", "totalCost"],
    ["Nodes CPU", "costPerUnit"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {rows.map(([label, key]) => (
          <div key={key} className="flex flex-col gap-1 border-b border-foreground/5 pb-2">
            <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">{label}</span>
            <span className="text-[12px] font-medium tabular-nums text-foreground/80">{formatInr(Number(b[key] ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionFields({
  action,
  act,
  setAct,
  actErr,
  vendors,
}: {
  action: ActionKey;
  act: ActionFormState;
  setAct: Dispatch<SetStateAction<ActionFormState>>;
  actErr: Record<string, string>;
  vendors: { id: string; name: string; category: string }[];
}) {
  const f = (k: keyof ActionFormState, label: string, type = "text", ta?: boolean) => (
    <div key={String(k)} className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/60 ml-1">{label}</label>
      {k === "vendor" ? (
        <select
          value={act[k]}
          onChange={(e) => setAct((s) => ({ ...s, [k]: e.target.value }))}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm appearance-none"
        >
          <option value="">Select Vendor...</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name} ({v.category})
            </option>
          ))}
        </select>
      ) : ta ? (
        <textarea
          value={act[k]}
          onChange={(e) => setAct((s) => ({ ...s, [k]: e.target.value }))}
          rows={2}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
        />
      ) : (
        <input
          type={type}
          value={act[k]}
          onChange={(e) => setAct((s) => ({ ...s, [k]: e.target.value }))}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
        />
      )}
      {actErr[k as string] && (
        <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-widest ml-1">{actErr[k as string]}</p>
      )}
    </div>
  );

  if (action === "START_CUTTING") {
    return <p className="text-[9px] text-foreground/40 uppercase tracking-[0.2em] leading-relaxed">System acknowledgment: confirming move to cutting spectrum. Immutable log entry initialized.</p>;
  }

  if (action === "SEND_STITCHING") {
    return (
      <>
        {f("quantity", "Transition Node Qty *", "number")}
        {f("pricePerUnit", "Unit Node CPU (₹) *", "number")}
        {f("travel", "Transition Logistics (₹)", "number")}
        {f("vendor", "Artisan / Node Provider")}
        {f("dateDispatched", "Transition Date", "date")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }

  if (action === "RETURN_STITCHING") {
    return (
      <>
        {f("quantity", "Nodes Returned *", "number")}
        {f("damageLoss", "Spectrum Loss count", "number")}
        {f("dateReturned", "Return Date", "date")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }

  if (action === "SEND_WASH") {
    return (
      <>
        {f("quantity", "Transition Qty *", "number")}
        {f("pricePerUnit", "Wash CPU per unit (₹) *", "number")}
        {f("travel", "Transition Logistics (₹)", "number")}
        {f("vendor", "Refinery / laundry node")}
        {f("dateDispatched", "Departure Timeline", "date")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "RETURN_WASH") {
    return (
      <>
        {f("quantity", "Refinery Nodes returned *", "number")}
        {f("damageLoss", "Spectrum Loss count", "number")}
        {f("dateReturned", "Arrival Timeline", "date")}
        {f("washTotalCost", "Net Refinery Charges (₹) *", "number")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "SEND_PRINTING") {
    return (
      <>
        {f("quantity", "Transition Qty *", "number")}
        {f("pricePerUnit", "Printing CPU per node (₹) *", "number")}
        {f("travel", "Transition Logistics (₹)", "number")}
        {f("vendor", "Node Provider")}
        {f("designRef", "Spectrum Design Ref")}
        {f("dateDispatched", "Departure Timeline", "date")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "RETURN_PRINTING" || action === "RETURN_EMBROIDERY") {
    return (
      <>
        {f("quantity", "Nodes returned *", "number")}
        {f("damageLoss", "Spectrum Loss Nodes", "number")}
        {f("dateReturned", "Arrival Timeline", "date")}
        {f("totalCharges", "Net Node Charges (₹)", "number")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "SEND_EMBROIDERY") {
    return (
      <>
        {f("quantity", "Transition Qty *", "number")}
        {f("pricePerUnit", "Embroidery CPU (₹) *", "number")}
        {f("travel", "Transition Logistics (₹)", "number")}
        {f("vendor", "Artisan Node")}
        {f("dateDispatched", "Departure Timeline", "date")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "MARK_SAMPLE") {
    return (
      <>
        {f("quantity", "Transition Node Qty *", "number")}
        {f("notes", "Technical Metadata", "text", true)}
      </>
    );
  }
  if (action === "QC_PASS" || action === "QC_REJECT") {
    return (
      <>
        {f("quantity", "Audit Node Qty (optional)", "number")}
        {f("remarks", "Audit Rationale", "text", true)}
      </>
    );
  }
  return null;
}

