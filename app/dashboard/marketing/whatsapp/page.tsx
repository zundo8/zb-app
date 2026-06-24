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
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1 font-mono justify-end">
              <span>Sender: <strong className="text-foreground">{statusData.phone}</strong></span>
              <span>WABA ID: <strong className="text-foreground">{statusData.wabaId}</strong></span>
              <span>Phone ID: <strong className="text-foreground">{statusData.phoneId}</strong></span>
              <span>Quality: <strong className={statusData.quality === 'GREEN' || statusData.quality === 'HIGH' ? 'text-emerald-500' : 'text-amber-500'}>{statusData.quality}</strong></span>
              <span>Tier: <strong className="text-foreground">{statusData.tier}</strong></span>
              <span>Webhook: <strong className={statusData.webhookSubscribed ? "text-emerald-500" : "text-rose-500"}>{statusData.webhookSubscribed ? "Active" : "Not Active"}</strong></span>
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
  const [testingTemplate, setTestingTemplate] = useState(false);
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

  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("ALL");

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

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesCategory = templateCategoryFilter === "ALL" || t.category === templateCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleTestTemplate = async () => {
    setTestingTemplate(true);
    const toastId = toast.loading("Running WABA Integration test...");
    
    const testPayload = {
      name: "zb_test_template",
      category: "MARKETING",
      language: "en_US",
      components: [
        {
          type: "BODY",
          text: "Hello from Zica Bella."
        }
      ]
    };

    try {
      // Attempt deletion first to prevent "content already exists" error
      await fetch("/api/whatsapp/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "zb_test_template" })
      }).catch(() => {});

      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload)
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("WABA Integration Test Succeeded! Test template submitted successfully.", { id: toastId });
        fetchTemplates();
      } else {
        if (data.code || data.subcode) {
          const errorMsg = (
            <div className="space-y-1 text-xs">
              <div className="font-bold text-red-500">WABA Integration Test Failed:</div>
              <div>{data.error}</div>
              <div className="text-[10px] text-foreground/60 mt-1">
                <div>Error Code: {data.code}</div>
                <div>Subcode: {data.subcode}</div>
              </div>
            </div>
          );
          toast.error(errorMsg, { id: toastId, duration: 10000 });
        } else {
          toast.error(data.error || "WABA Integration Test Failed.", { id: toastId });
        }
      }
    } catch (e) {
      toast.error("Network error during WABA Integration test.", { id: toastId });
    } finally {
      setTestingTemplate(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    const toastId = toast.loading("Submitting templates to Meta...");
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

  const getPayloadJson = () => {
    const componentsList: any[] = [];
    if (headerType === "TEXT" && headerText) {
      componentsList.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText
      });
    } else if (headerType === "IMAGE") {
      componentsList.push({
        type: "HEADER",
        format: "IMAGE"
      });
    }

    componentsList.push({
      type: "BODY",
      text: bodyText
    });

    if (footerText) {
      componentsList.push({
        type: "FOOTER",
        text: footerText
      });
    }

    if (buttonType === "URL" && buttonText && buttonUrl) {
      componentsList.push({
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

    return {
      name: name || "template_name",
      category,
      language,
      components: componentsList
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const componentsPayload = getPayloadJson().components;

    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, language, components: componentsPayload })
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
        if (data.code || data.subcode) {
          const errorMsg = (
            <div className="space-y-1 text-xs">
              <div className="font-bold text-red-500">Meta Error:</div>
              <div>{data.error}</div>
              <div className="text-[10px] text-foreground/60 mt-1">
                <div>Error Code: {data.code}</div>
                <div>Subcode: {data.subcode}</div>
              </div>
            </div>
          );
          toast.error(errorMsg, { duration: 10000 });
        } else {
          toast.error(data.error || "Failed to create template.");
        }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Meta Template Library</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestTemplate}
            disabled={testingTemplate}
            className="border border-foreground/10 hover:bg-foreground/5 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
          >
            {testingTemplate ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
            Test WABA Integration
          </button>
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

      {/* Search & Category Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-foreground/5 p-4 rounded-xl border border-foreground/10">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates by name..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="w-full bg-background/5 border border-foreground/10 rounded-lg pl-9 pr-4 py-2 outline-none focus:border-emerald-500/50 text-xs text-foreground"
          />
        </div>
        <div>
          <select
            value={templateCategoryFilter}
            onChange={(e) => setTemplateCategoryFilter(e.target.value)}
            className="w-full bg-background/5 border border-foreground/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 text-xs text-foreground"
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
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
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    No matching templates registered. Click &quot;Seed Zica Bella Templates&quot; or create a new one.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((t, idx) => (
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
            <div className="hidden md:flex flex-1 flex-col items-center justify-between p-6 bg-gradient-to-br from-background to-emerald-500/5 relative overflow-y-auto max-h-[90vh] scrollbar-hide">
              <div className="text-xs text-muted-foreground self-start font-semibold uppercase tracking-wider mb-2">Device Preview</div>
              
              <div className="w-[260px] h-[280px] border-[6px] border-foreground/10 rounded-[2rem] relative bg-background shadow-2xl flex flex-col overflow-hidden">
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

              {/* Template Payload Preview Inspector */}
              <div className="w-full mt-4 flex flex-col min-h-[160px] max-h-[220px]">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-semibold mb-1">
                  <span>Template Payload Preview</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(getPayloadJson(), null, 2));
                      toast.success("Payload copied to clipboard!");
                    }}
                    className="text-emerald-500 hover:text-emerald-400 font-bold lowercase flex items-center gap-1"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="flex-1 bg-zinc-950 border border-foreground/10 text-zinc-300 p-2.5 rounded-xl font-mono text-[9px] overflow-auto select-all scrollbar-hide">
                  {JSON.stringify(getPayloadJson(), null, 2)}
                </pre>
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
  const [campaignName, setCampaignName] = useState("");
  const [audience, setAudience] = useState("all_customers");
  const [scheduledAt, setScheduledAt] = useState("");
  
  // Historical campaigns list
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

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

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/whatsapp/campaigns");
      const data = await res.json();
      if (res.ok && data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error("Error loading campaigns:", err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Poll active sending campaigns
  useEffect(() => {
    const hasActiveCampaign = campaigns.some(c => c.status === "sending" || c.status === "queued");
    if (!hasActiveCampaign) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/campaigns");
        const data = await res.json();
        if (res.ok && data.campaigns) {
          setCampaigns(data.campaigns);
        }
      } catch (err) {
        console.error("Polling campaigns failed:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [campaigns]);

  // Load audience from DB
  const loadSegment = async (selectedAudience: string) => {
    const toastId = toast.loading(`Loading audience segment: ${selectedAudience}...`);
    try {
      const res = await fetch(`/api/whatsapp/recipients?audience=${selectedAudience}`);
      const data = await res.json();
      if (res.ok && data.recipients) {
        const text = data.recipients.map((r: any) => `${r.phone}, ${r.customerName}`).join("\n");
        setRecipientsText(text);
        toast.success(`Loaded ${data.recipients.length} opted-in subscribers!`, { id: toastId });
      } else {
        toast.error(data.error || "Failed to load database recipients.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error loading recipients.", { id: toastId });
    }
  };

  // CSV parsing
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      
      const parsed = lines.map(line => {
        const parts = line.split(",");
        const phone = parts[0]?.trim() || '';
        const name = parts[1]?.trim() || '';
        return phone ? `${phone}${name ? ',' + name : ''}` : '';
      }).filter(Boolean).join("\n");

      setRecipientsText(parsed);
      setAudience("custom_csv");
      toast.success(`Successfully loaded ${lines.length} rows from CSV file!`);
    };
    reader.readAsText(file);
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
    const toastId = toast.loading("Queuing broadcast campaign...");

    try {
      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          recipients,
          payload,
          name: campaignName || undefined,
          scheduledAt: scheduledAt || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Broadcast successfully queued in background!", { id: toastId });
        setRecipientsText("");
        setCampaignName("");
        setScheduledAt("");
        fetchCampaigns();
      } else {
        toast.error(data.error || "Broadcast campaign execution failed.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error during broadcast campaign.", { id: toastId });
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
            <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Campaign Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Summer Clearance Blast"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Campaign Template</label>
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

          <div className="border-t border-foreground/5 pt-3 space-y-3">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <label className="text-xs font-semibold text-foreground/60 uppercase">Target Audience</label>
              
              <div className="flex items-center gap-2">
                <select
                  value={audience}
                  onChange={(e) => {
                    setAudience(e.target.value);
                    if (e.target.value !== "custom_csv") {
                      loadSegment(e.target.value);
                    }
                  }}
                  className="bg-foreground/5 border border-foreground/10 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-foreground/30 text-foreground"
                >
                  <option value="all_customers">All Opted-In Customers</option>
                  <option value="new_customers">New Customers (Signups)</option>
                  <option value="returning_customers">Returning Customers</option>
                  <option value="high_value_customers">High-Value Customers</option>
                  <option value="wishlist_customers">Wishlist Customers</option>
                  <option value="cart_abandonment">Cart Abandonment Customers</option>
                  <option value="custom_csv">Upload Custom CSV File</option>
                </select>

                {audience === "custom_csv" && (
                  <label className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border border-emerald-500/20">
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            
            <textarea
              rows={5}
              required
              placeholder="e.g. +919876543210, Priya&#10;+919988776655, Rahul"
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm font-mono text-xs resize-none"
            />
            <span className="text-[10px] text-muted-foreground block">Format: [phone], [name] (one per line). Empty numbers are ignored. Only opted-in numbers are allowed.</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground/60 uppercase block mb-1.5">Schedule Campaign (Optional)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm text-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to send immediately, or pick a future time to schedule.</p>
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

      {/* Progress & Campaign History Panel */}
      <div className="glass-card p-6 flex flex-col justify-between h-[600px] overflow-hidden">
        <div className="space-y-4 flex flex-col h-full">
          <h3 className="font-semibold text-lg">Campaign Dashboard</h3>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            {loadingCampaigns ? (
              <div className="flex justify-center py-20">
                <RefreshCcw className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
                <Send className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <span>No campaign blasts found. Start one above.</span>
              </div>
            ) : (
              campaigns.map((c) => {
                const total = c.statsSent + c.statsFailed;
                const progressVal = total > 0 ? (c.statsSent / total) * 100 : 0;
                
                return (
                  <div key={c.id} className="bg-foreground/5 border border-foreground/10 rounded-xl p-4.5 space-y-3 hover:bg-foreground/[0.08] transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{c.name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">Template: {c.templateName}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        c.status === "completed" ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/10" :
                        c.status === "sending" ? "border-blue-500/20 text-blue-500 bg-blue-500/10 animate-pulse" :
                        c.status === "scheduled" ? "border-amber-500/20 text-amber-500 bg-amber-500/10" :
                        "border-rose-500/20 text-rose-500 bg-rose-500/10"
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-muted-foreground">
                      <div className="bg-background/40 p-1.5 rounded-lg border border-foreground/5">
                        <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Sent</span>
                        <strong className="text-foreground text-xs">{c.statsSent}</strong>
                      </div>
                      <div className="bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                        <span className="block text-[8px] uppercase tracking-wider text-emerald-500/60 mb-0.5">Delivered</span>
                        <strong className="text-emerald-500 text-xs">{c.statsDelivered}</strong>
                      </div>
                      <div className="bg-blue-500/5 p-1.5 rounded-lg border border-blue-500/10">
                        <span className="block text-[8px] uppercase tracking-wider text-blue-500/60 mb-0.5">Read</span>
                        <strong className="text-blue-500 text-xs">{c.statsRead}</strong>
                      </div>
                      <div className="bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10">
                        <span className="block text-[8px] uppercase tracking-wider text-rose-500/60 mb-0.5">Failed</span>
                        <strong className="text-rose-500 text-xs">{c.statsFailed}</strong>
                      </div>
                    </div>

                    {/* Progress Bar for active campaign */}
                    {(c.status === "sending" || c.status === "queued") && (
                      <div className="space-y-1">
                        <div className="w-full bg-foreground/5 rounded-full h-1.5 overflow-hidden border border-foreground/5">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressVal}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-muted-foreground">
                          <span>Progress: {Math.round(progressVal)}%</span>
                          <span>{c.statsSent} sent</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-[9px] text-muted-foreground flex justify-between items-center mt-1">
                      {c.scheduledAt ? (
                        <span className="text-amber-500 font-semibold font-mono">
                          Scheduled: {new Date(c.scheduledAt).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span>Immediate</span>
                      )}
                      <span>
                        Created: {new Date(c.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/whatsapp/abandoned-cart/stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load cart recovery stats:", e);
    }
  };

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
    fetchStats();
  }, []);

  const handleSendRecovery = async (cart: any) => {
    const toastId = toast.loading(`Sending recovery to ${cart.customer}...`);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "abandoned_cart",
          to: cart.phone,
          payload: {
            phone: cart.phone,
            customerName: cart.customer,
            checkoutUrl: cart.abandoned_checkout_url
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Recovery message triggered successfully!`, { id: toastId });
        
        // Update local cart state to 'sent'
        setCarts(prev => prev.map(c => c.id === cart.id ? { ...c, status: "sent" } : c));
        fetchStats();
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
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "abandoned_cart",
            to: cart.phone,
            payload: {
              phone: cart.phone,
              customerName: cart.customer,
              checkoutUrl: cart.abandoned_checkout_url
            }
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
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
    fetchStats();
  };

  return (
    <div className="space-y-6">
      {/* Recovery stats cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase block mb-1">Recovered Revenue</span>
          <span className="text-2xl font-bold tracking-tight text-emerald-500">
            ₹{(stats?.recoveredRevenue || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="glass-card p-5">
          <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase block mb-1">Recovered Orders</span>
          <span className="text-2xl font-bold tracking-tight">
            {stats?.recoveredOrders || 0}
          </span>
        </div>
        <div className="glass-card p-5">
          <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase block mb-1">Recovery Rate</span>
          <span className="text-2xl font-bold tracking-tight text-blue-500">
            {stats?.recoveryRate || 0}%
          </span>
        </div>
        <div className="glass-card p-5">
          <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase block mb-1">Recoveries Sent</span>
          <span className="text-2xl font-bold tracking-tight text-muted-foreground">
            {stats?.totalSent || 0}
          </span>
        </div>
      </div>

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

function CODOperations() {
  const [stats, setStats] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/cod/stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats || []);
        setVerifications(data.verifications || []);
      }
    } catch (err) {
      toast.error("Failed to load COD verification metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResend = async (orderId: string) => {
    const toastId = toast.loading("Resending COD verification...");
    try {
      const res = await fetch("/api/orders/cod-confirm-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Verification template sent successfully!", { id: toastId });
        fetchData();
      } else {
        toast.error(data.error || "Failed to resend verification.", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error resending verification.", { id: toastId });
    }
  };

  // Filter verifications by search query
  const filteredVerifications = verifications.filter(v =>
    v.shopifyOrderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (label: string) => {
    if (label === "Confirmed Today") return CheckCircle2;
    if (label === "Avg Response Time") return BarChart3;
    return AlertCircle;
  };

  return (
    <div className="space-y-6">
      {loading && stats.length === 0 ? (
        <div className="flex justify-center py-20">
          <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => {
              const Icon = getIcon(s.label);
              return (
                <div key={i} className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`w-4 h-4 ${s.color || 'text-muted-foreground'}`} />
                    <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">{s.label}</span>
                  </div>
                  <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                </div>
              );
            })}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-foreground/10 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent COD Verifications</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input 
                  type="text" 
                  placeholder="Search orders..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                {filteredVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      No COD verifications found.
                    </td>
                  </tr>
                ) : (
                  filteredVerifications.map((row) => (
                    <tr key={row.id} className="hover:bg-foreground/5 transition-colors">
                      <td className="px-5 py-4 font-medium">#{row.shopifyOrderId}</td>
                      <td className="px-5 py-4 text-foreground/80">{row.customerName}</td>
                      <td className="px-5 py-4">{row.amount}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold ${
                          row.riskScore > 70 ? 'bg-rose-500/10 text-rose-500' :
                          row.riskScore > 30 ? 'bg-amber-500/10 text-amber-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {row.riskScore}/100
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          row.status === 'confirmed' ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/10' :
                          row.status === 'cancelled' || row.status === 'cancelled_by_customer' ? 'border-rose-500/20 text-rose-600 bg-rose-500/10' :
                          'border-amber-500/20 text-amber-600 bg-amber-500/10'
                        }`}>
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {row.status === 'pending' && (
                          <button 
                            onClick={() => handleResend(row.id)}
                            className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-all hover:underline"
                          >
                            Resend WhatsApp
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
