"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Users, ShieldAlert, Award, FileText, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid 
} from "recharts";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

export default function EmployeePerformanceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "designs">("history");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch User details
      const usersRes = await mfgFetch("/api/admin/users/list");
      const usersData = await usersRes.json();
      if (usersRes.ok) {
        const found = usersData.find((u: any) => u.id === id);
        if (found) setUser(found);
      }

      // 2. Fetch Performance history events
      const perfRes = await mfgFetch(`/api/admin/manufacturing/performance?userId=${id}`);
      const perfData = await perfRes.json();
      if (perfRes.ok) setEvents(perfData);

      // 3. Fetch Assigned designs
      const designsRes = await mfgFetch(`/api/admin/manufacturing/designs?assignedToId=${id}`);
      const designsData = await designsRes.json();
      if (designsRes.ok) setDesigns(designsData);

    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate stats
  const totalEvents = events.length;
  const scoreAdded = events.filter(e => e.scoreDelta > 0).reduce((acc, c) => acc + c.scoreDelta, 0);
  const scoreDeducted = events.filter(e => e.scoreDelta < 0).reduce((acc, c) => acc + c.scoreDelta, 0);
  const netChange = scoreAdded + scoreDeducted;
  const currentScore = 100 + netChange;

  const getTierBadge = (score: number) => {
    if (score >= 100) return { label: "Champion 🏆", class: "bg-amber-400/20 text-amber-300 border-amber-400/30" };
    if (score >= 95) return { label: "Elite ⭐", class: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
    if (score >= 90) return { label: "Rising Star 🌟", class: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    if (score >= 70) return { label: "Performer", class: "bg-foreground/5 text-foreground/60 border-foreground/10" };
    return { label: "Needs Attention", class: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
  };

  const tier = getTierBadge(currentScore);

  // Generate chart data: starting at 100, and sequentially applying each delta (oldest to newest)
  const chartData = events
    .slice()
    .reverse()
    .reduce((acc: any[], curr: any) => {
      const lastScore = acc.length > 0 ? acc[acc.length - 1].score : 100;
      acc.push({
        name: formatDateTimeIST(curr.createdAt).split(",")[0],
        score: lastScore + curr.scoreDelta
      });
      return acc;
    }, []);

  // Prepend starting score
  const finalChartData = [{ name: "Baseline", score: 100 }, ...chartData];

  if (loading && !user) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Loading Scorecard...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-foreground/5 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/manufacturing/employees" className="w-9 h-9 rounded-xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg lg:text-xl font-bold uppercase">{user?.name || "Team Member"}</h1>
              <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 border border-foreground/10 text-[8px] font-bold uppercase tracking-wider">{user?.role}</span>
            </div>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5 font-mono">
              ID: {user?.id}
            </p>
          </div>
        </div>

        {/* Current Score Display */}
        <div className="flex items-center gap-4 bg-foreground/[0.02] border border-foreground/5 p-4 rounded-2xl">
          <div className="text-right">
            <div className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest leading-none">Net Performance Score</div>
            <span className={`inline-block px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider mt-1.5 ${tier.class}`}>
              {tier.label}
            </span>
          </div>
          <div className="text-3xl font-mono font-bold leading-none tabular-nums text-foreground">{currentScore}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">Total Events</div>
          <div className="text-xl font-mono font-bold mt-1 tabular-nums">{totalEvents}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">Score Added</div>
          <div className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">+{scoreAdded}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">Score Deducted</div>
          <div className="text-xl font-mono font-bold text-rose-400 mt-1 tabular-nums">{scoreDeducted}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">Net Change</div>
          <div className={`text-xl font-mono font-bold mt-1 tabular-nums ${netChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {netChange >= 0 ? `+${netChange}` : netChange}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-foreground/5 pb-2">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "history" ? "border-foreground text-foreground" : "border-transparent text-foreground/45"
          }`}
        >
          Performance History
        </button>
        <button
          onClick={() => setActiveTab("designs")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "designs" ? "border-foreground text-foreground" : "border-transparent text-foreground/45"
          }`}
        >
          Assigned Designs ({designs.length})
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "history" ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-6"
          >
            {/* Score over time line chart */}
            {events.length > 0 && (
              <div className="glass-card rounded-[2rem] p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Score Trend</h3>
                <div className="h-64 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={finalChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" />
                      <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.3)" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "#0A0A0A", 
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          color: "#fff"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#fff" 
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: "#fff" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Performance Event History Log */}
            <div className="glass-card rounded-[2rem] p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60">Event Log</h3>
              
              {events.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">
                  No performance history recorded
                </div>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {events.map((e) => (
                    <div key={e.id} className="flex justify-between items-start py-4 text-xs font-medium">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-foreground/5 text-foreground/75 border border-foreground/10 text-[8px] font-bold uppercase tracking-wider">
                            {e.eventType}
                          </span>
                          {e.referenceType && (
                            <span className="font-mono text-[9px] text-foreground/35 uppercase">
                              Ref: {e.referenceType} ({e.referenceId?.substring(0, 8)})
                            </span>
                          )}
                        </div>
                        {e.notes && <p className="text-foreground/70">{e.notes}</p>}
                      </div>

                      <div className="text-right space-y-1">
                        <span className={`font-mono font-bold text-sm ${e.scoreDelta > 0 ? "text-emerald-400" : "text-rose-500"}`}>
                          {e.scoreDelta > 0 ? `+${e.scoreDelta}` : e.scoreDelta}
                        </span>
                        <div className="text-[9px] text-foreground/35 font-mono">{formatDateTimeIST(e.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        ) : (
          /* 2. Assigned Designs Tab */
          <motion.div
            key="designs"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="glass-card rounded-[2rem] overflow-hidden"
          >
            {designs.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center p-8">
                <FileText className="w-12 h-12 text-foreground/20 mb-4" />
                <p className="text-[13px] font-bold text-foreground/60">No designs assigned</p>
                <p className="text-[11px] text-foreground/40 mt-1">This user is currently not assigned to any active designs.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                  <thead>
                    <tr className="border-b border-foreground/15 text-[10px] uppercase font-bold text-foreground/50 tracking-widest bg-foreground/[0.01]">
                      <th className="px-6 py-4">Style Code</th>
                      <th className="px-6 py-4">Style Name</th>
                      <th className="px-6 py-4">Collection</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Deadline</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/5 font-medium">
                    {designs.map((d) => (
                      <tr key={d.id} className="hover:bg-foreground/[0.01] transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-[11px]">{d.styleCode}</td>
                        <td className="px-6 py-4 font-bold text-sm">{d.styleName}</td>
                        <td className="px-6 py-4 text-foreground/60">{d.collection?.name || "-"}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 border border-foreground/10 text-[8px] font-bold uppercase tracking-wider">{d.priority}</span>
                        </td>
                        <td className="px-6 py-4 text-foreground/60 font-mono">{d.submissionDeadline ? formatDateTimeIST(d.submissionDeadline).split(",")[0] : "-"}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/55 text-[9px] font-bold uppercase tracking-wider">{d.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
