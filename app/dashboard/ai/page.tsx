"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Loader2, Bot, User, Zap, Activity, AlertCircle,
  Copy, Check, ClipboardList, TrendingUp, DollarSign, Building2,
  ShoppingCart, Undo2, RotateCcw, Sunrise, Moon, Package, RefreshCw,
} from "lucide-react";
import { useClaude, type ToolAction } from "@/lib/hooks/useClaude";

// ─── Quick Commands ──────────────────────────────

const QUICK_COMMANDS = [
  { label: "Daily Briefing", prompt: "Generate a comprehensive daily briefing.", icon: Sunrise, color: "from-violet-500/20 to-purple-500/20", text: "text-violet-400" },
  { label: "Production Status", prompt: "Show all production batches grouped by current stage. Highlight any bottlenecks.", icon: TrendingUp, color: "from-blue-500/20 to-cyan-500/20", text: "text-blue-400" },
  { label: "Pending Tasks", prompt: "List all pending tasks grouped by priority. Flag overdue items.", icon: ClipboardList, color: "from-amber-500/20 to-orange-500/20", text: "text-amber-400" },
  { label: "Low Stock Alert", prompt: "Check both product inventory and fabric inventory for low stock items. Suggest reorders.", icon: AlertCircle, color: "from-rose-500/20 to-pink-500/20", text: "text-rose-400" },
  { label: "Orders Overview", prompt: "Show recent orders with payment and fulfillment status. Flag any SLA violations.", icon: ShoppingCart, color: "from-emerald-500/20 to-teal-500/20", text: "text-emerald-400" },
  { label: "Vendor Directory", prompt: "List all manufacturing vendors grouped by category with contact info.", icon: Building2, color: "from-indigo-500/20 to-blue-500/20", text: "text-indigo-400" },
  { label: "Cost Analysis", prompt: "Show manufacturing cost breakdown — total expenses and per-batch costs. Flag anomalies.", icon: DollarSign, color: "from-lime-500/20 to-green-500/20", text: "text-lime-400" },
  { label: "Returns & Exchanges", prompt: "Show all pending returns and exchanges. Suggest next actions.", icon: Undo2, color: "from-sky-500/20 to-blue-500/20", text: "text-sky-400" },
];

// ─── Tool label map ──────────────────────────────

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  get_dashboard_summary: { label: "Dashboard data fetched", icon: "📊" },
  get_production_batches: { label: "Production batches loaded", icon: "🏭" },
  advance_production_stage: { label: "Production stage advanced", icon: "⚡" },
  get_pending_tasks: { label: "Tasks checked", icon: "📋" },
  create_task: { label: "Task created", icon: "✅" },
  update_task_status: { label: "Task updated", icon: "✏️" },
  get_fabric_inventory: { label: "Fabric inventory checked", icon: "🧵" },
  get_low_stock_products: { label: "Low stock checked", icon: "📦" },
  create_reorder_request: { label: "Reorder request created", icon: "🔄" },
  get_orders_summary: { label: "Orders loaded", icon: "🛒" },
  update_order_status: { label: "Order status updated", icon: "📝" },
  get_returns_exchanges: { label: "Returns/exchanges checked", icon: "↩️" },
  get_vendors: { label: "Vendor list fetched", icon: "🏢" },
  get_cost_ledger: { label: "Cost data loaded", icon: "💰" },
  generate_daily_briefing: { label: "Briefing generated", icon: "☀️" },
  send_push_notification: { label: "Push notification sent", icon: "🔔" },
  get_ai_action_log: { label: "Action log fetched", icon: "📜" },
};

// ─── Markdown formatter ──────────────────────────

