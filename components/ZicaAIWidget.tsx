"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  Sparkles, ArrowUp, X, Loader2, Bot, User, Copy, Check,
} from "lucide-react";
import { useClaude, type ChatMessage } from "@/lib/hooks/useClaude";
import { useTheme } from "next-themes";

// ─── Helpers ─────────────────────────────────────

function formatContent(text: string) {
  return text
    .split("\n")
    .map((line) => {
      let f = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
      if (f.trim().startsWith("- ") || f.trim().startsWith("• ")) {
        f = `<span class="inline-block w-1 h-1 rounded-full bg-current opacity-30 mr-2 shrink-0 relative top-[-1px]"></span>${f.replace(/^[\s]*[-•]\s*/, "")}`;
        return `<div class="flex items-start gap-0 ml-1 mb-0.5">${f}</div>`;
      }
      if (/^\d+\.\s/.test(f.trim())) {
        const n = f.trim().match(/^(\d+)\.\s/)?.[1];
        f = f.replace(/^\s*\d+\.\s*/, "");
        return `<div class="flex items-start gap-2 ml-1 mb-0.5"><span class="opacity-30 font-mono text-[10px] font-bold min-w-[16px]">${n}.</span><span>${f}</span></div>`;
      }
      if (f.trim() === "") return `<div class="h-2"></div>`;
      return `<div class="mb-0.5">${f}</div>`;
    })
    .join("");
}

// ─── Component ───────────────────────────────────

export default function ZicaAIWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Always use public-facing AI endpoint for webstore
  const isPublic = !pathname?.startsWith("/dashboard") && !pathname?.startsWith("/web-store");
  const apiUrl = isPublic ? "/api/zica-ai" : "/api/admin/claude";

  const { messages, isLoading, sendMessage, clearChat, scrollRef } = useClaude({
    storageKey: isPublic ? "webstore-public" : "admin-global",
    pageContext: isPublic ? undefined : undefined,
    contextData: isPublic ? undefined : undefined,
    apiUrl,
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
      {/* ── Floating Trigger Orb ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 20 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-5 right-4 md:right-5 z-[100] w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-300 group apple-glass-capsule liquid-glass-hover-sweep"
            aria-label="Zica AI"
          >
            <div className="apple-glass-sweep-glow" />
            <Sparkles className="w-4 h-4 text-foreground/50 group-hover:text-foreground/80 group-hover:rotate-12 transition-all duration-300 z-10" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Liquid Glass Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[calc(100vw-2rem)] md:max-w-[420px] h-[100dvh] md:h-[min(640px,calc(100dvh-3rem))] rounded-none md:rounded-[1.75rem] z-[100] flex flex-col overflow-hidden transition-all duration-500 apple-glass-capsule"
          >
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-5 py-3 shrink-0 transition-colors duration-500"
              style={{
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-500"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-foreground/60" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-foreground tracking-tight leading-none">Zica AI</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
                    <span className="text-[9px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">
                      Personal Stylist
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={clearChat} className="p-2 rounded-xl text-foreground/25 hover:text-foreground/60 hover:bg-foreground/5 transition-all text-[9px] font-bold uppercase tracking-wider">
                  Clear
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl text-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto transition-colors duration-500"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-foreground/40" />
                  </div>
                  <p className="text-[11px] text-foreground/35 font-medium max-w-xs mx-auto leading-relaxed">
                    Hi, I&apos;m Zica. Ask me anything about styling, size guides, fabric care, or finding the perfect piece!
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-500"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <Bot className="w-3 h-3 text-foreground/50" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] group relative ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-sm px-4 py-2.5 font-medium transition-colors duration-500"
                      : "space-y-1.5"
                  }`}
                    style={msg.role === "user" ? {
                      background: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
                      color: isDark ? "#111" : "#fff",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    } : undefined}
                  >
                    {msg.role === "user" ? (
                      <p className="text-[13px] font-medium leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3 space-y-1.5 transition-colors duration-500"
                        style={{
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                          border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.04)",
                        }}
                      >
                        <div className={`text-[12.5px] leading-[1.7] font-medium text-foreground/85 ${msg.isError ? "text-red-500" : ""}`}
                          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        />
                        
                        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyText(msg.id, msg.content)} className="p-1 rounded-md hover:bg-foreground/5 text-foreground/15 hover:text-foreground/40 transition-all">
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-500"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.03)",
                      }}
                    >
                      <User className="w-3 h-3 text-foreground/30" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <Bot className="w-3 h-3 text-foreground/50" />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-colors duration-500"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.03)",
                    }}
                  >
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/20 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground/20 uppercase tracking-[0.15em]">Thinking...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Form */}
            <div className="relative z-10 shrink-0 p-3.5 transition-colors duration-500"
              style={{
                borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                background: isDark ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.25)",
                backdropFilter: "blur(15px)",
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask Zica anything..."
                  rows={1}
                  className="flex-1 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none transition-all resize-none"
                  style={{
                    minHeight: "44px",
                    maxHeight: "120px",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
                  }}
                  onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "44px"; t.style.height = `${Math.min(t.scrollHeight, 120)}px`; }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90"
                  style={{
                    background: input.trim() && !isLoading
                      ? (isDark ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.95)")
                      : (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"),
                    color: input.trim() && !isLoading
                      ? (isDark ? "#000" : "#fff")
                      : (isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.25)"),
                    cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                  }}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
