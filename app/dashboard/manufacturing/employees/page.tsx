"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, RefreshCw, Trophy, Table2, ChevronRight, Award, Loader2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";

const EVENT_TYPES = [
  { name: "On-Time Submission", delta: 5 },
  { name: "Approved Without Revisions", delta: 5 },
  { name: "Approved After Revisions", delta: 3 },
  { name: "Fast Turnaround (2+ days early)", delta: 3 },
  { name: "Extra Task Completed", delta: 2 },
  { name: "Late Submission (1-3 days)", delta: -3 },
  { name: "Missed Deadline", delta: -5 },
  { name: "Revision Round", delta: -2 },
  { name: "Rejected Work", delta: -5 },
  { name: "Incomplete Deliverable", delta: -4 }
];

export default function EmployeesPage() {
  const [data, setData] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"leaderboard" | "table">("leaderboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    userId: "",
    eventType: "On-Time Submission",
    scoreDelta: "5",
    referenceId: "",
    referenceType: "",
    notes: ""
  });

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/performance");
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load performance aggregated scores");
      setData(result);

      // Fetch users list for manual performance logging dropdown
      const usersRes = await mfgFetch("/api/admin/users/list");
      const usersData = await usersRes.json();
      if (usersRes.ok) setAllUsers(usersData);
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEventTypeChange = (type: string) => {
    const selected = EVENT_TYPES.find(t => t.name === type);
    setForm(prev => ({
      ...prev,
      eventType: type,
      scoreDelta: selected ? String(selected.delta) : "0"
    }));
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId || !form.eventType || form.scoreDelta === "") {
      return showToast("UserId, Event Type and Score Delta are required", "err");
    }
    setSubmitting(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/performance", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to log event");
      
      showToast("Performance event logged successfully");
      setModalOpen(false);
      setForm({
        userId: "",
        eventType: "On-Time Submission",
        scoreDelta: "5",
        referenceId: "",
        referenceType: "",
        notes: ""
      });
      loadData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSubmitting(false);
    }
  };

  const getTierBadge = (score: number) => {
    if (score >= 100) return { label: "Champion 🏆", class: "bg-amber-400/20 text-amber-300 border-amber-400/30" };
    if (score >= 95) return { label: "Elite ⭐", class: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
    if (score >= 90) return { label: "Rising Star 🌟", class: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    if (score >= 70) return { label: "Performer", class: "bg-foreground/5 text-foreground/60 border-foreground/10" };
    return { label: "Needs Attention", class: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
  };

  // Split into Top 3 for Podium and others for list
  const topThree = data.slice(0, 3);
  const remaining = data.slice(3);

  // Reorder top 3 for classic podium look: [2nd, 1st, 3rd]
  const podiumOrder = [];
  if (topThree[1]) podiumOrder.push({ ...topThree[1], rank: 2 });
  if (topThree[0]) podiumOrder.push({ ...topThree[0], rank: 1 });
  if (topThree[2]) podiumOrder.push({ ...topThree[2], rank: 3 });

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
            <Users className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight uppercase">Team Performance</h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Team Scorecard · {data.length} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/15"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Add Performance Event
          </button>
        </div>
      </div>

      {/* Toggle Tab Bar */}
      <div className="flex gap-2 border-b border-foreground/5 pb-2">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "leaderboard" ? "border-foreground text-foreground" : "border-transparent text-foreground/45"
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("table")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "table" ? "border-foreground text-foreground" : "border-transparent text-foreground/45"
          }`}
        >
          Scorecard Table
        </button>
      </div>

      {loading && data.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
          <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Aggregating Leaderboard...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center glass-card rounded-[2rem] p-8">
          <Users className="w-12 h-12 text-foreground/20 mb-4" />
          <p className="text-[13px] font-bold text-foreground/60">No scores recorded yet</p>
          <p className="text-[11px] text-foreground/40 mt-1">Approve sample runs to automatically credit scores to designers.</p>
        </div>
      ) : activeTab === "leaderboard" ? (
        <div className="space-y-8">
          
          {/* Podium (Top 3) */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto items-end pt-10 pb-6">
            {podiumOrder.map((user) => {
              const badge = getTierBadge(user.score);
              const heightClass = user.rank === 1 ? "h-64 border-amber-400/20 bg-amber-400/[0.02]" : user.rank === 2 ? "h-52" : "h-44";
              return (
                <div key={user.userId} className={`flex flex-col items-center text-center glass-card rounded-[1.5rem] p-4 ${heightClass} justify-between border relative overflow-hidden group`}>
                  <div className="space-y-1">
                    <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm shadow-md mx-auto group-hover:scale-105 transition-transform duration-500">
                      {user.name?.substring(0, 2).toUpperCase() || "UN"}
                    </div>
                    <h3 className="text-xs font-bold truncate max-w-[90px] mt-1.5">{user.name}</h3>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-foreground/35">{user.role}</p>
                  </div>

                  <div className="space-y-1 mt-auto">
                    <div className="text-2xl font-mono font-bold tabular-nums leading-none tracking-tight">{user.score}</div>
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[6px] font-bold uppercase tracking-wider ${badge.class}`}>
                      {badge.label.split(" ")[0]}
                    </span>
                  </div>

                  {/* Rank Indicator Badge */}
                  <div className={`absolute top-3 left-3 w-5 h-5 rounded-full font-mono text-[9px] font-bold flex items-center justify-center ${
                    user.rank === 1 ? "bg-amber-400 text-background" : user.rank === 2 ? "bg-slate-300 text-background" : "bg-orange-400 text-background"
                  }`}>
                    {user.rank}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Remaining Rankings List */}
          {remaining.length > 0 && (
            <div className="glass-card rounded-[1.5rem] p-5 space-y-3 max-w-xl mx-auto">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 border-b border-foreground/5 pb-2">Standings</h4>
              <div className="divide-y divide-foreground/5">
                {remaining.map((user, idx) => {
                  const rank = idx + 4;
                  const badge = getTierBadge(user.score);
                  return (
                    <Link key={user.userId} href={`/dashboard/manufacturing/employees/${user.userId}`} className="flex justify-between items-center py-3.5 hover:bg-foreground/[0.01] transition-colors group">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-[10px] text-foreground/30 w-5">{rank}</span>
                        <div className="w-8 h-8 rounded-full bg-foreground/5 text-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-foreground/5">
                          {user.name?.substring(0, 2).toUpperCase() || "UN"}
                        </div>
                        <div>
                          <div className="text-xs font-bold group-hover:text-foreground/80">{user.name}</div>
                          <div className="text-[8px] font-bold uppercase tracking-widest text-foreground/30 mt-0.5">{user.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm tabular-nums">{user.score}</span>
                        <span className={`px-2 py-0.5 rounded border text-[7px] font-bold uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Table View */
        <div className="glass-card rounded-[1.5rem] overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
              <thead>
                <tr className="border-b border-foreground/15 text-[10px] uppercase font-bold text-foreground/50 tracking-widest bg-foreground/[0.01]">
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Events</th>
                  <th className="px-6 py-4">Tier</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5 font-medium">
                {data.map((user, idx) => {
                  const badge = getTierBadge(user.score);
                  return (
                    <tr key={user.userId} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground/55">{idx + 1}</td>
                      <td className="px-6 py-4 font-bold text-sm">{user.name}</td>
                      <td className="px-6 py-4 text-foreground/60 font-mono">{user.email}</td>
                      <td className="px-6 py-4 text-foreground/60">{user.role}</td>
                      <td className="px-6 py-4 font-mono font-bold text-sm tabular-nums">{user.score}</td>
                      <td className="px-6 py-4 text-foreground/60 font-mono">{user.eventsCount}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/dashboard/manufacturing/employees/${user.userId}`} className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 hover:text-foreground">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Add Performance Event Modal --- */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-card rounded-[2rem] border border-foreground/10 shadow-2xl p-6 lg:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-lg lg:text-xl font-bold uppercase tracking-tight text-foreground">Add Performance Event</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">Manual Scorecard Adjustments</p>
              </div>

              <form onSubmit={handleSubmitEvent} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Team Member *</label>
                  <select
                    required
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                  >
                    <option value="">Select crew member...</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Event Type *</label>
                    <select
                      value={form.eventType}
                      onChange={(e) => handleEventTypeChange(e.target.value)}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    >
                      {EVENT_TYPES.map((type) => (
                        <option key={type.name} value={type.name}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Score Delta *</label>
                    <input
                      required
                      type="number"
                      value={form.scoreDelta}
                      onChange={(e) => setForm({ ...form, scoreDelta: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-mono text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Reference ID (Optional)</label>
                    <input
                      value={form.referenceId}
                      onChange={(e) => setForm({ ...form, referenceId: e.target.value })}
                      placeholder="e.g. cuid"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-mono text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Reference Type (Optional)</label>
                    <input
                      value={form.referenceType}
                      onChange={(e) => setForm({ ...form, referenceType: e.target.value })}
                      placeholder="e.g. MfgSample"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 ml-1">Event Notes / Remarks</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Enter audit details regarding the score assignment..."
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-background border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Event"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
