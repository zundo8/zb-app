"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, Send, CheckCircle2, AlertCircle, BarChart3, 
  Plus, Search, Sparkles, Image as ImageIcon, FileText, 
  RefreshCcw, ArrowRightLeft, ShieldCheck, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppHubPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "cod" | "templates">("campaigns");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage transactional notifications and marketing campaigns</p>
        </div>
        <button className="bg-foreground text-background px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="flex gap-6 border-b border-foreground/10 pb-1">
        {[
          { id: "campaigns", label: "Campaigns", icon: Send },
          { id: "cod", label: "COD Operations", icon: ShieldCheck },
          { id: "templates", label: "Templates", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "border-emerald-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "campaigns" && <Campaigns />}
          {activeTab === "cod" && <CODOperations />}
          {activeTab === "templates" && <TemplatesManager />}
        </motion.div>
      </AnimatePresence>
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
    <div className="space-y-6">
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
          <thead className="bg-foreground/[0.02] border-b border-foreground/10">
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
    </div>
  );
}

const WHATSAPP_TEMPLATES = [
  { id: "marketing_sale", name: "Season Sale Blast", type: "Marketing", body: "Hey *[Name]*, our new collection is live! 🛍️ Use code ZICA10 for 10% off." },
  { id: "return_confirm", name: "Return Confirmation", type: "Utility", body: "Hello *[Name]*, your return request for order *[Order_ID]* has been accepted. Our courier partner will pick it up within 24-48 hours." },
  { id: "exchange_confirm", name: "Exchange Confirmation", type: "Utility", body: "Hi *[Name]*, your exchange for order *[Order_ID]* is processed. New item: *[New_Item]* will be dispatched shortly." },
  { id: "delivery_update", name: "Delivery Status", type: "Utility", body: "Good news *[Name]*! Your Zica Bella order *[Order_ID]* is out for delivery today. 🚚" },
];

function Campaigns() {
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateSelect = (tid: string) => {
    setTemplateId(tid);
    const template = WHATSAPP_TEMPLATES.find(t => t.id === tid);
    if (template) setBody(template.body);
  };

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
          templateId: templateId || undefined,
          mediaUrl: mediaUrl || undefined
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Success! WhatsApp queued for ${data.sent} customers.`);
        setBody("");
        setTemplateId("");
        setMediaUrl("");
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
      <div className="glass-card p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
          <MessageCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">WhatsApp Campaigns</h3>
        <p className="text-foreground/50 text-sm max-w-md mx-auto mb-6">
          Create and send bulk marketing messages using pre-approved Meta templates. Target specific segments based on purchase history.
        </p>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-6 py-3 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">New Campaign</h2>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {generating ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Write
          </button>
        </div>
        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors appearance-none"
              >
                <option value="all">All Subscribers</option>
                <option value="vip">VIP Customers</option>
                <option value="recent">Last 30 Days Buyers</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
                Template
              </label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors appearance-none"
              >
                <option value="">Custom Message</option>
                {WHATSAPP_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block flex justify-between">
              Message Content
              <span className="text-[10px] lowercase font-normal">{body.length} characters</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter message content..."
              rows={4}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors resize-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider text-foreground/50 uppercase mb-2 block">
              Media URL (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://image-url.jpg"
                className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-foreground/5 border border-foreground/10 rounded-xl hover:bg-foreground/10 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-foreground/60" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 bg-foreground/5 text-foreground font-medium py-3 rounded-xl hover:bg-foreground/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-emerald-500 text-foreground font-medium py-3 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Live Preview */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 flex flex-col items-center justify-center bg-gradient-to-br from-background to-emerald-500/5">
        <div className="w-[280px] h-[550px] border-[8px] border-foreground/10 rounded-[3rem] relative bg-background shadow-2xl flex flex-col overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-6 bg-foreground/10 z-10 rounded-t-3xl" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-full z-20" />

          <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] pt-16 px-3 flex flex-col overflow-y-auto scrollbar-hide" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover' }}>
            <div className="text-center mb-4 sticky top-0 bg-[#efeae2]/90 dark:bg-[#0b141a]/90 backdrop-blur-sm py-2 rounded-xl border border-foreground/10 shadow-sm z-10">
              <h3 className="text-xs font-semibold text-foreground">Zica Bella</h3>
              <p className="text-[10px] text-emerald-500">Business Account</p>
            </div>

            <div className="space-y-2 mb-4">
              {mediaUrl && (
                <div className="bg-foreground dark:bg-[#005c4b] p-1 rounded-xl rounded-tr-sm shadow-sm self-end max-w-[85%] border border-background/5">
                  <img src={mediaUrl} alt="Campaign Media" className="w-full h-32 object-cover rounded-lg" />
                </div>
              )}
              {body && (
                <div className="bg-foreground dark:bg-[#005c4b] text-background dark:text-foreground p-2.5 rounded-xl rounded-tr-sm shadow-sm text-sm self-end max-w-[85%] whitespace-pre-wrap relative border border-background/5 dark:border-foreground/5">
                  {body}
                  <div className="text-[9px] text-background/40 dark:text-foreground/40 text-right mt-1">12:00 PM</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TemplatesManager() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {WHATSAPP_TEMPLATES.map((t) => (
        <div key={t.id} className="glass-card p-5 group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-foreground/5 px-2 py-1 rounded">
              {t.type}
            </span>
          </div>
          <h4 className="font-semibold text-sm mb-1">{t.name}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
            {t.body}
          </p>
          <div className="flex items-center justify-between pt-4 border-t border-foreground/5">
            <span className="text-[10px] text-emerald-500 font-medium">Meta Approved</span>
            <button className="text-xs font-medium flex items-center gap-1 group-hover:text-emerald-500 transition-colors">
              Use Template <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <button className="glass-card p-5 border-dashed flex flex-col items-center justify-center gap-3 hover:bg-foreground/5 transition-all min-h-[160px]">
        <div className="p-3 bg-foreground/5 rounded-full">
          <Plus className="w-6 h-6 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Add Meta Template</span>
      </button>
    </div>
  );
}

