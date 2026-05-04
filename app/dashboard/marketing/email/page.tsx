"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function EmailHubPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/marketing/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          targetAudience,
          subject,
          messageBody: body,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Success! Sent to ${data.sent} customers.`);
        setSubject("");
        setBody("");
      } else {
        toast.error(data.error || "Failed to send email campaign.");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-campaign-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          campaignGoal: "Announce new Streetwear Collection Drop",
          tone: "premium, exclusive"
        }),
      });
      const data = await res.json();
      if (res.ok && data.content) {
        setSubject(data.content.subject || "");
        setBody(data.content.bodyHtml || data.content.preview || "");
        toast.success("AI Content Generated!");
      } else {
        toast.error("Failed to generate content");
      }
    } catch (e) {
      toast.error("AI Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage email marketing via SendGrid</p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-blue-500/20 transition-all disabled:opacity-50"
        >
          {generating ? <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Auto-Generate with AI
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors appearance-none"
              >
                <option value="all">All Subscribers</option>
                <option value="vip">VIP Customers (&gt;2 orders)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Exclusive Access: New Drop"
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                HTML Email Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<h1>Discover the New Collection</h1>..."
                rows={8}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors resize-none font-mono text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-foreground text-background font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <span className="animate-pulse">Sending Emails...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Launch Campaign</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Live Preview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 bg-gradient-to-br from-background to-blue-500/5">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-medium">Inbox Preview</h2>
          </div>
          
          <div className="bg-background border border-foreground/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">From:</span>
                <span className="text-xs">Zica Bella &lt;hello@zicabella.com&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Subject:</span>
                <span className="text-xs font-medium">{subject || "No Subject"}</span>
              </div>
            </div>
            <div className="p-6 min-h-[300px] bg-white text-black prose prose-sm max-w-none">
              {body ? (
                <div dangerouslySetInnerHTML={{ __html: body }} />
              ) : (
                <div className="text-gray-400 italic flex items-center justify-center h-full">Your email content will preview here</div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
