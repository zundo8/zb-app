"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, CheckCircle2, AlertCircle, BarChart3, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppHubPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "cod">("cod");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage COD confirmations and marketing campaigns</p>
        </div>
        <button className="bg-foreground text-background px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="flex gap-4 border-b border-foreground/10 pb-1">
        <button
          onClick={() => setActiveTab("cod")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cod" ? "border-foreground text-foreground" : "border-transparent text-foreground/50 hover:text-foreground/80"
          }`}
        >
          COD Operations
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "campaigns" ? "border-foreground text-foreground" : "border-transparent text-foreground/50 hover:text-foreground/80"
          }`}
        >
          Campaigns
        </button>
      </div>

      {activeTab === "cod" ? <CODOperations /> : <Campaigns />}
    </div>
  );
}

function CODOperations() {
  const stats = [
    { label: "Pending Confirm", value: "42", icon: AlertCircle, color: "text-amber-500" },
    { label: "Confirmed Today", value: "128", icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Auto Cancelled", value: "14", icon: AlertCircle, color: "text-rose-500" },
    { label: "Avg Response Time", value: "12m", icon: BarChart3, color: "text-blue-500" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">{s.label}</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-foreground/10 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent COD Verifications</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Search orders..." 
              className="pl-9 pr-4 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-sm outline-none w-64 focus:border-foreground/30"
            />
          </div>
        </div>
        
        <table className="w-full text-sm">
          <thead className="bg-foreground-[0.02] border-b border-foreground/10">
            <tr>
              <th className="text-left font-medium text-foreground/60 px-5 py-3">Order</th>
              <th className="text-left font-medium text-foreground/60 px-5 py-3">Customer</th>
              <th className="text-left font-medium text-foreground/60 px-5 py-3">Amount</th>
              <th className="text-left font-medium text-foreground/60 px-5 py-3">Risk Score</th>
              <th className="text-left font-medium text-foreground/60 px-5 py-3">Status</th>
              <th className="text-right font-medium text-foreground/60 px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {/* Mock Data */}
            {[
              { id: "#1042", name: "Rahul Sharma", amount: "₹4,599", risk: 85, status: "pending" },
              { id: "#1043", name: "Priya Singh", amount: "₹2,199", risk: 12, status: "confirmed" },
              { id: "#1044", name: "Amit Kumar", amount: "₹8,999", risk: 45, status: "cancelled" },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-foreground/5 transition-colors">
                <td className="px-5 py-4 font-medium">{row.id}</td>
                <td className="px-5 py-4 text-foreground/80">{row.name}</td>
                <td className="px-5 py-4">{row.amount}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold ${
                    row.risk > 70 ? 'bg-rose-500/10 text-rose-500' :
                    row.risk > 30 ? 'bg-amber-500/10 text-amber-500' :
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {row.risk}/100
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    row.status === 'confirmed' ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/10' :
                    row.status === 'cancelled' ? 'border-rose-500/20 text-rose-600 bg-rose-500/10' :
                    'border-amber-500/20 text-amber-600 bg-amber-500/10'
                  }`}>
                    {row.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {row.status === 'pending' && (
                    <button className="text-xs font-medium text-blue-500 hover:text-blue-600">
                      Resend WhatsApp
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function Campaigns() {
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/marketing/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          targetAudience,
          messageBody: body,
          templateId: templateId || undefined
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Success! WhatsApp queued for ${data.sent} customers.`);
        setBody("");
        setTemplateId("");
        setShowForm(false);
      } else {
        toast.error(data.error || "Failed to send WhatsApp campaign.");
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
          channel: "whatsapp",
          campaignGoal: "VIP Early Access to New Drop",
          tone: "exclusive, engaging"
        }),
      });
      const data = await res.json();
      if (res.ok && data.content) {
        setBody(data.content.messageBody || data.content.body || "");
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

  if (!showForm) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
          <MessageCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">WhatsApp Campaigns</h3>
        <p className="text-foreground/50 text-sm max-w-md mx-auto mb-6">
          Create and send bulk marketing messages using pre-approved Meta templates. Target specific segments based on purchase history.
        </p>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Campaign
        </button>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">New Campaign</h2>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {generating ? <div className="w-3 h-3 rounded-full border border-emerald-500 border-t-transparent animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Write
          </button>
        </div>
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
              Meta Template ID (Optional)
            </label>
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="e.g. spring_sale_alert"
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
              WhatsApp Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hey *[Name]*, our new collection is live! 🛍️"
              rows={5}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-foreground/30 transition-colors resize-none"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 mt-4 bg-foreground/5 text-foreground font-medium py-3 rounded-xl hover:bg-foreground/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] mt-4 bg-emerald-500 text-white font-medium py-3 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <span className="animate-pulse">Sending...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Live Preview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 flex flex-col items-center justify-center bg-gradient-to-br from-background to-emerald-500/5">
        <div className="w-[280px] h-[550px] border-[8px] border-foreground/10 rounded-[3rem] relative bg-background shadow-2xl flex flex-col overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-6 bg-foreground/10 z-10 rounded-t-3xl" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />

          <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] pt-16 px-4 flex flex-col" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover', opacity: 0.9 }}>
            <div className="text-center mb-4 sticky top-0 bg-[#efeae2]/90 dark:bg-[#0b141a]/90 backdrop-blur-sm py-2 rounded-xl border border-foreground/10 shadow-sm z-10">
              <h3 className="text-xs font-semibold text-foreground">Zica Bella</h3>
              <p className="text-[10px] text-emerald-500">Business Account</p>
            </div>

            {body && (
              <div className="bg-white dark:bg-[#005c4b] text-black dark:text-white p-2.5 rounded-xl rounded-tr-sm shadow-sm text-sm self-end max-w-[85%] whitespace-pre-wrap relative mt-auto mb-4 border border-black/5 dark:border-white/5">
                {body}
                <div className="text-[9px] text-black/40 dark:text-white/40 text-right mt-1">12:00 PM</div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