function fmt(text: string) {
  return text.split("\n").map((line, i) => {
    let f = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
    if (f.trim().startsWith("- ") || f.trim().startsWith("• ")) {
      f = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-400/40 mr-2 shrink-0 relative top-[-1px]"></span>${f.replace(/^[\s]*[-•]\s*/, "")}`;
      return `<div class="flex items-start gap-0 ml-1 mb-1">${f}</div>`;
    }
    if (/^\d+\.\s/.test(f.trim())) {
      const n = f.trim().match(/^(\d+)\.\s/)?.[1];
      f = f.replace(/^\s*\d+\.\s*/, "");
      return `<div class="flex items-start gap-2 ml-1 mb-1"><span class="text-violet-400/60 font-mono text-[11px] font-bold min-w-[20px]">${n}.</span><span>${f}</span></div>`;
    }
    if (f.trim() === "") return `<div class="h-2.5"></div>`;
    return `<div class="mb-1">${f}</div>`;
  }).join("");
}

// ─── Action Log Sidebar ──────────────────────────

function ActionLogPanel({ actions }: { actions: ToolAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="w-10 h-10 text-foreground/10 mb-3" />
        <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">No actions yet</p>
        <p className="text-[9px] text-foreground/15 mt-1">Tool calls will appear here as Zica AI takes actions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((a, i) => {
        const meta = TOOL_LABELS[a.tool] || { label: a.tool, icon: "⚙️" };
        const isSuccess = a.result?.success;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="p-3 rounded-xl bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.04] transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px]">{meta.icon}</span>
              <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-wider flex-1">{meta.label}</span>
              {isSuccess && <Check className="w-3 h-3 text-emerald-500" />}
            </div>
            {a.result?.message && (
              <p className="text-[10px] text-foreground/40 font-medium leading-relaxed line-clamp-2">{a.result.message}</p>
            )}
            <p className="text-[8px] text-foreground/15 font-mono mt-1.5">
              {new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Page Component ──────────────────────────────

export default function AICommandCenterPage() {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [allActions, setAllActions] = useState<ToolAction[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, sendMessage, clearChat, runBriefing, scrollRef } = useClaude({
    storageKey: "command-center",
  });

  // Collect all tool actions from messages
  useEffect(() => {
    const acts: ToolAction[] = [];
    for (const m of messages) {
      if (m.toolActions) acts.push(...m.toolActions);
    }
    setAllActions(acts);
  }, [messages]);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const handleSend = useCallback((text?: string) => {
    const t = text || input.trim();
    if (!t) return;
    sendMessage(t);
    setInput("");
  }, [input, sendMessage]);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = messages.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="pb-20 space-y-6 relative z-10 min-h-[calc(100dvh-180px)]"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center border border-violet-500/10 shadow-inner shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-foreground tracking-tight leading-none uppercase">AI Command Center</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Zica AI · Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runBriefing} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:from-violet-500/20 hover:to-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sunrise className="w-3.5 h-3.5 text-violet-400" />
            Run Daily Briefing
          </button>
          {hasMessages && (
            <button onClick={clearChat}
              className="flex items-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] transition-all active:scale-95"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6">
        {/* ─── Left: Chat Panel ─── */}
        <div className="glass-card rounded-[1.5rem] border border-foreground/5 overflow-hidden flex flex-col min-h-[500px] lg:min-h-[600px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-8 py-6 space-y-5">
            {/* Empty State */}
            {!hasMessages && !isLoading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex flex-col items-center justify-center py-6 space-y-8"
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mx-auto border border-violet-500/10 shadow-lg">
                    <Sparkles className="w-8 h-8 text-violet-400" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight uppercase">AI Command Center</h2>
                  <p className="text-[11px] text-foreground/40 font-medium max-w-md mx-auto">
                    Manage production, orders, inventory, tasks, and more through natural language. I take real actions — not just suggestions.
                  </p>
                </div>
                <div className="w-full max-w-2xl grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {QUICK_COMMANDS.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <button key={cmd.label} onClick={() => handleSend(cmd.prompt)}
                        className="flex flex-col items-center gap-3 p-4 rounded-xl bg-foreground/[0.02] border border-foreground/5 text-center hover:bg-foreground/[0.05] hover:border-foreground/10 transition-all group active:scale-[0.97]"
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cmd.color} flex items-center justify-center group-hover:scale-110 transition-transform border border-foreground/5`}>
                          <Icon className={`w-4 h-4 ${cmd.text}`} />
                        </div>
                        <span className="text-[9px] font-bold text-foreground/50 uppercase tracking-[0.1em] leading-tight">{cmd.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-violet-500/10">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                )}
                <div className={`max-w-[80%] group relative ${msg.role === "user" ? "bg-foreground text-background rounded-2xl rounded-br-md px-5 py-3.5" : "space-y-2"}`}>
                  {msg.role === "user" ? (
                    <p className="text-[13px] font-medium leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      {/* Inline tool action cards */}
                      {msg.toolActions && msg.toolActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.toolActions.map((a, i) => {
                            const meta = TOOL_LABELS[a.tool] || { label: a.tool, icon: "⚙️" };
                            return (
                              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/10">
                                <span className="text-[11px]">{meta.icon}</span>
                                <span className="text-[9px] font-bold text-violet-400/70 uppercase tracking-wider">{meta.label}</span>
                                {a.result?.success && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className={`text-[13px] leading-[1.75] font-medium ${msg.isError ? "text-rose-500" : "text-foreground/80"}`}
                        dangerouslySetInnerHTML={{ __html: fmt(msg.content) }}
                      />
                      <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.toolsUsed ? (
                          <span className="text-[8px] font-bold text-violet-400/60 uppercase tracking-[0.2em] flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />{msg.toolsUsed} tool{msg.toolsUsed > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        <span className="text-[8px] font-bold text-foreground/15 uppercase tracking-[0.2em]">
                          {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button onClick={() => copyText(msg.id, msg.content)} className="p-1 rounded-md hover:bg-foreground/5 text-foreground/20 hover:text-foreground/60 transition-all">
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5 border border-foreground/5">
                    <User className="w-4 h-4 text-foreground/40" />
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 border border-violet-500/10">
                  <Bot className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-foreground/[0.03] border border-foreground/5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-violet-400/20 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[10px] font-bold text-foreground/25 uppercase tracking-[0.2em]">Analyzing data...</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-foreground/[0.06] p-4 lg:p-5 bg-foreground/[0.01]">
            <div className="flex items-end gap-3">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Command Zica AI — manage tasks, advance production, analyze data..."
                rows={1} disabled={isLoading}
                className="flex-1 bg-foreground/[0.04] border border-foreground/[0.06] rounded-xl px-5 py-3.5 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10 transition-all resize-none"
                style={{ minHeight: "48px", maxHeight: "140px" }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "48px"; t.style.height = `${Math.min(t.scrollHeight, 140)}px`; }}
              />
              <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                  input.trim() && !isLoading ? "bg-foreground text-background shadow-lg" : "bg-foreground/5 text-foreground/15 cursor-not-allowed"
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2.5 px-1">
              <span className="text-[8px] font-bold text-foreground/15 uppercase tracking-[0.3em]">Powered by Claude · Sonnet 4</span>
              <span className="text-[8px] font-bold text-foreground/15 uppercase tracking-[0.3em]">
                {messages.filter((m) => m.role === "user").length} messages
              </span>
            </div>
          </div>
        </div>

        {/* ─── Right: Activity Feed ─── */}
        <div className="glass-card rounded-[1.5rem] border border-foreground/5 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-foreground/[0.06] bg-foreground/[0.02]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <h3 className="text-[11px] font-bold text-foreground/70 uppercase tracking-[0.2em]">Action Feed</h3>
              <span className="ml-auto text-[9px] font-bold text-foreground/20 bg-foreground/5 px-2 py-0.5 rounded-full">{allActions.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 max-h-[600px]">
            <ActionLogPanel actions={allActions} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
