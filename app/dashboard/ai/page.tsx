"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Bot, ShieldCheck, Sunrise, Activity, ClipboardList,
  TrendingUp, ArrowRight, ShieldAlert, Zap, Cpu, Settings2, BarChart2
} from "lucide-react";

export default function AIModuleHubPage() {
  const [health, setHealth] = useState<{ status: "loading" | "ok" | "error"; message?: string } | null>(null);
  const [stats, setStats] = useState({ activeBatches: 0, totalLogs: 0, lowStockCount: 0 });

  // Load operational health and stats
  useEffect(() => {
    async function loadStats() {
      setHealth({ status: "loading" });
      try {
        const resHealth = await fetch("/api/admin/claude/health");
        const dataHealth = await resHealth.json();
        if (dataHealth.status === "ok") {
          setHealth({ status: "ok" });
        } else {
          setHealth({ status: "error", message: dataHealth.message });
        }
      } catch {
        setHealth({ status: "error", message: "Failed to verify Claude API connectivity." });
      }

      try {
        // Run brief summary fetch from backend to count active logs and batches
        const resBrief = await fetch("/api/admin/claude/briefing");
        const briefing = await resBrief.json();
        if (briefing && briefing.overview) {
          setStats({
            activeBatches: briefing.production?.activeBatches || 0,
            totalLogs: briefing.overview?.totalOrders || 0,
            lowStockCount: briefing.fabric?.lowStock?.length || 0,
          });
        }
      } catch {
        // Silence non-critical stats fail
      }
    }
    loadStats();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-20 space-y-8 max-w-6xl mx-auto relative z-10">
      {/* Greeting Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 lg:p-8 rounded-[1.8rem] bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent border border-violet-500/10 shadow-inner">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-violet-400 animate-pulse" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.25em]">Cognitive Operations Suite</span>
          </div>
          <h1 className="text-xl lg:text-3xl font-extrabold text-foreground tracking-tight leading-none uppercase">Zica Bella intelligence</h1>
          <p className="text-[11px] lg:text-[12px] text-foreground/50 max-w-xl font-medium leading-relaxed">
            Welcome to the centralized Zica AI Module. Coordinate complex supply-chain logistics internally, or manage public conversational guardrails and security configurations for mobile users.
          </p>
        </div>

        {/* Live Status Indicators */}
        <div className="flex gap-4">
          <div className="px-5 py-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-[8px] font-bold text-foreground/35 uppercase tracking-widest block">System Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.status === "ok" ? "bg-emerald-500" : health?.status === "error" ? "bg-rose-500" : "bg-amber-500"} animate-pulse`} />
              <span className="text-[11px] font-bold uppercase text-foreground/80">
                {health?.status === "ok" ? "Claude 4.6 Online" : health?.status === "error" ? "Config Error" : "Syncing API..."}
              </span>
            </div>
          </div>
          <div className="px-5 py-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-1">
            <span className="text-[8px] font-bold text-foreground/35 uppercase tracking-widest block">Active Batches</span>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] font-bold text-foreground/80">{stats.activeBatches} Monitored</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Choice Hub */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Branch 1: Zica AI - Admin */}
        <motion.div whileHover={{ y: -4 }} className="glass-card rounded-[2rem] border border-foreground/5 overflow-hidden flex flex-col group transition-all">
          <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/10 shadow-lg shadow-violet-500/5 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-7 h-7 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg lg:text-xl font-bold text-foreground uppercase tracking-tight">Zica AI - Admin Panel</h2>
                <p className="text-[11px] lg:text-[12px] text-foreground/45 leading-relaxed font-medium">
                  The primary operations center for brand managers and warehouse teams. Grant command access to production streams, low-stock reorders, automated operational daily briefings, and mail automation tools.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-foreground/[0.05]">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-violet-400" /> Active Tooling</div>
                <div className="flex items-center gap-1.5"><Sunrise className="w-3.5 h-3.5 text-violet-400" /> Daily Briefing</div>
                <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-violet-400" /> Batch Advancing</div>
                <div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-violet-400" /> Operational Logs</div>
              </div>

              <Link href="/dashboard/ai/admin"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 hover:from-violet-500/20 hover:to-indigo-500/20 text-foreground font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all"
              >
                Enter Admin Panel
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Branch 2: Zica AI - User */}
        <motion.div whileHover={{ y: -4 }} className="glass-card rounded-[2rem] border border-foreground/5 overflow-hidden flex flex-col group transition-all">
          <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-indigo-500/10 shadow-lg shadow-indigo-500/5 group-hover:scale-105 transition-transform duration-300">
                <Bot className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg lg:text-xl font-bold text-foreground uppercase tracking-tight">Zica AI - User Concierge</h2>
                <p className="text-[11px] lg:text-[12px] text-foreground/45 leading-relaxed font-medium">
                  The client-facing gateway powering the React Native app. Set security parameters, limit tool visibility, lock deep-link page targets, and use the sandbox simulator to safely test context-based answers.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-t-foreground/[0.05]">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                <div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Context Scoping</div>
                <div className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5 text-indigo-400" /> Navigation Toggles</div>
                <div className="flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5 text-indigo-400" /> Sandbox Sandbox</div>
                <div className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> Data Leak Protection</div>
              </div>

              <Link href="/dashboard/ai/user"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 hover:from-indigo-500/20 hover:to-blue-500/20 text-foreground font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all"
              >
                Configure User AI
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Subtext info */}
      <div className="p-5 rounded-2xl bg-foreground/[0.01] border border-foreground/[0.04] flex items-start gap-3 max-w-2xl mx-auto">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground">Strict Data Protection Activated</h4>
          <p className="text-[9px] text-foreground/40 leading-relaxed">
            Zica AI utilizes a cryptographic userContext structure during API calls. Regular customer accounts can never bypass tool filters or fetch order/payment data belonging to other buyers, keeping your shop 100% compliant with standard privacy policies.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
