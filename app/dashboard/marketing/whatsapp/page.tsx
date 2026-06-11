"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, Send, CheckCircle2, AlertCircle, BarChart3, 
  Plus, Search, Sparkles, Image as ImageIcon, FileText, 
  RefreshCcw, ArrowRightLeft, ShieldCheck, ChevronRight,
  Trash2, ToggleLeft, ToggleRight, Database, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppHubPage() {
  const [activeTab, setActiveTab] = useState<
    "campaigns" | "quick-send" | "abandoned-carts" | "templates" | "notifications" | "logs" | "cod"
  >("campaigns");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "loading">("loading");
  const [connectionError, setConnectionError] = useState("");
  const [statusData, setStatusData] = useState<any>(null);
  const [triggerRefresh, setTriggerRefresh] = useState(0);

  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch("/api/whatsapp/status");
        const data = await res.json();
        if (data.connected) {
          setConnectionStatus("connected");
          setConnectionError("");
          setStatusData(data);
        } else {
          setConnectionStatus("disconnected");
          setConnectionError(data.error || "Verify token or credentials");
          setStatusData(null);
        }
      } catch (err) {
        setConnectionStatus("disconnected");
        setConnectionError("Failed to connect to API service");
        setStatusData(null);
      }
    }
    checkConnection();
  }, [triggerRefresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage marketing campaigns, recovering checkouts and transactional triggers.</p>
        </div>
        
        {/* Section A: Connection Status Banner */}
        <div className="flex flex-col items-end gap-1 bg-foreground/5 p-3 rounded-xl border border-foreground/10">
          <div className="flex items-center gap-3">
            {connectionStatus === "loading" && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-foreground/5 text-muted-foreground border border-foreground/10">
                <RefreshCcw className="w-3 h-3 animate-spin" />
                <span>Checking Meta Connection...</span>
              </div>
            )}
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Meta Connected</span>
              </div>
            )}
            {connectionStatus === "disconnected" && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Not Connected</span>
              </div>
            )}
            
            <button 
              onClick={() => {
                setTriggerRefresh((p: number) => p + 1);
                toast.promise(
                  fetch("/api/whatsapp/status").then(async (res) => {
                    const data = await res.json();
                    if (!data.connected) throw new Error(data.error || "Verification failed");
                    return data;
                  }),
                  {
                    loading: 'Verifying Meta Connection...',
                    success: (data) => `Connected to ${data.name} (${data.phone})`,
                    error: (err) => `Failed: ${err.message}`
                  }
                );
              }}
              className="px-3 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-foreground font-semibold rounded-lg transition-colors"
            >
              Verify Connection
            </button>
          </div>

          {connectionStatus === "connected" && statusData && (
            <div className="text-[10px] text-muted-foreground flex gap-3 mt-1 font-mono">
              <span>Sender: <strong className="text-foreground">{statusData.phone}</strong></span>
              <span>WABA ID: <strong className="text-foreground">{statusData.wabaId}</strong></span>
            </div>
          )}

          {connectionStatus === "disconnected" && connectionError && (
            <span className="text-[10px] text-rose-500/80 max-w-[200px] text-right truncate" title={connectionError}>
              {connectionError}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-foreground/10 pb-1 overflow-x-auto scrollbar-hide">
        {[
          { id: "campaigns", label: "Campaigns", icon: Send },
          { id: "quick-send", label: "Quick Send", icon: MessageCircle },
          { id: "abandoned-carts", label: "Cart Recovery", icon: ArrowRightLeft },
          { id: "templates", label: "Templates", icon: FileText },
          { id: "notifications", label: "Automations", icon: ChevronRight },
          { id: "logs", label: "Logs", icon: BarChart3 },
          { id: "cod", label: "COD Operations", icon: ShieldCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
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
          {activeTab === "campaigns" && <BroadcastCampaigns />}
          {activeTab === "quick-send" && <QuickSendMessage />}
          {activeTab === "abandoned-carts" && <CartRecovery />}
          {activeTab === "templates" && <TemplatesManager onRefresh={() => setTriggerRefresh((p: number) => p + 1)} />}
          {activeTab === "notifications" && <OrderNotifications />}
          {activeTab === "logs" && <MessageLogs />}
          {activeTab === "cod" && <CODOperations />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ==========================================================================
   SECTION B: TEMPLATE LIBRARY & CRUD
   ========================================================================== */
function TemplatesManager({ onRefresh }: { onRefresh: () => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerImage, setHeaderImage] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttonType, setButtonType] = useState("NONE");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      } else {
        toast.error(data.error || "Failed to load templates.");
      }
    } catch (e) {
      toast.error("Network error loading templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    const toastId = toast.loading("Submitting 11 templates to Meta...");
    try {
      const res = await fetch("/api/whatsapp/templates/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully seeded ${data.seeded}/${data.total} templates!`, { id: toastId });
        fetchTemplates();
        onRefresh();
      } else {
        toast.error(data.error || "Templates seeding failed.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error during seeder process.", { id: toastId });
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (tname: string) => {
    if (!confirm(`Are you sure you want to delete template "${tname}"? This cannot be undone.`)) return;
    
    const toastId = toast.loading(`Deleting ${tname}...`);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tname })
      });
      if (res.ok) {
        toast.success(`Template ${tname} deleted successfully!`, { id: toastId });
        fetchTemplates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Delete template failed.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error deleting template.", { id: toastId });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Build components structure for WABA Template Registration
    const components: any[] = [];

    if (headerType === "TEXT" && headerText) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText
      });
    } else if (headerType === "IMAGE") {
      components.push({
        type: "HEADER",
        format: "IMAGE"
      });
    }

    components.push({
      type: "BODY",
      text: bodyText
    });

    if (footerText) {
      components.push({
        type: "FOOTER",
        text: footerText
      });
    }

    if (buttonType === "URL" && buttonText && buttonUrl) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: buttonText,
            url: buttonUrl
          }
        ]
      });
    }

    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, language, components })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template submitted for Meta review");
        setShowCreateModal(false);
        // Reset form
        setName("");
        setBodyText("");
        setFooterText("");
        setHeaderText("");
        setButtonText("");
        setButtonUrl("");
        fetchTemplates();
      } else {
        toast.error(data.error || "Failed to create template.");
      }
    } catch (err) {
      toast.error("Network error creating template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview body render replaces {{1}}, {{2}} with highlight tags
  const renderPreview = (text: string) => {
    if (!text) return "Hi customer, welcome to Zica Bella...";
    return text.split(/(\{\{\d\}\})/).map((part, i) => {
      if (part.match(/^\{\{\d\}\}$/)) {
        return <span key={i} className="bg-emerald-500/20 text-emerald-500 px-1 py-0.5 rounded font-mono text-xs">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Meta Template Library</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="border border-foreground/10 hover:bg-foreground/5 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
          >
            {seeding ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            Seed Zica Bella Templates
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.02] border-b border-foreground/10">
              <tr>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Name</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Category</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Language</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Status</th>
                <th className="text-right font-medium text-foreground/60 px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    No templates registered. Click "Seed Zica Bella Templates" or create a new one.
                  </td>
                </tr>
              ) : (
                templates.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-foreground/5 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-xs">{t.name}</td>
                    <td className="px-5 py-4 text-xs font-semibold uppercase text-muted-foreground">{t.category}</td>
                    <td className="px-5 py-4 text-xs">{t.language}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                        t.status === 'APPROVED' ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/10' :
                        t.status === 'PENDING' ? 'border-amber-500/20 text-amber-600 bg-amber-500/10' :
                        'border-rose-500/20 text-rose-600 bg-rose-500/10'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(t.name)}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 p-2 rounded-xl transition-all"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE TEMPLATE MODAL / DRAWER */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-foreground/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
          >
            {/* Form Side */}
            <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[90vh] md:max-h-none border-b md:border-b-0 md:border-r border-foreground/10">
              <div className="flex justify-between items-center pb-2 border-b border-foreground/10">
                <h3 className="font-semibold text-lg">Create Custom Template</h3>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Template Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. zb_spring_discount_alert"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Lowercase letters and underscores only. No spaces.</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    >
                      <option value="en_US">English (en_US)</option>
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="en_IN">English (India)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-foreground/5 pt-3">
                  <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Header Type</label>
                  <select
                    value={headerType}
                    onChange={(e) => setHeaderType(e.target.value)}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                  >
                    <option value="NONE">None</option>
                    <option value="TEXT">Text Header</option>
                    <option value="IMAGE">Image Media Header</option>
                  </select>
                </div>

                {headerType === "TEXT" && (
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Header Text</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. New Drop Live!"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    />
                  </div>
                )}

                {headerType === "IMAGE" && (
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Header Image Mock URL</label>
                    <input
                      type="text"
                      placeholder="e.g. https://zicabella.com/drop.jpg"
                      value={headerImage}
                      onChange={(e) => setHeaderImage(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5 flex justify-between">
                    <span>Body Text</span>
                    <span className="text-[10px] lowercase font-normal">Use {"{{1}}"}, {"{{2}}"} as variables</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Hi {{1}}, welcome to Zica Bella! Check out {{2}}."
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Footer Text (Optional)</label>
                  <input
                    type="text"
                    placeholder="Reply STOP to opt out"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-foreground/5 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Button Type</label>
                    <select
                      value={buttonType}
                      onChange={(e) => setButtonType(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    >
                      <option value="NONE">None</option>
                      <option value="URL">Call To Action URL Button</option>
                    </select>
                  </div>

                  {buttonType === "URL" && (
                    <div>
                      <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Button Label</label>
                      <input
                        type="text"
                        required
                        placeholder="Shop Now"
                        value={buttonText}
                        onChange={(e) => setButtonText(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                      />
                    </div>
                  )}
                </div>

                {buttonType === "URL" && (
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Button Base URL</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. https://zicabella.com/{{1}}"
                      value={buttonUrl}
                      onChange={(e) => setButtonUrl(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-foreground/5 text-foreground py-2.5 rounded-xl font-medium text-sm hover:bg-foreground/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-emerald-500 text-foreground py-2.5 rounded-xl font-medium text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : "Submit to Meta"}
                </button>
              </div>
            </form>

            {/* Preview Side */}
            <div className="hidden md:flex flex-1 flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-emerald-500/5 relative">
              <div className="text-xs text-muted-foreground absolute top-4 left-4 font-semibold uppercase tracking-wider">Device Preview</div>
              
              <div className="w-[260px] h-[480px] border-[6px] border-foreground/10 rounded-[2.5rem] relative bg-background shadow-2xl flex flex-col overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-4 bg-foreground/10 z-10 rounded-t-3xl" />
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-4 bg-background rounded-full z-20" />

                <div 
                  className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] pt-10 px-2.5 flex flex-col overflow-y-auto scrollbar-hide" 
                  style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover' }}
                >
                  <div className="text-center mb-3 bg-[#efeae2]/90 dark:bg-[#0b141a]/90 backdrop-blur-sm py-1.5 rounded-xl border border-foreground/5 shadow-sm">
                    <h3 className="text-[10px] font-semibold text-foreground">Zica Bella</h3>
                    <p className="text-[8px] text-emerald-500">Business Account</p>
                  </div>

                  <div className="space-y-1.5 self-end max-w-[85%] bg-background dark:bg-[#005c4b] text-foreground p-2 rounded-xl rounded-tr-sm shadow-md border border-foreground/5 text-xs">
                    {headerType === "IMAGE" && (
                      <div className="w-full h-24 bg-foreground/5 rounded-lg flex items-center justify-center overflow-hidden border border-foreground/10 mb-1">
                        {headerImage ? (
                          <img src={headerImage} alt="Header" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                        )}
                      </div>
                    )}
                    {headerType === "TEXT" && headerText && (
                      <div className="font-bold text-xs text-foreground/80 mb-1">{headerText}</div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">{renderPreview(bodyText)}</div>
                    {footerText && (
                      <div className="text-[9px] text-muted-foreground dark:text-foreground/50 mt-1 border-t border-foreground/5 pt-1">{footerText}</div>
                    )}
                    <div className="text-[8px] text-muted-foreground/60 text-right mt-1">12:00 PM</div>
                  </div>

                  {buttonType === "URL" && buttonText && (
                    <div className="mt-1.5 self-end w-[85%] bg-background dark:bg-zinc-800 text-blue-500 text-center py-2.5 rounded-xl shadow-sm text-xs font-semibold cursor-pointer border border-foreground/5 flex items-center justify-center gap-1.5 hover:bg-foreground/5">
                      <span>{buttonText}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   SECTION C: QUICK SEND SINGLE MESSAGE
   ========================================================================== */
function QuickSendMessage() {
  const [phone, setPhone] = useState("+917907914512");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [params, setParams] = useState<Record<string, string>>({});
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json();
      if (res.ok && data.templates) {
        setTemplates(data.templates);
        // Default select 'hello_world' if exists, otherwise first one
        const helloWorld = data.templates.find((t: any) => t.name === "hello_world");
        if (helloWorld) {
          setSelectedTemplate(helloWorld);
        } else if (data.templates.length > 0) {
          setSelectedTemplate(data.templates[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load templates in Quick Send", e);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Extract parameter variables from the selected template's BODY text (e.g. {{1}}, {{2}})
  const bodyText = selectedTemplate?.components?.find((c: any) => c.type === "BODY")?.text || "";
  const variables = bodyText.match(/\{\{\d\}\}/g) || [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error("Please enter a phone number");
      return;
    }
    if (!selectedTemplate) {
      toast.error("No template selected");
      return;
    }

    setLoading(true);
    setSendSuccess(null);
    setSendError(null);
    const toastId = toast.loading("Sending message...");

    // Build components parameters
    const components: any[] = [];
    if (variables.length > 0) {
      const bodyParams = variables.map((v: string) => {
        const num = v.replace(/[^0-9]/g, "");
        return {
          type: "text",
          text: params[num] || ""
        };
      });
      components.push({
        type: "body",
        parameters: bodyParams
      });
    }

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language || "en_US",
          components
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendSuccess(`Message sent! Message ID: ${data.messageId}`);
        toast.success(`Success! Message ID: ${data.messageId}`, { id: toastId });
        setParams({});
      } else {
        const errMsg = data.error || "Failed to send message.";
        setSendError(errMsg);
        toast.error(errMsg, { id: toastId });
      }
    } catch (e) {
      const errMsg = "Network error sending WhatsApp message.";
      setSendError(errMsg);
      toast.error(errMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass-card p-6 mt-4 space-y-6">
      <div>
        <h3 className="font-semibold text-lg font-mono">Send Test Message</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Send template notifications directly using Graph API v19.0</p>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Recipient Phone</label>
          <input
            type="text"
            required
            placeholder="e.g. +91 79079 14512"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Template Selector</label>
          {templatesLoading ? (
            <div className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Loading templates from Meta...</span>
            </div>
          ) : (
            <select
              value={selectedTemplate?.name || ""}
              onChange={(e) => {
                const found = templates.find(t => t.name === e.target.value);
                setSelectedTemplate(found || null);
                setParams({});
              }}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
            >
              {templates.length === 0 ? (
                <option value="">No templates registered</option>
              ) : (
                templates.map(t => (
                  <option key={t.id} value={t.name}>
                    {t.name} ({t.status})
                  </option>
                ))
              )}
            </select>
          )}

          {selectedTemplate && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                selectedTemplate.status === "APPROVED" ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/10" :
                selectedTemplate.status === "PENDING" ? "border-amber-500/20 text-amber-500 bg-amber-500/10" :
                "border-rose-500/20 text-rose-500 bg-rose-500/10"
              }`}>
                {selectedTemplate.status}
              </span>
            </div>
          )}
        </div>

        {selectedTemplate && bodyText && (
          <div className="bg-foreground/[0.02] border border-foreground/5 p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Template Preview</h4>
            <p className="text-sm font-mono bg-background/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-foreground/5 text-foreground/80">{bodyText}</p>
          </div>
        )}

        {selectedTemplate && variables.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-foreground/5">
            <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2">Template Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {variables.map((v: string) => {
                const num = v.replace(/[^0-9]/g, "");
                return (
                  <div key={num}>
                    <label className="text-xs text-muted-foreground block mb-1 font-mono">Variable {`{{${num}}}`}</label>
                    <input
                      type="text"
                      required
                      placeholder={`Enter value for {{${num}}}`}
                      value={params[num] || ""}
                      onChange={(e) => setParams(prev => ({ ...prev, [num]: e.target.value }))}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3.5 py-2 outline-none focus:border-emerald-500/50 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sendSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{sendSuccess}</span>
          </div>
        )}

        {sendError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="break-words leading-relaxed">{sendError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !selectedTemplate}
          className="w-full bg-emerald-500 text-foreground py-3 rounded-xl font-medium text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
        >
          {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Send Message</span>
        </button>
      </form>
    </div>
  );
}

/* ==========================================================================
   SECTION D: BROADCAST CAMPAIGNS TAB
   ========================================================================== */
function BroadcastCampaigns() {
  const [type, setType] = useState("sale_alert");
  const [recipientsText, setRecipientsText] = useState("");
  const [payload, setPayload] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ total: number; current: number } | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const campaignTemplates = [
    { id: "sale_alert", label: "Sale Alert", fields: ["discountPercent", "saleEndDate"] },
    { id: "new_collection", label: "New Collection Drop", fields: ["collectionName", "tagline", "imageUrl", "shopUrl"] },
    { id: "restock_alert", label: "Restock Alert", fields: ["productName", "size"] },
    { id: "welcome", label: "Welcome Subscriber", fields: [] },
    { id: "abandoned_cart", label: "Abandoned Cart Recovery", fields: ["itemCount", "cartTotal", "checkoutUrl"] },
  ];

  const currentTemplate = campaignTemplates.find(c => c.id === type);

  // Compute recipients list count
  const recipients = recipientsText
    .split("\n")
    .map(line => {
      const parts = line.split(",");
      const phone = parts[0]?.trim();
      const customerName = parts[1]?.trim() || "there";
      return { phone, customerName };
    })
    .filter(r => r.phone);

  const estimatedCost = (recipients.length * 0.58).toFixed(2);

  const loadFromDB = async () => {
    const toastId = toast.loading("Fetching opted-in users from database...");
    try {
      const res = await fetch("/api/whatsapp/recipients");
      const data = await res.json();
      if (res.ok && data.recipients) {
        const text = data.recipients.map((r: any) => `${r.phone}, ${r.customerName}`).join("\n");
        setRecipientsText(text);
        toast.success(`Loaded ${data.recipients.length} subscribers!`, { id: toastId });
      } else {
        toast.error(data.error || "Failed to load database recipients.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error loading recipients.", { id: toastId });
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      toast.error("No valid recipients loaded.");
      return;
    }

    setLoading(true);
    setSummary(null);
    setProgress({ total: recipients.length, current: 0 });

    try {
      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipients, payload })
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
        toast.success(`Broadcast finished! Sent: ${data.sent}, Failed: ${data.failed}`);
      } else {
        toast.error(data.error || "Broadcast campaign execution failed.");
      }
    } catch (e) {
      toast.error("Network error during broadcast campaign.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Configuration Form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold text-lg">New Campaign Blast</h3>
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Campaign Type</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPayload({}); }}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
            >
              {campaignTemplates.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {currentTemplate && currentTemplate.fields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-foreground/5">
              <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-1">Shared Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentTemplate.fields.map(field => (
                  <div key={field}>
                    <label className="text-xs text-muted-foreground block mb-1 font-mono">{field}</label>
                    <input
                      type="text"
                      required
                      placeholder={`Shared ${field}`}
                      value={payload[field] || ""}
                      onChange={(e) => setPayload((p: any) => ({ ...p, [field]: e.target.value }))}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3.5 py-2 outline-none focus:border-emerald-500/50 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-foreground/5 pt-3">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-foreground/60 uppercase">Recipients List</label>
              <button 
                type="button" 
                onClick={loadFromDB}
                className="text-xs text-emerald-500 font-medium flex items-center gap-1 hover:underline"
              >
                <Database className="w-3.5 h-3.5" />
                Load Opted-in from DB
              </button>
            </div>
            <textarea
              rows={6}
              placeholder="e.g. +919876543210, Priya&#10;+919988776655, Rahul"
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm font-mono text-xs resize-none"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">Paste phone numbers (one per line). Format: [phone], [name] (optional).</span>
          </div>

          {/* Pricing & Estimation banner */}
          <div className="bg-foreground/5 p-3 rounded-xl border border-foreground/10 flex justify-between items-center text-xs">
            <div className="text-muted-foreground">
              <span className="font-semibold text-foreground block">{recipients.length} recipients loaded</span>
              Est. Marketing cost: ₹0.58 / message
            </div>
            <div className="text-right text-sm font-bold text-foreground">
              ₹{estimatedCost} INR
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || recipients.length === 0}
            className="w-full bg-emerald-500 text-foreground py-3 rounded-xl font-medium text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Send Campaign Blast</span>
          </button>
        </form>
      </div>

      {/* Progress & Result Panel */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-lg mb-4">Execution Panel</h3>
          
          {loading && (
            <div className="space-y-4 py-10 flex flex-col items-center justify-center">
              <RefreshCcw className="w-10 h-10 animate-spin text-emerald-500 mb-2" />
              <div className="w-full bg-foreground/5 rounded-full h-2.5 overflow-hidden border border-foreground/10 max-w-sm">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progress ? progress.current / progress.total : 0) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">Processing broadcast queues...</span>
            </div>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-foreground/5 border border-foreground/10 p-3 rounded-xl">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Total</span>
                  <span className="text-xl font-bold">{summary.total}</span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <span className="text-emerald-500 text-[10px] uppercase font-bold block">Sent</span>
                  <span className="text-xl font-bold text-emerald-500">{summary.sent}</span>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                  <span className="text-rose-500 text-[10px] uppercase font-bold block">Failed</span>
                  <span className="text-xl font-bold text-rose-500">{summary.failed}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2">Detailed Results Log</h4>
                <div className="bg-foreground/5 border border-foreground/10 rounded-xl overflow-y-auto max-h-60 text-xs font-mono divide-y divide-foreground/10">
                  {summary.results?.map((res: any, i: number) => (
                    <div key={i} className="p-2.5 flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">{res.phone}</span>
                      {res.success ? (
                        <span className="text-emerald-500 font-semibold">Sent ({res.messageId})</span>
                      ) : (
                        <span className="text-rose-500 font-semibold" title={res.error}>Failed: {res.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !summary && (
            <div className="py-20 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
              <Send className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <span>Broadcast campaign output logs will display here.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SECTION E: ABANDONED CART RECOVERY
   ========================================================================== */
function CartRecovery() {
  const [carts, setCarts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBulkSending, setIsBulkSending] = useState(false);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopify/carts/abandoned");
      const data = await res.json();
      if (res.ok) {
        setCarts(data.carts || []);
      } else {
        toast.error("Failed to load abandoned carts.");
      }
    } catch (e) {
      toast.error("Network error fetching carts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, []);

  const handleSendRecovery = async (cart: any) => {
    const toastId = toast.loading(`Sending recovery to ${cart.customer}...`);
    try {
      const res = await fetch("/api/whatsapp/abandoned-cart/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cart.phone,
          billing_address: { first_name: cart.customer },
          total_price: cart.cart_value.replace(/[^0-9.]/g, ""), // extract float number
          abandoned_checkout_url: cart.abandoned_checkout_url,
          line_items: cart.items.split(",").map((i: string) => ({ title: i.trim() }))
        })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.skipped)) {
        toast.success(`Recovery message triggered successfully!`, { id: toastId });
        
        // Update local cart state to 'sent'
        setCarts(prev => prev.map(c => c.id === cart.id ? { ...c, status: "sent" } : c));
      } else {
        toast.error(data.error || "Recovery failed.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error triggering recovery.", { id: toastId });
    }
  };

  const handleSendAllPending = async () => {
    const pendingCarts = carts.filter(c => c.status === "pending");
    if (pendingCarts.length === 0) {
      toast.info("No pending carts to recover.");
      return;
    }

    if (!confirm(`Are you sure you want to recover ${pendingCarts.length} pending carts?`)) return;

    setIsBulkSending(true);
    const toastId = toast.loading(`Recovering ${pendingCarts.length} checkouts...`);
    
    let sentCount = 0;
    for (const cart of pendingCarts) {
      try {
        const res = await fetch("/api/whatsapp/abandoned-cart/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cart.phone,
            billing_address: { first_name: cart.customer },
            total_price: cart.cart_value.replace(/[^0-9.]/g, ""),
            abandoned_checkout_url: cart.abandoned_checkout_url,
            line_items: cart.items.split(",").map((i: string) => ({ title: i.trim() }))
          })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.skipped)) {
          sentCount++;
          // Update status in real time
          setCarts(prev => prev.map(c => c.id === cart.id ? { ...c, status: "sent" } : c));
        }
        // Small delay
        await new Promise(r => setTimeout(r, 80));
      } catch (e) {
        console.error("Bulk cart recovery error for cart id: " + cart.id);
      }
    }

    toast.success(`Bulk recovery completed! Sent: ${sentCount}`, { id: toastId });
    setIsBulkSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Abandoned Carts (Shopify)</h3>
        <button
          onClick={handleSendAllPending}
          disabled={loading || isBulkSending}
          className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          Send All Pending
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.02] border-b border-foreground/10">
              <tr>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Customer</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Phone</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Cart Value</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Items</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Abandoned At</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Status</th>
                <th className="text-right font-medium text-foreground/60 px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {carts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                    No recent abandoned checkouts found.
                  </td>
                </tr>
              ) : (
                carts.map((row) => (
                  <tr key={row.id} className="hover:bg-foreground/5 transition-colors">
                    <td className="px-5 py-4 font-medium">{row.customer}</td>
                    <td className="px-5 py-4 font-mono text-xs">{row.phone}</td>
                    <td className="px-5 py-4">{row.cart_value}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate" title={row.items}>{row.items}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(row.abandoned_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                        row.status === 'sent' ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/10' :
                        'border-amber-500/20 text-amber-600 bg-amber-500/10'
                      }`}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.status === 'pending' && (
                        <button 
                          onClick={() => handleSendRecovery(row)}
                          className="text-xs font-semibold bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-foreground transition-all"
                        >
                          Send Recovery
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   SECTION F: ORDER NOTIFICATIONS AUTOMATION
   ========================================================================== */
function OrderNotifications() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/whatsapp/settings");
        const data = await res.json();
        if (res.ok) {
          setSettings(data.settings || {});
        }
      } catch (err) {
        toast.error("Failed to load automation settings.");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleToggle = async (key: string) => {
    const nextVal = !settings[key];
    setSettings((s: any) => ({ ...s, [key]: nextVal }));

    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextVal })
      });
      if (res.ok) {
        toast.success("Settings updated successfully!");
      } else {
        toast.error("Failed to save changes.");
        // revert state
        setSettings((s: any) => ({ ...s, [key]: !nextVal }));
      }
    } catch (e) {
      toast.error("Network error saving settings.");
      // revert state
      setSettings((s: any) => ({ ...s, [key]: !nextVal }));
    }
  };

  const automations = [
    { key: "order_confirmed", title: "Order Confirmation", desc: "Auto-send on Shopify order creation (orders/create webhook)." },
    { key: "order_status", title: "Order Status Update", desc: "Auto-send on order state alterations (orders/updated webhook)." },
    { key: "order_shipped", title: "Order Shipped", desc: "Auto-send on order fulfillment containing courier tracking (orders/fulfilled webhook)." },
    { key: "out_for_delivery", title: "Out for Delivery", desc: "Auto-send when carrier status marks package as out for delivery." },
    { key: "order_delivered", title: "Delivered Confirmation", desc: "Auto-send notification validating package drop-off." },
    { key: "return_confirmed", title: "Return Request Confirmed", desc: "Auto-send receipt validation containing credit processing status." }
  ];

  return (
    <div className="max-w-3xl mx-auto glass-card p-6 mt-4">
      <h3 className="font-semibold text-lg mb-2">Automated Notifications</h3>
      <p className="text-xs text-muted-foreground border-b border-foreground/5 pb-4 mb-4">
        Toggle automated transactional notifications triggered by Shopify actions or inventory flows.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCcw className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map((a) => (
            <div key={a.key} className="flex justify-between items-center gap-4 p-3 rounded-xl hover:bg-foreground/5 transition-all">
              <div>
                <h4 className="text-sm font-semibold">{a.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
              </div>
              <button 
                onClick={() => handleToggle(a.key)}
                className="text-emerald-500 hover:opacity-90 transition-opacity"
              >
                {settings[a.key] ? (
                  <ToggleRight className="w-12 h-8 text-emerald-500 cursor-pointer" />
                ) : (
                  <ToggleLeft className="w-12 h-8 text-muted-foreground cursor-pointer" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   SECTION G: MESSAGE LOGS TAB
   ========================================================================== */
function MessageLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/logs?page=${page}&limit=10&type=${typeFilter}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (e) {
      toast.error("Failed to query transaction logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, typeFilter]);

  const totalPages = Math.ceil(totalCount / 10) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Message Logs</h3>
        
        {/* Filters */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-1.5 outline-none focus:border-emerald-500/50 text-xs"
        >
          <option value="">All Message Types</option>
          <option value="welcome">Welcome</option>
          <option value="order_confirmed">Order Confirmed</option>
          <option value="order_status">Order Status</option>
          <option value="order_shipped">Shipped</option>
          <option value="abandoned_cart">Abandoned Cart</option>
          <option value="sale_alert">Sale Alert</option>
          <option value="new_collection">New Collection</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.02] border-b border-foreground/10">
              <tr>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Recipient</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Type</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Template</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Status</th>
                <th className="text-left font-medium text-foreground/60 px-5 py-3.5">Sent At</th>
                <th className="text-right font-medium text-foreground/60 px-5 py-3.5">Message ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    No logs recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-foreground/5 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs">{log.recipient_phone}</td>
                    <td className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase">{log.message_type}</td>
                    <td className="px-5 py-4 font-mono text-xs">{log.template_name}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        log.status === 'read' ? 'border-blue-500/20 text-blue-500 bg-blue-500/10' :
                        log.status === 'delivered' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10' :
                        log.status === 'failed' ? 'border-rose-500/20 text-rose-500 bg-rose-500/10' :
                        'border-amber-500/20 text-amber-500 bg-amber-500/10'
                      }`}>
                        {log.status?.toUpperCase() || 'SENT'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs text-muted-foreground">{log.message_id || "N/A"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-foreground/10">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p: number) => p - 1)}
                  className="px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p: number) => p + 1)}
                  className="px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   COD OPERATIONS (PRISTINE KEEP)
   ========================================================================== */
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
