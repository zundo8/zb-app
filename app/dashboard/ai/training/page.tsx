"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Cpu, Sparkles, AlertCircle, Plus, Trash2,
  Calendar, CheckCircle2, ShieldAlert, CornerDownRight, RotateCw
} from "lucide-react";

interface TrainingRule {
  id: string;
  prompt: string;
  createdAt: string;
}

export default function AITrainingPage() {
  const [rules, setRules] = useState<TrainingRule[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load trained memories on load
  async function loadRules() {
    setFetching(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/ai/training");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      } else {
        setActionError(data.error || "Failed to load active instructions.");
      }
    } catch {
      setActionError("Failed to communicate with Zica AI training store.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  // Submit new training prompt
  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    setLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/admin/ai/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: inputPrompt.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
        setInputPrompt("");
        setActionSuccess("Zica AI memory successfully updated! Active models have absorbed this rule.");
        // Hide success message after 4s
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(data.error || "Failed to store training prompt.");
      }
    } catch {
      setActionError("Failed to update AI memory config.");
    } finally {
      setLoading(false);
    }
  }

  // Delete a memory rule
  async function handleDeleteRule(id: string) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/admin/ai/training?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
        setActionSuccess("Trained instruction successfully removed from active memory.");
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(data.error || "Failed to delete training prompt.");
      }
    } catch {
      setActionError("Failed to execute delete memory command.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-20 space-y-8 max-w-6xl mx-auto relative z-10"
    >
      {/* Dynamic Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 lg:p-8 rounded-[1.8rem] bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-500/10 shadow-inner">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400 animate-bounce" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.25em]">Cognitive Training Console</span>
          </div>
          <h1 className="text-xl lg:text-3xl font-extrabold text-foreground tracking-tight leading-none uppercase">Zica AI Memory & Guidance</h1>
          <p className="text-[11px] lg:text-[12px] text-foreground/50 max-w-xl font-medium leading-relaxed font-sans">
            Submit prompt constraints, pricing rules, discount codes, customer service protocols, or custom knowledge. Trained parameters are dynamically injected into active mobile prompts in real time.
          </p>
        </div>

        {/* Sync Status Badge */}
        <div className="px-5 py-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1 self-start lg:self-center">
          <span className="text-[8px] font-bold text-foreground/35 uppercase tracking-widest block">Active Knowledge State</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase text-foreground/80">
              {rules.length} Rules Trained
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Add Guidance Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-6 lg:p-8 rounded-[2rem] border border-foreground/5 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Teach Zica AI</h3>
              </div>
              <p className="text-[10.5px] text-foreground/45 leading-relaxed font-medium">
                Enter an operational directive, specific size charts pairing, or support answers. Instructions are instantly learned by active assistants.
              </p>
            </div>

            {/* Error / Success feedback */}
            <AnimatePresence mode="wait">
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-2.5 items-start"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-rose-400/90 font-semibold leading-relaxed">
                    {actionError}
                  </span>
                </motion.div>
              )}

              {actionSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-2.5 items-start"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-emerald-400/90 font-semibold leading-relaxed">
                    {actionSuccess}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9.5px] font-bold text-foreground/40 uppercase tracking-widest">
                  Memory Guideline / Prompt Input
                </label>
                <textarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="e.g. When a customer asks for raw silk lehngas, emphasize that they feature intricate hand-embroidered Zardozi borders and take 4 weeks for customization..."
                  rows={6}
                  className="w-full rounded-xl bg-foreground/[0.02] border border-foreground/5 focus:border-indigo-500/30 focus:bg-foreground/[0.03] text-foreground p-4 text-[12px] font-medium placeholder-foreground/20 leading-relaxed outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/25 disabled:cursor-not-allowed text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Updating Memory...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Train active AI
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick guide and warning details */}
          <div className="p-5 rounded-2xl bg-foreground/[0.01] border border-foreground/[0.04] space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
              <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-foreground">Memory Constraints</h4>
            </div>
            <ul className="text-[9.5px] text-foreground/40 leading-relaxed space-y-1.5 list-disc pl-4 font-medium">
              <li>Keep instructions direct, clear, and context-specific.</li>
              <li>Operational changes sync dynamically—no app updates required.</li>
              <li>These prompts strictly filter regular client inquiries from the mobile app without affecting internal dashboard tools.</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Trained Prompts & Active Memory List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-6 lg:p-8 rounded-[2rem] border border-foreground/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Active Memory Base</h3>
                <p className="text-[10.5px] text-foreground/45 leading-relaxed font-medium">
                  Operational directives active in active model prompts.
                </p>
              </div>
              <button 
                onClick={loadRules} 
                className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.05] transition-colors"
                title="Refresh Memory list"
              >
                <RotateCw className={`w-3.5 h-3.5 text-foreground/45 ${fetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* List Loader / Empty State */}
            {fetching ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <RotateCw className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/35">Syncing Memories...</span>
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-foreground/5 bg-foreground/[0.005] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[11px] font-bold text-foreground/80 uppercase">No Guidance Prompts Trained</h4>
                  <p className="text-[10px] text-foreground/35 max-w-sm font-medium leading-relaxed">
                    AI is currently running on default brand parameters. Use the training form on the left to inject dynamic directives.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {rules.map((rule, index) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-5 rounded-2xl bg-foreground/[0.01] hover:bg-foreground/[0.02] border border-foreground/[0.04] hover:border-foreground/[0.07] flex gap-4 items-start group justify-between transition-all"
                    >
                      <div className="space-y-2 flex-1">
                        {/* Memory Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                            Memory #{index + 1}
                          </span>
                          <span className="text-[8.5px] font-medium text-foreground/30 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(rule.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>

                        {/* Content text */}
                        <div className="flex items-start gap-1">
                          <CornerDownRight className="w-3.5 h-3.5 text-indigo-400/50 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-foreground/75 leading-relaxed font-semibold font-sans break-words whitespace-pre-line">
                            {rule.prompt}
                          </p>
                        </div>
                      </div>

                      {/* Delete Memory Action */}
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/0 hover:border-rose-500/15 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all shrink-0 mt-0.5"
                        title="Delete trained guideline"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
