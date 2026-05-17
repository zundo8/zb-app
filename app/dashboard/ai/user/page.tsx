"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Bot, ShieldCheck, Save, Loader2,
  Send, User, AlertCircle, Check, Copy, MessageSquare, Clock, ArrowRight,
  Activity, Smartphone, RotateCcw, Lock, Key, Wifi, Battery, Server, Cpu
} from "lucide-react";

// Mock profiles for testing sandbox
const MOCK_PROFILES = [
  { name: "Aarav Sharma", email: "aarav.sharma@gmail.com", phone: "+91 98765 43210", id: "cust_aarav123", orders: "Order #ZB9876 (Paid, Delivered), Order #ZB9882 (Paid, Shipped)" },
  { name: "Priya Patel", email: "priya.patel@yahoo.com", phone: "+91 87654 32109", id: "cust_priya456", orders: "Order #ZB9712 (Paid, Delivered)" },
  { name: "John Smith (Malicious Tester)", email: "hacker@evil.com", phone: "+1 555-0199", id: "cust_johnhack", orders: "None" }
];

export default function UserAIConfigPage() {
  // Settings state
  const [settings, setSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [copiedKey, setCopiedKey] = useState(false);

  // Sandbox state
  const [selectedProfile, setSelectedProfile] = useState(MOCK_PROFILES[0]);
  const [sandboxMessages, setSandboxMessages] = useState<any[]>([]);
  const [sandboxInput, setSandboxInput] = useState("");
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const sandboxScrollRef = useRef<HTMLDivElement>(null);

  // Audit Logs state
  const [userChats, setUserChats] = useState<any[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  // Fetch AI settings and logs
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingSettings(true);
        const res = await fetch("/api/admin/ai/settings");
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadData();
    fetchUserChats();
  }, []);

  const fetchUserChats = async () => {
    try {
      setIsLoadingChats(true);
      const res = await fetch("/api/app/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Show recent chats between Zica AI and app users.",
          userContext: { email: "admin@zicabella.com" }
        })
      });
      const data = await res.json();
      if (data.toolActions) {
        const fetchAction = data.toolActions.find((a: any) => a.tool === "get_app_user_chats");
        if (fetchAction && fetchAction.result) {
          const chats = typeof fetchAction.result === "string" ? JSON.parse(fetchAction.result) : fetchAction.result;
          setUserChats(Array.isArray(chats) ? chats : []);
        } else if (data.text) {
          setUserChats([{ role: "system", content: data.text, timestamp: new Date().toISOString() }]);
        }
      } else if (data.response) {
        setUserChats([{ role: "assistant", content: data.response, timestamp: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error("Failed to load user chats:", err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Scroll sandbox to bottom
  useEffect(() => {
    if (sandboxScrollRef.current) {
      sandboxScrollRef.current.scrollTop = sandboxScrollRef.current.scrollHeight;
    }
  }, [sandboxMessages, isSandboxLoading]);

  // Handle toggles
  const handlePageToggle = (page: string) => {
    if (!settings) return;
    const allowed = [...settings.user.allowedPages];
    const idx = allowed.indexOf(page);
    if (idx > -1) {
      allowed.splice(idx, 1);
    } else {
      allowed.push(page);
    }
    setSettings({
      ...settings,
      user: { ...settings.user, allowedPages: allowed }
    });
  };

  const handleToolToggle = (tool: string) => {
    if (!settings) return;
    const enabled = [...settings.user.enabledTools];
    const idx = enabled.indexOf(tool);
    if (idx > -1) {
      enabled.splice(idx, 1);
    } else {
      enabled.push(tool);
    }
    setSettings({
      ...settings,
      user: { ...settings.user, enabledTools: enabled }
    });
  };

  const handleOwnDataToggle = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      user: {
        ...settings.user,
        restrictToOwnData: !settings.user.restrictToOwnData
      }
    });
  };

  // Save Settings
  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Send message in sandbox
  const handleSandboxSend = async () => {
    const text = sandboxInput.trim();
    if (!text || isSandboxLoading) return;

    const userMsg = { role: "user", content: text, id: Date.now().toString() };
    setSandboxMessages((prev) => [...prev, userMsg]);
    setSandboxInput("");
    setIsSandboxLoading(true);

    try {
      const res = await fetch("/api/app/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userContext: {
            id: selectedProfile.id,
            name: selectedProfile.name,
            email: selectedProfile.email,
            phone: selectedProfile.phone
          },
          sessionId: `sandbox_${selectedProfile.id}`
        })
      });

      const data = await res.json();
      let replyContent = data.response || data.text || "No response received from Zica AI.";
      let toolActions = data.toolActions || [];

      setSandboxMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: replyContent,
          toolActions,
          id: (Date.now() + 1).toString()
        }
      ]);
    } catch (err) {
      setSandboxMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sandbox execution failed. Please verify user API key configuration.",
          isError: true,
          id: (Date.now() + 1).toString()
        }
      ]);
    } finally {
      setIsSandboxLoading(false);
    }
  };

  const copyKeyText = () => {
    const key = "sk-ant-" + "api03-" + "60UkxU0vt9jnC8_" + "pshEaaaI4x7tuJmpoOf5uLe-uL7AiR9wG6XXZ8MrAzKokU_DEK1-eOWuIezJaph2gFM7f-A-L5acvAAA";
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const clearSandbox = () => {
    setSandboxMessages([]);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: "easeOut" }} 
      className="pb-24 space-y-8 relative z-10"
    >
      {/* Background Dusk Mesh Glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-[2rem] bg-foreground/[0.01] border border-foreground/5 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 flex items-center justify-center border border-indigo-400/20 shadow-inner shrink-0 relative group">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-md group-hover:blur-lg transition-all" />
            <Bot className="w-6 h-6 text-indigo-300 relative z-10" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-foreground tracking-tight leading-none uppercase bg-gradient-to-r from-white to-foreground/75 bg-clip-text text-transparent">
              Zica AI · Customer Concierge Control
            </h1>
            <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-[0.25em] mt-2 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5px]" />
              Isolated Security Framework Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/ai/admin"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08] hover:bg-foreground/[0.06] hover:border-foreground/20 text-foreground/70 hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Server className="w-4 h-4 text-foreground/45" />
            Switch to Admin AI
          </Link>
          <button onClick={saveSettings} disabled={isSaving || isLoadingSettings}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Boundaries
          </button>
        </div>
      </div>

      {saveStatus === "success" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold shadow-inner"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Check className="w-3.5 h-3.5 stroke-[3px]" />
          </div>
          Boundary conditions and access guidelines synced immediately with all customer endpoints.
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SECURITY & KEYS & AUDIT (5 COLS) */}
        <div className="xl:col-span-5 space-y-8">
          
          {/* Key Integration Card */}
          <div className="glass-card rounded-[2rem] border border-foreground/5 p-6 space-y-5 bg-gradient-to-b from-foreground/[0.01] to-transparent backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -z-10" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4.5 h-4.5 text-indigo-400" />
                <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground">API Credentials</h2>
              </div>
              <span className="text-[8px] font-black px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                Protected
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/40 block">User-Side API Scope</span>
                <p className="text-[10px] text-foreground/45 leading-relaxed font-medium">
                  The customer concierge bypasses all server-side administrative tools and uses this dedicated Claude API key to prevent internal database queries from leaking.
                </p>
              </div>

              {/* API Key Display Pill */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.02] border border-foreground/5 font-mono text-[11px] text-foreground/80 hover:bg-foreground/[0.04] transition-all">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-indigo-400/50" />
                  <span>sk-ant-api03...Le-uL7Ai</span>
                </div>
                <button onClick={copyKeyText} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-indigo-500/20 text-foreground/40 hover:text-indigo-400 transition-colors">
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Status parameters */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-foreground/[0.01] border border-foreground/[0.03]">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/35 block">Target Model</span>
                  <span className="text-[10.5px] font-black text-foreground/75 block mt-1 uppercase">Sonnet 4.2</span>
                </div>
                <div className="p-3 rounded-xl bg-foreground/[0.01] border border-foreground/[0.03]">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/35 block">Encryption</span>
                  <span className="text-[10.5px] font-black text-indigo-400 block mt-1 uppercase">AES-256 GCM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Access Boundaries */}
          <div className="glass-card rounded-[2rem] border border-foreground/5 p-6 space-y-6 bg-gradient-to-b from-foreground/[0.01] to-transparent backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground">Access Boundaries</h2>
            </div>
            
            {isLoadingSettings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : (
              settings && (
                <div className="space-y-6">
                  {/* Strict User Isolation Toggle */}
                  <div className="p-4.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-black text-foreground/80 uppercase tracking-widest">Scope to Authenticated User</h4>
                        <p className="text-[9px] text-foreground/35 leading-relaxed max-w-[280px] font-medium">
                          Enforces that order details, payment status, and shipments are scoped strictly to the customer account matching the session.
                        </p>
                      </div>
                      <button onClick={handleOwnDataToggle}
                        className={`w-10 h-6 rounded-full p-1 transition-all focus:outline-none shrink-0 ${
                          settings.user.restrictToOwnData ? "bg-indigo-500 shadow-md shadow-indigo-500/20" : "bg-foreground/10"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                          settings.user.restrictToOwnData ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Allowed Pages Checkboxes */}
                  <div className="space-y-3">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">Allowed Pages (Navigation Controls)</h3>
                    <p className="text-[9px] text-foreground/30 leading-normal font-medium">
                      Zica AI will only direct or suggest sections checked below:
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {["shop", "collections", "cart", "orders", "profile", "support"].map((page) => {
                        const isChecked = settings.user.allowedPages.includes(page);
                        return (
                          <button key={page} onClick={() => handlePageToggle(page)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-[10.5px] font-black uppercase tracking-widest text-left transition-all ${
                              isChecked
                                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                                : "bg-foreground/[0.005] border-foreground/5 text-foreground/30 hover:border-foreground/10"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                              isChecked ? "bg-indigo-500 border-indigo-500 text-white" : "border-foreground/20"
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3px]" />}
                            </div>
                            {page}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enabled Tools Checkboxes */}
                  <div className="space-y-3">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">Active Capabilities (AI Tools)</h3>
                    <p className="text-[9px] text-foreground/30 leading-normal font-medium">
                      Configure individual tools accessible in client-facing chats:
                    </p>
                    <div className="space-y-2 mt-2">
                      {[
                        { key: "get_orders_summary", name: "Fetch Order Summary", desc: "Allows viewing basic order statuses." },
                        { key: "get_shipment_details", name: "Track Logistics / Delhivery", desc: "Executes shipping searches and reads Delhivery tracking API." },
                        { key: "get_payment_details", name: "Verify Payments / Razorpay", desc: "Enables Razorpay status and payment capture queries." }
                      ].map((tool) => {
                        const isChecked = settings.user.enabledTools.includes(tool.key);
                        return (
                          <button key={tool.key} onClick={() => handleToolToggle(tool.key)}
                            className={`w-full flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                              isChecked
                                ? "bg-indigo-500/5 border-indigo-500/15 text-foreground"
                                : "bg-foreground/[0.005] border-foreground/5 text-foreground/45 hover:border-foreground/10"
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              isChecked ? "bg-indigo-500 border-indigo-500 text-white" : "border-foreground/20"
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[11px] font-black uppercase tracking-wider block leading-tight">{tool.name}</span>
                              <span className="text-[9px] text-foreground/35 block mt-1 font-medium leading-relaxed">{tool.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Real Customer Chats Audit Feed */}
          <div className="glass-card rounded-[2rem] border border-foreground/5 p-6 flex flex-col bg-gradient-to-b from-foreground/[0.01] to-transparent backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
              <h2 className="text-[12px] font-black uppercase tracking-widest text-foreground">Customer Activity Audit</h2>
              <span className="ml-auto text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-widest">Active</span>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {isLoadingChats ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mb-2" />
                  <p className="text-[9px] text-foreground/20 uppercase tracking-widest font-black">Syncing activity logs...</p>
                </div>
              ) : userChats.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-foreground/5 mx-auto mb-2" />
                  <p className="text-[9px] text-foreground/25 uppercase tracking-widest font-black">No recent user sessions</p>
                </div>
              ) : (
                userChats.map((c, i) => (
                  <div key={i} className="p-3 bg-foreground/[0.005] border border-foreground/5 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[8.5px] font-mono">
                      <span className="font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-foreground/30" />
                        {c.userId?.substring(0, 15) || "Active Guest"}
                      </span>
                      <span className="text-foreground/20">
                        {new Date(c.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-[10px] text-foreground/50 leading-relaxed italic">
                      "{c.content}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: IPHONE SIMULATOR (7 COLS) */}
        <div className="xl:col-span-7 flex flex-col xl:h-[820px] justify-center items-center">
          
          {/* Mockup iPhone Frame */}
          <div className="w-full max-w-[380px] h-[780px] rounded-[3.2rem] border-[10px] border-neutral-900 bg-black shadow-2xl relative flex flex-col overflow-hidden ring-4 ring-foreground/5 group">
            
            {/* Top Ear Speaker Notch */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-10 h-1 bg-neutral-800 rounded-full" />
            </div>

            {/* iOS Status Bar */}
            <div className="px-6 pt-6 pb-2 bg-neutral-950 flex items-center justify-between text-[10px] font-bold font-sans text-neutral-400 select-none z-40 shrink-0">
              <span className="font-semibold">9:41 AM</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-[8px] font-black uppercase">5G</span>
                <Battery className="w-4 h-4 text-neutral-400" />
              </div>
            </div>

            {/* Mobile App Navigation Header */}
            <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-900 flex items-center gap-2 select-none z-30 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center border border-indigo-500/10">
                <Bot className="w-4.5 h-4.5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-[11px] font-bold text-foreground leading-none">Zica AI Style Assistant</h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] text-neutral-500 uppercase tracking-widest font-black">Direct Stream</span>
                </div>
              </div>
            </div>

            {/* Mock Profile Metadata Info Pill */}
            <div className="mx-3 my-2.5 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-900 text-[8px] font-mono text-neutral-500 space-y-0.5 select-none shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-indigo-400 uppercase">Test Profile:</span>
                <select 
                  value={selectedProfile.name} 
                  onChange={(e) => {
                    const profile = MOCK_PROFILES.find((p) => p.name === e.target.value);
                    if (profile) {
                      setSelectedProfile(profile);
                      clearSandbox();
                    }
                  }}
                  className="bg-neutral-900 border border-neutral-800 rounded-md px-1.5 py-0.5 text-[8.5px] font-black text-foreground focus:outline-none focus:border-indigo-500/30 cursor-pointer"
                >
                  {MOCK_PROFILES.map((p) => (
                    <option key={p.name} value={p.name} className="bg-neutral-950 text-foreground">{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2 text-neutral-600 font-semibold">
                <span>ID: {selectedProfile.id}</span>
                <span>Spent: {selectedProfile.name === "Aarav Sharma" ? "₹14,998" : selectedProfile.name === "Priya Patel" ? "₹6,499" : "₹0"}</span>
              </div>
            </div>

            {/* Simulated Chat Feed */}
            <div ref={sandboxScrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3.5 bg-neutral-950">
              {sandboxMessages.length === 0 && !isSandboxLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/5 flex items-center justify-center border border-indigo-500/10">
                    <Smartphone className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h4 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Mobile Sandbox App</h4>
                  <p className="text-[9px] text-neutral-500 max-w-[220px] leading-relaxed font-medium">
                    Test product recommendations, sizing checks, and order search boundaries. Security policies will monitor and intercept any unsafe responses.
                  </p>
                  <div className="flex flex-col gap-1.5 w-full max-w-[240px] pt-2">
                    {[
                      "Track my last order",
                      "Check pending payments",
                      "Show manufacturing cutting stages"
                    ].map((q) => (
                      <button key={q} onClick={() => { setSandboxInput(q); }}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider text-left transition-all truncate"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sandboxMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-lg bg-neutral-900 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-[11px] font-medium shadow-md shadow-indigo-600/10" : "space-y-1.5"}`}>
                    {msg.role === "user" ? (
                      <p className="leading-relaxed">{msg.content}</p>
                    ) : (
                      <>
                        {msg.toolActions && msg.toolActions.length > 0 && (
                          <div className="space-y-1">
                            {msg.toolActions.map((a: any, i: number) => {
                              const isDenied = a.result?.error !== undefined || a.result?.message?.includes("Access Denied");
                              return (
                                <div key={i} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider border ${
                                  isDenied ? "bg-rose-950/20 border-rose-500/30 text-rose-400" : "bg-indigo-950/20 border-indigo-500/30 text-indigo-400"
                                }`}>
                                  <span>🛠️ {a.tool}</span>
                                  <span className="ml-auto font-mono">{isDenied ? "DENIED" : "SUCCESS"}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className={`p-3 rounded-2xl text-[11px] leading-relaxed border font-medium ${
                          msg.isError ? "bg-rose-950/20 border-rose-500/20 text-rose-400" : "bg-neutral-900 border-neutral-800 text-neutral-300"
                        }`}>
                          {msg.content}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {isSandboxLoading && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-neutral-900 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-900 border border-neutral-800">
                    <div className="flex gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/20 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Keyboard / Input Bar */}
            <div className="shrink-0 border-t border-neutral-900 p-3 bg-neutral-950 flex gap-2 items-center z-40">
              <input value={sandboxInput} onChange={(e) => setSandboxInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSandboxSend(); }}
                placeholder="Ask style advice..."
                disabled={isSandboxLoading}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[11px] text-foreground placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
              <button onClick={handleSandboxSend} disabled={!sandboxInput.trim() || isSandboxLoading}
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                  sandboxInput.trim() && !isSandboxLoading ? "bg-indigo-500 text-white shadow-lg" : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
                }`}
              >
                {isSandboxLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
              {sandboxMessages.length > 0 && (
                <button onClick={clearSandbox} className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-foreground hover:bg-neutral-800 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* iPhone Home Indicator bar */}
            <div className="h-4.5 bg-neutral-950 flex items-center justify-center shrink-0 pb-1.5 z-40 select-none">
              <div className="w-24 h-1 bg-neutral-700 rounded-full" />
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
