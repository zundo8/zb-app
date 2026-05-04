"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, X, Loader2, Bot, User, Zap, Copy, Check,
} from "lucide-react";
import { useClaude, type ChatMessage, type ToolAction } from "@/lib/hooks/useClaude";

// ─── Props ───────────────────────────────────────

interface ZicaAIWidgetProps {
  /** Page identifier (e.g. "production-tracker", "orders", "inventory") */
  pageContext?: string;
  /** Current page data passed as context to Claude */
  contextData?: any;
}

// ─── Helpers ─────────────────────────────────────

function formatContent(text: string) {
  return text
    .split("\n")
    .map((line, i) => {
      let f = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
      if (f.trim().startsWith("- ") || f.trim().startsWith("• ")) {
        f = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-foreground/30 mr-2 shrink-0 relative top-[-1px]"></span>${f.replace(/^[\s]*[-•]\s*/, "")}`;
        return `<div class="flex items-start gap-0 ml-1 mb-0.5">${f}</div>`;
      }
      if (/^\d+\.\s/.test(f.trim())) {
        const n = f.trim().match(/^(\d+)\.\s/)?.[1];
        f = f.replace(/^\s*\d+\.\s*/, "");
        return `<div class="flex items-start gap-2 ml-1 mb-0.5"><span class="text-foreground/30 font-mono text-[10px] font-bold min-w-[16px]">${n}.</span><span>${f}</span></div>`;
      }
      if (f.trim() === "") return `<div class="h-2"></div>`;
      return `<div class="mb-0.5">${f}</div>`;
    })
    .join("");
}

const TOOL_LABELS: Record<string, string> = {
  get_production_batches: "Fetched production data",
  advance_production_stage: "Advanced production stage",
  get_pending_tasks: "Checked tasks",
  create_task: "Created task",
  update_task_status: "Updated task",
  get_fabric_inventory: "Checked fabric inventory",
  get_orders_summary: "Fetched orders",
  update_order_status: "Updated order status",
  get_low_stock_products: "Checked low stock",
  create_reorder_request: "Created reorder request",
  get_vendors: "Fetched vendors",
  get_cost_ledger: "Checked costs",
  get_returns_exchanges: "Checked returns/exchanges",
  get_dashboard_summary: "Fetched dashboard",
  generate_daily_briefing: "Generated briefing",
  send_push_notification: "Sent notification",
  get_ai_action_log: "Fetched AI log",
};

// ─── Component ───────────────────────────────────

export default function ZicaAIWidget({ pageContext, contextData }: ZicaAIWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, sendMessage, clearChat, scrollRef } = useClaude({
    storageKey: pageContext || "global",
    pageContext,
    contextData,
  });

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-2xl shadow-foreground/20 group"
          >
            <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            <span className="absolute inset-0 rounded-2xl border-2 border-foreground/30 animate-ping opacity-20" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 w-[calc(100vw-2rem)] max-w-[440px] h-[min(680px,calc(100dvh-3rem))] rounded-[1.75rem] z-[100] flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsla(var(--glass-bg), 0.92), hsla(var(--glass-bg), 0.85))",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid hsla(var(--glass-border), 0.12)",
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.35)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-foreground/[0.06] shrink-0 bg-foreground/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center border border-violet-500/10">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-foreground tracking-tight leading-none">Zica AI</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.15em]">
                      {pageContext ? pageContext.replace(/-/g, " ") : "Operations Engine"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={clearChat} className="p-2 rounded-xl text-foreground/30 hover:text-foreground hover:bg-foreground/5 transition-all text-[9px] font-bold uppercase tracking-wider">
                  Clear
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl text-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mx-auto border border-violet-500/10">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-[11px] text-foreground/40 font-medium max-w-xs mx-auto">
                    Ask me anything about {pageContext ? `the ${pageContext.replace(/-/g, " ")}` : "your operations"}. I can take actions, not just answer questions.
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-violet-500/10">
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] group relative ${msg.role === "user" ? "bg-foreground text-background rounded-2xl rounded-br-md px-4 py-3" : "space-y-1.5"}`}>
                    {msg.role === "user" ? (
                      <p className="text-[13px] font-medium leading-relaxed">{msg.content}</p>
                    ) : (
                      <>
                        {/* Tool Action Cards */}
                        {msg.toolActions && msg.toolActions.length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {msg.toolActions.map((a, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/10">
                                <Zap className="w-3 h-3 text-violet-400 shrink-0" />
                                <span className="text-[10px] font-bold text-violet-400/80 uppercase tracking-wider">
                                  {TOOL_LABELS[a.tool] || a.tool}
                                </span>
                                {a.result?.success && <Check className="w-3 h-3 text-emerald-500 ml-auto" />}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`text-[12.5px] leading-[1.7] font-medium ${msg.isError ? "text-rose-500" : "text-foreground/80"}`}
                          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        />
                        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {msg.toolsUsed ? (
                            <span className="text-[8px] font-bold text-violet-400/60 uppercase tracking-[0.2em] flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />{msg.toolsUsed} tool{msg.toolsUsed > 1 ? "s" : ""}
                            </span>
                          ) : null}
                          <button onClick={() => copyText(msg.id, msg.content)} className="p-1 rounded-md hover:bg-foreground/5 text-foreground/20 hover:text-foreground/60 transition-all">
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5 border border-foreground/5">
                      <User className="w-3.5 h-3.5 text-foreground/40" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 border border-violet-500/10">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-foreground/[0.03] border border-foreground/5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400/20 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[10px] font-bold text-foreground/25 uppercase tracking-[0.2em]">Processing...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-foreground/[0.06] p-3 bg-foreground/[0.01]">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={pageContext ? `Ask about ${pageContext.replace(/-/g, " ")}...` : "Ask Zica AI..."}
                  rows={1}
                  className="flex-1 bg-foreground/[0.04] border border-foreground/[0.06] rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-violet-500/30 transition-all resize-none"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                  onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "44px"; t.style.height = `${Math.min(t.scrollHeight, 120)}px`; }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                    input.trim() && !isLoading ? "bg-foreground text-background shadow-lg" : "bg-foreground/5 text-foreground/15 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
