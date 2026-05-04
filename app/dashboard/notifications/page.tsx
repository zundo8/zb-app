"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Send, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";

export default function PushNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/notifications/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          targetType,
          targetValue: targetType === 'segment' ? 'all' : undefined
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Push notification sent successfully!");
        setTitle("");
        setBody("");
      } else {
        toast.error(data.error || "Failed to send notification");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Push Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Send manual push notifications to iOS and Android devices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-foreground/5 rounded-xl border border-foreground/10">
              <Send className="w-5 h-5 text-foreground/70" />
            </div>
            <h2 className="text-lg font-medium">Compose Message</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Notification Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Flash Sale is Live!"
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Message Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tap to see the new collection..."
                rows={3}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors resize-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Target Audience
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors appearance-none"
              >
                <option value="all">All Active Devices</option>
                <option value="segment">VIP Customers</option>
                <option value="user">Specific User ID</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-foreground text-background font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Sending...</span>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Send Push Notification</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Live Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 flex flex-col items-center justify-center bg-gradient-to-br from-background to-foreground/5"
        >
          <div className="w-[300px] h-[600px] border-[8px] border-foreground/10 rounded-[3rem] relative bg-background shadow-2xl flex flex-col overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-6 bg-foreground/10 z-10 rounded-t-3xl" />
            
            {/* iOS Dynamic Island fake */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />

            {/* Content */}
            <div className="flex-1 bg-gradient-to-b from-blue-900/20 to-background pt-16 px-4">
              <div className="flex items-center justify-between mb-8 opacity-50">
                <span className="text-xs font-medium">9:41</span>
                <div className="flex gap-1.5">
                  <div className="w-4 h-2.5 bg-foreground rounded-sm" />
                  <div className="w-3.5 h-3.5 bg-foreground rounded-full" />
                </div>
              </div>

              {/* Notification Banner */}
              <AnimatePresence>
                {(title || body) && (
                  <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-foreground/10 backdrop-blur-xl border border-foreground/20 p-3.5 rounded-2xl shadow-xl flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-foreground/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">ZB</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-semibold">{title || "Notification Title"}</span>
                        <span className="text-[10px] opacity-50">now</span>
                      </div>
                      <p className="text-[11px] leading-snug opacity-80 line-clamp-2">
                        {body || "Your message will appear here. Keep it concise."}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
