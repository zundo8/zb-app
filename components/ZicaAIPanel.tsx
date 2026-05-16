"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ZicaAIPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/zica-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages([...updated, { role: "assistant", content: data.message }]);
    } catch (e: any) {
      setError(e.message || "Zica AI unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--border, #333)", borderRadius: "16px", padding: "24px", marginTop: "24px", background: "var(--card, #0a0a0a)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--foreground, #fff)", opacity: 0.8 }}>
        Zica AI — Test Console
      </h3>
      <div style={{ minHeight: "200px", maxHeight: "400px", overflowY: "auto", marginBottom: "16px", padding: "12px", borderRadius: "12px", background: "var(--background, #000)", border: "1px solid var(--border, #222)" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--foreground, #888)", opacity: 0.4, fontSize: "12px", textAlign: "center", paddingTop: "80px" }}>
            Send a message to test Zica AI
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "12px", textAlign: m.role === "user" ? "right" : "left" }}>
            <span style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role === "user" ? "var(--foreground, #fff)" : "var(--border, #1a1a1a)",
              color: m.role === "user" ? "var(--background, #000)" : "var(--foreground, #fff)",
              fontSize: "13px",
              maxWidth: "80%",
              lineHeight: 1.6,
              fontWeight: 500,
            }}>
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: "left", marginBottom: "12px" }}>
            <span style={{ display: "inline-block", padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "var(--border, #1a1a1a)", color: "var(--foreground, #888)", fontSize: "12px", opacity: 0.6, fontWeight: 600, letterSpacing: "0.1em" }}>
              Thinking...
            </span>
          </div>
        )}
        {error && <p style={{ color: "#ef4444", fontSize: "11px", marginTop: "8px" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask Zica AI something..."
          disabled={loading}
          style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border, #333)", fontSize: "13px", background: "var(--background, #000)", color: "var(--foreground, #fff)", outline: "none" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ padding: "10px 20px", borderRadius: "10px", background: loading || !input.trim() ? "var(--border, #222)" : "var(--foreground, #fff)", color: loading || !input.trim() ? "var(--foreground, #555)" : "var(--background, #000)", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
