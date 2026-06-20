"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Factory, Palette, TrendingUp, Layers2, ArrowDownUp, Building2, Coins, Users, 
  ClipboardList, FlaskConical, BarChart3, AlertTriangle, ArrowRight, Plus, Loader2, Check 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

const MFG_STAGE_LABEL: Record<string, string> = {
  READY_FOR_PRODUCTION: "Ready for Production",
  IN_PRODUCTION_CUTTING: "Cutting Stage",
  IN_PRODUCTION_STITCHING: "Stitching Stage",
  SENT_PRINTING: "Sent to Printing",
  SENT_EMBROIDERY: "Sent to Embroidery",
  SENT_WASH: "Sent to Wash",
  RETURNED_COMBINED: "Combined QC Check",
  SENT_SAMPLE: "Sample Run",
  QC_PASSED: "QC Passed",
  REJECTED_REWORK: "Rework Stage"
};

export default function ManufacturingHub() {
  const [dailyReports, setDailyReports] = useState<any>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Daily reports
      const reportsRes = await mfgFetch("/api/admin/manufacturing/reports?type=daily");
      const reportsData = await reportsRes.json();
      if (!reportsRes.ok) throw new Error(reportsData.error || "Failed to load reports");
      setDailyReports(reportsData);

      // 2. Fetch pending review samples
      const samplesRes = await mfgFetch("/api/admin/manufacturing/samples?status=Pending Review");
      const samplesData = await samplesRes.json();
      if (!samplesRes.ok) throw new Error(samplesData.error || "Failed to load samples");
      setSamples(samplesData.slice(0, 5));

      // 3. Fetch In Progress design tasks
      const designsRes = await mfgFetch("/api/admin/manufacturing/designs?status=In Progress");
      const designsData = await designsRes.json();
      if (!designsRes.ok) throw new Error(designsData.error || "Failed to load designs");
      setDesigns(designsData);

      // 4. Fetch production batches
      const batchesRes = await mfgFetch("/api/admin/manufacturing/batches");
      const batchesData = await batchesRes.json();
      if (!batchesRes.ok) throw new Error(batchesData.error || "Failed to load batches");
      setBatches(batchesData);

    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter deadlines within 7 days
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = designs
    .filter(d => {
      if (!d.submissionDeadline) return false;
      const dl = new Date(d.submissionDeadline);
      return dl >= now && dl <= next7Days;
    })
    .sort((a, b) => new Date(a.submissionDeadline).getTime() - new Date(b.submissionDeadline).getTime());

  // Group batches by currentStage
  const stageDistribution = batches.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.currentStage] = (acc[curr.currentStage] || 0) + 1;
    return acc;
  }, {});

  const maxStageCount = Math.max(...Object.values(stageDistribution), 1);

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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
          <Factory className="w-5 h-5 text-foreground/60" />
        </div>
        <div>
          <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Manufacturing Hub</h1>
          <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
            Operations Command · Zica Bella
          </p>
        </div>
      </div>

      {loading && !dailyReports ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
          <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Compiling Operations Hub...</p>
        </div>
      ) : (
        <>
          {/* Row 1 — Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Total Active Designs</div>
              <div className="text-2xl font-mono font-bold">{dailyReports?.totalActiveDesigns || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Samples Awaiting Approval</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{dailyReports?.samplesAwaitingApproval || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Active Production Batches</div>
              <div className="text-2xl font-mono font-bold text-blue-400">{dailyReports?.activeProductionBatches || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Overdue Designs</div>
              <div className="text-2xl font-mono font-bold text-rose-500">{dailyReports?.overdueDesigns || 0}</div>
            </div>
          </div>

          {/* Row 2 — Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Fabric SKUs in Stock</div>
              <div className="text-2xl font-mono font-bold">{dailyReports?.fabricSkusInStock || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Total Vendors</div>
              <div className="text-2xl font-mono font-bold">{dailyReports?.totalVendors || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Tasks Pending</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{dailyReports?.tasksPending || 0}</div>
            </div>
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Tasks Overdue</div>
              <div className="text-2xl font-mono font-bold text-rose-500">{dailyReports?.tasksOverdue || 0}</div>
            </div>
          </div>

          {/* 3 Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            
            {/* Left Column (60%) */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Sample Approval Queue */}
              <div className="glass-card rounded-[1.5rem] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Sample Approval Queue</h3>
                  <Link href="/dashboard/manufacturing/samples" className="text-[10px] uppercase font-bold tracking-widest text-foreground/40 hover:text-foreground flex items-center gap-1">
                    View Queue <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                
                {samples.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                    No samples awaiting review
                  </div>
                ) : (
                  <div className="space-y-3">
                    {samples.map((s) => (
                      <div key={s.id} className="flex justify-between items-center p-4 bg-background/30 rounded-xl border border-foreground/[0.04]">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold leading-tight">{s.productName}</h4>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-foreground/40">
                            <span>{s.styleCode}</span>
                            <span>•</span>
                            <span>{s.designAssignment?.assignedTo?.name || "Unassigned"}</span>
                            <span>•</span>
                            <span>{formatDateTimeIST(s.submittedAt)}</span>
                          </div>
                        </div>
                        <Link href={`/dashboard/manufacturing/samples/${s.id}`}>
                          <button className="px-3.5 py-1.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-all flex items-center gap-1">
                            Review <ArrowRight className="w-3 h-3" />
                          </button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Design Deadlines */}
              <div className="glass-card rounded-[1.5rem] p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Upcoming Design Deadlines</h3>
                
                {upcomingDeadlines.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                    All deadlines clear
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-foreground/10 text-[9px] font-bold uppercase tracking-widest text-foreground/40">
                          <th className="pb-3">Style Code</th>
                          <th className="pb-3">Style Name</th>
                          <th className="pb-3">Designer</th>
                          <th className="pb-3">Deadline</th>
                          <th className="pb-3 text-right">Days Left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/5">
                        {upcomingDeadlines.map((d) => {
                          const dl = new Date(d.submissionDeadline);
                          const diffMs = dl.getTime() - now.getTime();
                          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                          
                          let colorClass = "text-emerald-400";
                          if (daysLeft <= 1) colorClass = "text-rose-500 font-bold animate-pulse";
                          else if (daysLeft <= 3) colorClass = "text-amber-400 font-bold";

                          return (
                            <tr key={d.id} className="text-xs">
                              <td className="py-3.5 font-mono text-[10px]">{d.styleCode}</td>
                              <td className="py-3.5 font-bold">{d.styleName}</td>
                              <td className="py-3.5 text-foreground/60">{d.assignedTo?.name || "Unassigned"}</td>
                              <td className="py-3.5 text-foreground/60">{formatDateTimeIST(d.submissionDeadline)}</td>
                              <td className={`py-3.5 text-right font-bold ${colorClass}`}>{daysLeft < 0 ? "Overdue" : daysLeft}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column (40%) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Production Pipeline */}
              <div className="glass-card rounded-[1.5rem] p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Production Pipeline</h3>
                
                {batches.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                    No active production
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {Object.entries(MFG_STAGE_LABEL).map(([stage, label]) => {
                      const count = stageDistribution[stage] || 0;
                      const pct = Math.round((count / maxStageCount) * 100);

                      return (
                        <Link key={stage} href={`/dashboard/manufacturing/production?stage=${stage}`} className="block group">
                          <div className="space-y-1.5 cursor-pointer">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                              <span className="text-foreground/75 group-hover:text-foreground transition-colors">{label}</span>
                              <span className="font-mono text-foreground/50 group-hover:text-foreground transition-colors">{count} batches</span>
                            </div>
                            <div className="h-2 bg-foreground/[0.03] rounded-full overflow-hidden border border-foreground/[0.04]">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                className="h-full bg-foreground/30 group-hover:bg-foreground/60 transition-colors"
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="glass-card rounded-[1.5rem] p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Quick Actions</h3>
                <div className="grid grid-cols-1 gap-3">
                  <Link href="/dashboard/manufacturing/designs?new=true">
                    <button className="w-full text-left p-4 bg-background/30 hover:bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl flex items-center justify-between transition-all group">
                      <div className="flex items-center gap-3">
                        <Palette className="w-4 h-4 text-foreground/50" />
                        <span className="text-xs font-bold uppercase tracking-wider">Assign Design Task</span>
                      </div>
                      <Plus className="w-4 h-4 text-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>

                  <Link href="/dashboard/manufacturing/production?new=true">
                    <button className="w-full text-left p-4 bg-background/30 hover:bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl flex items-center justify-between transition-all group">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-foreground/50" />
                        <span className="text-xs font-bold uppercase tracking-wider">New Production Batch</span>
                      </div>
                      <Plus className="w-4 h-4 text-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>

                  <Link href="/dashboard/manufacturing/vendors?new=true">
                    <button className="w-full text-left p-4 bg-background/30 hover:bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl flex items-center justify-between transition-all group">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-foreground/50" />
                        <span className="text-xs font-bold uppercase tracking-wider">Add Vendor</span>
                      </div>
                      <Plus className="w-4 h-4 text-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>

                  <Link href="/dashboard/manufacturing/reports">
                    <button className="w-full text-left p-4 bg-background/30 hover:bg-foreground/[0.03] border border-foreground/[0.06] rounded-xl flex items-center justify-between transition-all group">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-4 h-4 text-foreground/50" />
                        <span className="text-xs font-bold uppercase tracking-wider">View Reports</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </motion.div>
  );
}
