// ──────────────────────────────────────────────────
// useClaude — React hook for AI chat state
// Handles: messages, history, localStorage persist,
// page context, tool action tracking
// ──────────────────────────────────────────────────

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolsUsed?: number;
  toolActions?: ToolAction[];
  isError?: boolean;
}

export interface ToolAction {
  tool: string;
  input: any;
  result: any;
  timestamp: string;
}

interface ConversationEntry {
  role: "user" | "assistant";
  content: string | any[];
}

interface UseClaudeOptions {
  /** Storage key for localStorage persistence */
  storageKey?: string;
  /** Page context label (e.g. "production-tracker") */
  pageContext?: string;
  /** Live page data to send as context */
  contextData?: any;
  /** Custom endpoint URL, defaults to "/api/admin/claude" */
  apiUrl?: string;
}

export function useClaude(options: UseClaudeOptions = {}) {
  const { storageKey, pageContext, contextData, apiUrl } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`zica-ai-${storageKey}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.messages) {
          setMessages(data.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
        }
        if (data.conversationHistory) {
          setConversationHistory(data.conversationHistory);
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Save to localStorage on change
  useEffect(() => {
    if (!storageKey || messages.length === 0) return;
    try {
      localStorage.setItem(
        `zica-ai-${storageKey}`,
        JSON.stringify({ messages: messages.slice(-50), conversationHistory: conversationHistory.slice(-30) })
      );
    } catch { /* ignore */ }
  }, [messages, conversationHistory, storageKey]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch(apiUrl || "/api/admin/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationHistory,
            pageContext,
            contextData: contextData ? JSON.stringify(contextData).slice(0, 4000) : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to get response");

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          toolsUsed: data.toolsUsed || 0,
          toolActions: data.toolActions || [],
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setConversationHistory(data.conversationHistory || []);
      } catch (error: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${error.message || "Something went wrong."}`,
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, conversationHistory, pageContext, contextData]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    if (storageKey) {
      try { localStorage.removeItem(`zica-ai-${storageKey}`); } catch { /* ignore */ }
    }
  }, [storageKey]);

  const runBriefing = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/claude/briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setMessages((prev) => [
        ...prev,
        {
          id: `briefing-${Date.now()}`,
          role: "assistant",
          content: data.briefing || "No briefing data available.",
          timestamp: new Date(),
          toolsUsed: 1,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "assistant", content: `⚠️ ${error.message}`, timestamp: new Date(), isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    runBriefing,
    scrollRef,
    messageCount: messages.filter((m) => m.role === "user").length,
  };
}
