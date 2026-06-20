"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  BarChart3, RefreshCw, Download, Loader2, ArrowRight, Check, AlertTriangle, Users, Award 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, Legend 
} from "recharts";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reportData, setReportData] = useState<any>(null);
  const [designsToday, setDesignsToday] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch main reports depending on the active tab
      const res = await mfgFetch(`/api/admin/manufacturing/reports?type=${activeTab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports data");
      setReportData(data);

      // 2. Additional fetches for specific tabs
      if (activeTab === "daily") {
        // Fetch design assignments to filter for today
        const desRes = await mfgFetch("/api/admin/manufacturing/designs");
        const desData = await desRes.json();
        if (desRes.ok) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const filtered = desData.filter((d: any) => new Date(d.createdAt) >= todayStart);
          setDesignsToday(filtered);
        }
      }

      // Fetch vendors list to map categories in Monthly report vendor table
      const venRes = await mfgFetch("/api/admin/manufacturing/vendors");
      const venData = await venRes.json();
      if (venRes.ok) setVendors(venData);

    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCSV = (dataArray: any[], filename: string) => {
    if (!dataArray || dataArray.length === 0) {
      return showToast("No data to export", "err");
    }
    try {
      const headers = Object.keys(dataArray[0]).join(",");
      const rows = dataArray.map(row => 
        Object.values(row).map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
      );
      const csvContent = [headers, ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("CSV Exported successfully");
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  // Recharts colors
  const PIE_COLORS = ["#10b981", "#ef4444", "#fbbf24", "rgba(255,255,255,0.2)"];

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
            <BarChart3 className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Reports & Analytics</h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Manufacturing Intelligence
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

      {/* Tab Bar */}
      <div className="flex gap-2 border-b border-foreground/5 pb-2">
        {(["daily", "weekly", "monthly"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-foreground/45"
            }`}
          >
            {tab} Report
          </button>
        ))}
      </div>

      {loading && !reportData ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Compiling Analytics Data...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* --- Daily Tab Content --- */}
          {activeTab === "daily" && reportData && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-foreground/45">New Designs Today</div>
                  <div className="text-2xl font-mono font-bold">{reportData.newDesignsToday || 0}</div>
                </div>
                <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-foreground/45">Samples Submitted Today</div>
                  <div className="text-2xl font-mono font-bold text-amber-400">{reportData.samplesSubmittedToday || 0}</div>
                </div>
                <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-foreground/45">Tasks Completed Today</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">{reportData.completedTasksToday || 0}</div>
                </div>
                <div className="glass-card rounded-[1.5rem] p-5 space-y-2">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-foreground/45">Overdue Designs</div>
                  <div className="text-2xl font-mono font-bold text-rose-500">{reportData.overdueDesigns || 0}</div>
                </div>
              </div>

              {/* Today's Designs Table */}
              <div className="glass-card rounded-[2rem] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Today's Design Assignments</h3>
                  <button 
                    onClick={() => handleExportCSV(designsToday.map(d => ({
                      styleCode: d.styleCode,
                      styleName: d.styleName,
                      collection: d.collection?.name || "",
                      designer: d.assignedTo?.name || "",
                      deadline: d.submissionDeadline,
                      priority: d.priority,
                      status: d.status
                    })), "daily_designs.csv")}
                    className="px-3.5 py-1.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>

                {designsToday.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest border border-dashed border-foreground/10 rounded-2xl">
                    No design assignments created today
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                      <thead>
                        <tr className="border-b border-foreground/15 text-[9px] font-bold uppercase tracking-widest text-foreground/40 pb-3">
                          <th className="pb-3">Style Code</th>
                          <th className="pb-3">Style Name</th>
                          <th className="pb-3">Assigned To</th>
                          <th className="pb-3">Deadline</th>
                          <th className="pb-3 text-right">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/5 font-medium">
                        {designsToday.map((d) => (
                          <tr key={d.id} className="text-foreground/85">
                            <td className="py-3 font-mono font-bold tracking-tight text-[11px]">{d.styleCode}</td>
                            <td className="py-3 font-bold text-sm text-foreground">{d.styleName}</td>
                            <td className="py-3 text-foreground/60">{d.assignedTo?.name || "Unassigned"}</td>
                            <td className="py-3 text-foreground/60">{d.submissionDeadline ? formatDateTimeIST(d.submissionDeadline).split(",")[0] : "-"}</td>
                            <td className="py-3 text-right">
                              <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 border border-foreground/10 text-[8px] font-bold uppercase tracking-wider">{d.priority}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- Weekly Tab Content --- */}
          {activeTab === "weekly" && reportData && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Design Output by Person */}
                <div className="glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Design Output by Person</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.designsPerUser, "weekly_designs_per_user.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-64 w-full text-xs">
                    {reportData.designsPerUser && reportData.designsPerUser.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={reportData.designsPerUser} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis type="number" stroke="rgba(255,255,255,0.3)" />
                          <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" width={90} />
                          <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)" }} />
                          <Bar dataKey="count" fill="rgba(255,255,255,0.85)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-foreground/35 uppercase tracking-widest font-bold">No Weekly Design Output</div>
                    )}
                  </div>
                </div>

                {/* Sample Approval Breakdown */}
                <div className="glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Sample QC Breakdown</h3>
                    <button 
                      onClick={() => handleExportCSV([reportData.sampleApprovalBreakdown], "weekly_sample_qc.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-64 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Approved", value: reportData.sampleApprovalBreakdown?.approved || 0 },
                            { name: "Rejected", value: reportData.sampleApprovalBreakdown?.rejected || 0 },
                            { name: "Revision Required", value: reportData.sampleApprovalBreakdown?.revisionRequired || 0 },
                            { name: "Pending Review", value: reportData.sampleApprovalBreakdown?.pending || 0 }
                          ].filter(v => v.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {PIE_COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)" }} />
                        <Legend wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                
                {/* Overdue Designs Table (60%) */}
                <div className="lg:col-span-6 glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Overdue Design Tasks</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.delayedTasks, "weekly_overdue_designs.csv")}
                      className="px-3.5 py-1.5 bg-background border border-foreground/10 text-foreground text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/[0.02] flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                  </div>

                  {reportData.delayedTasks && reportData.delayedTasks.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest border border-dashed border-foreground/10 rounded-2xl">
                      All design deadlines current!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead>
                          <tr className="border-b border-foreground/15 text-[9px] font-bold uppercase tracking-widest text-foreground/40 pb-3">
                            <th className="pb-3">Style Code</th>
                            <th className="pb-3">Designer</th>
                            <th className="pb-3">Deadline</th>
                            <th className="pb-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium">
                          {reportData.delayedTasks?.map((t: any, index: number) => (
                            <tr key={index}>
                              <td className="py-3 font-mono font-bold tracking-tight text-[11px] text-rose-400">{t.styleCode}</td>
                              <td className="py-3 text-foreground/75">{t.assignedToName}</td>
                              <td className="py-3 text-foreground/60">{t.deadline ? formatDateTimeIST(t.deadline).split(",")[0] : "-"}</td>
                              <td className="py-3 text-right text-rose-500 font-bold uppercase text-[9px] tracking-widest animate-pulse">Overdue</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Production Stage Distribution (40%) */}
                <div className="lg:col-span-4 glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Active Batches by Stage</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.productionStageDistribution, "weekly_production_stages.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-64 w-full text-xs">
                    {reportData.productionStageDistribution && reportData.productionStageDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.productionStageDistribution} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="stage" stroke="rgba(255,255,255,0.3)" tickFormatter={(s) => s.substring(0, 5) + ".."} />
                          <YAxis stroke="rgba(255,255,255,0.3)" />
                          <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)" }} />
                          <Bar dataKey="count" fill="rgba(255,255,255,0.85)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-foreground/35 uppercase tracking-widest font-bold">No Active Production Batches</div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* --- Monthly Tab Content --- */}
          {activeTab === "monthly" && reportData && (
            <motion.div
              key="monthly"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Design Output Trend */}
                <div className="glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Design Output Trend</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.designOutputByWeek, "monthly_weekly_trend.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-64 w-full text-xs">
                    {reportData.designOutputByWeek && reportData.designOutputByWeek.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reportData.designOutputByWeek} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" />
                          <YAxis stroke="rgba(255,255,255,0.3)" />
                          <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)" }} />
                          <Line type="monotone" dataKey="count" stroke="#fff" strokeWidth={2} dot={{ fill: "#fff" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-foreground/35 uppercase tracking-widest font-bold">No Monthly Trend data</div>
                    )}
                  </div>
                </div>

                {/* Sample Approval Rate */}
                <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-center items-center text-center space-y-3 min-h-[300px]">
                  <Award className="w-16 h-16 text-emerald-400" />
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Monthly Sample Approval Rate</h3>
                    <div className="text-5xl font-mono font-bold text-emerald-400 tabular-nums">{reportData.sampleApprovalRate}%</div>
                  </div>
                  <p className="text-[11px] text-foreground/40 max-w-xs leading-relaxed uppercase tracking-wider">
                    Percentage of sample runs approved on initial or revision evaluations over the past 30 days.
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                
                {/* Top Performers (50%) */}
                <div className="lg:col-span-5 glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Top Performers (Last 30 days)</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.topPerformers, "monthly_top_performers.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {reportData.topPerformers && reportData.topPerformers.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest border border-dashed border-foreground/10 rounded-2xl">
                      No scorecard points recorded this month
                    </div>
                  ) : (
                    <div className="divide-y divide-foreground/5">
                      {reportData.topPerformers?.map((user: any, index: number) => (
                        <div key={index} className="flex justify-between items-center py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] font-bold text-foreground/35 w-5">{index + 1}</span>
                            <div className="w-7 h-7 rounded-full bg-foreground/5 text-foreground flex items-center justify-center font-bold text-[10px] border border-foreground/5">
                              {user.name?.substring(0, 2).toUpperCase() || "UN"}
                            </div>
                            <span className="text-xs font-bold">{user.name}</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-emerald-400">+{user.scoreDelta} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vendor Usage (50%) */}
                <div className="lg:col-span-5 glass-card rounded-[2rem] p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Vendor Allocations</h3>
                    <button 
                      onClick={() => handleExportCSV(reportData.vendorUsage.map((v: any) => {
                        const match = vendors.find(vd => vd.name === v.name);
                        return {
                          name: v.name,
                          samples: v.count,
                          category: match?.category || "Unknown"
                        };
                      }), "monthly_vendor_usage.csv")}
                      className="p-1.5 hover:bg-foreground/5 rounded text-foreground/45"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {reportData.vendorUsage && reportData.vendorUsage.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest border border-dashed border-foreground/10 rounded-2xl">
                      No vendors utilized this month
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead>
                          <tr className="border-b border-foreground/10 text-[9px] font-bold uppercase tracking-widest text-foreground/40 pb-2">
                            <th className="pb-2">Vendor Name</th>
                            <th className="pb-2">Sample Runs</th>
                            <th className="pb-2 text-right">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium">
                          {reportData.vendorUsage?.map((v: any, index: number) => {
                            const match = vendors.find(vd => vd.name === v.name);
                            return (
                              <tr key={index} className="text-foreground/80">
                                <td className="py-3 font-bold text-foreground">{v.name}</td>
                                <td className="py-3 font-mono font-bold text-sm tabular-nums text-foreground/90">{v.count}</td>
                                <td className="py-3 text-right">
                                  <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/55 border border-foreground/5 text-[8px] font-bold uppercase tracking-wider">{match?.category || "Unknown"}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
