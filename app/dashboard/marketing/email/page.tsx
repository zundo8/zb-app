"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Send, 
  History, 
  FileText, 
  Settings as SettingsIcon, 
  Search, 
  Filter, 
  ChevronRight, 
  RefreshCcw, 
  Eye, 
  Edit3, 
  Copy, 
  Trash2, 
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  Zap,
  ArrowRight,
  Sparkles,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";

// --- Tab Components ---

const InboxTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/logs"); // I'll need to create this API
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      toast.error("Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input 
            type="text" 
            placeholder="Search by recipient..." 
            className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-foreground/20 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="glass border border-foreground/10 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 hover:bg-foreground/5 transition-all">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
          <button onClick={fetchLogs} className="glass border border-foreground/10 p-2.5 rounded-xl hover:bg-foreground/5 transition-all">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl border border-foreground/5 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-foreground/5 text-[11px] font-bold uppercase tracking-wider text-foreground/40 border-b border-foreground/5">
              <th className="px-6 py-4">Date / Time</th>
              <th className="px-6 py-4">Recipient</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Template</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/5">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-foreground/5 rounded w-full"></div></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-foreground/40 italic">
                  No email logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-foreground/[0.02] transition-colors group cursor-pointer" onClick={() => setSelectedLog(log)}>
                  <td className="px-6 py-4 text-xs text-foreground/60">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium">{log.recipientName || 'N/A'}</div>
                    <div className="text-xs text-foreground/40">{log.recipientEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm max-w-xs truncate">{log.subject}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-foreground/5 border border-foreground/10 font-medium uppercase tracking-tight">
                      {log.templateName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      log.status === 'sent' 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {log.status === 'sent' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over for details */}
      <AnimatePresence>
        {selectedLog && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-foreground/10 z-[101] shadow-3xl p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold">Email Details</h2>
                <button onClick={() => setSelectedLog(null)} className="p-2 rounded-xl hover:bg-foreground/5 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10">
                    <div className="text-[10px] uppercase font-bold text-foreground/40 mb-1">Status</div>
                    <div className={`text-sm font-bold ${selectedLog.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedLog.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10">
                    <div className="text-[10px] uppercase font-bold text-foreground/40 mb-1">Message ID</div>
                    <div className="text-sm font-mono truncate">{selectedLog.messageId || 'N/A'}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between border-b border-foreground/5 pb-4">
                    <span className="text-sm text-foreground/40">Recipient</span>
                    <span className="text-sm font-medium">{selectedLog.recipientName} ({selectedLog.recipientEmail})</span>
                  </div>
                  <div className="flex justify-between border-b border-foreground/5 pb-4">
                    <span className="text-sm text-foreground/40">Subject</span>
                    <span className="text-sm font-medium">{selectedLog.subject}</span>
                  </div>
                  <div className="flex justify-between border-b border-foreground/5 pb-4">
                    <span className="text-sm text-foreground/40">Trigger Event</span>
                    <span className="text-sm font-medium">{selectedLog.triggerEvent || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/40 uppercase">HTML Preview</label>
                  <div className="border border-foreground/10 rounded-2xl overflow-hidden bg-white h-[400px]">
                    {/* Rendered HTML inside iframe or div */}
                    <div className="p-4 h-full overflow-auto text-black">
                      <div className="text-center p-8 text-gray-400 italic">
                        [Rendered Email Content Preview]
                      </div>
                    </div>
                  </div>
                </div>

                {selectedLog.status === 'failed' && (
                  <button className="w-full bg-foreground text-background font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                    <RefreshCcw className="w-4 h-4" />
                    Resend Email
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const TemplatesTab = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/templates"); // I'll need to create this API
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Saved Templates</h2>
        <div className="flex items-center gap-3">
          <button className="glass border border-foreground/10 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-foreground/5 transition-all">
            <Zap className="w-4 h-4 text-violet-400" />
            AI Generate
          </button>
          <button className="bg-foreground text-background px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xl hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Create New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="glass h-64 rounded-3xl animate-pulse border border-foreground/5" />
          ))
        ) : (
          templates.map((template) => (
            <motion.div 
              key={template.id}
              whileHover={{ y: -4 }}
              className="glass p-6 rounded-[2rem] border border-foreground/10 shadow-xl group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`p-3 rounded-2xl ${
                  template.category === 'transactional' ? 'bg-blue-500/10 text-blue-500' :
                  template.category === 'operational' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-violet-500/10 text-violet-500'
                }`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-red-500/10 text-foreground/40 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1 block">
                  {template.category}
                </span>
                <h3 className="text-lg font-bold group-hover:text-foreground transition-colors truncate">
                  {template.name}
                </h3>
                <p className="text-xs text-foreground/40 mt-1 truncate">
                  Subject: {template.subject}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button className="flex-1 glass border border-foreground/10 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-foreground/5 transition-all">
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button className="flex-1 glass border border-foreground/10 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-foreground/5 transition-all">
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const ComposeTab = () => {
  const [recipientType, setRecipientType] = useState("custom");
  const [customEmails, setCustomEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !body) return toast.error("Subject and body are required");
    
    setLoading(true);
    try {
      const res = await fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientType === "custom" ? customEmails : recipientType,
          subject,
          html: body,
          recipientName: recipientType === "custom" ? "Custom Recipient" : recipientType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Email sent successfully!");
        if (recipientType === "custom") setCustomEmails("");
        setSubject("");
        setBody("");
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <form onSubmit={handleSend} className="glass p-8 rounded-[2.5rem] border border-foreground/5 shadow-3xl space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">To Recipient(s)</label>
              <select 
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 outline-none focus:border-foreground/30 transition-all text-sm font-medium appearance-none"
              >
                <option value="custom">Custom Recipient(s)</option>
                <option value="all_customers">All Customers</option>
                <option value="all_vendors">All Vendors</option>
                <option value="app_users">App Users Only</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">From</label>
              <div className="w-full bg-foreground/[0.02] border border-foreground/5 rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground/40 italic">
                noreply@zicabella.com
              </div>
            </div>
          </div>

          {recipientType === "custom" && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Recipient Emails</label>
              <input 
                type="text" 
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                placeholder="Comma separated emails..."
                className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 outline-none focus:border-foreground/30 transition-all text-sm"
              />

            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Subject Line</label>
            <input 
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 outline-none focus:border-foreground/30 transition-all text-sm font-bold"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Email Content (HTML)</label>
              <button type="button" className="text-[10px] font-bold text-violet-400 hover:text-violet-500 transition-all flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Improve with AI
              </button>
            </div>
            <textarea 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="<h1>Your Message Here</h1>"
              className="w-full bg-foreground/5 border border-foreground/10 rounded-3xl px-6 py-5 outline-none focus:border-foreground/30 transition-all text-sm font-mono resize-none shadow-inner"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-foreground text-background font-bold py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>Launch Campaign</span>
            </button>
            <button type="button" className="px-8 glass border border-foreground/10 py-4 rounded-2xl font-bold hover:bg-foreground/5 transition-all">
              Save Draft
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        <div className="glass p-6 rounded-3xl border border-foreground/10">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            Live Preview
          </h3>
          <div className="bg-white rounded-2xl overflow-hidden border border-foreground/10 h-[500px] shadow-lg flex flex-col">
            <div className="bg-gray-50 border-b border-gray-100 p-4 space-y-1">
              <div className="text-[10px] font-bold text-gray-400">Subject: <span className="text-gray-800">{subject || 'New Collection Arriving...'}</span></div>
              <div className="text-[10px] font-bold text-gray-400">From: <span className="text-gray-800">Zica Bella &lt;noreply@zicabella.com&gt;</span></div>
            </div>
            <div className="flex-1 overflow-auto p-6 text-black text-sm">
              {body ? (
                <div dangerouslySetInnerHTML={{ __html: body }} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 italic text-center px-8">
                  <Mail className="w-12 h-12 mb-4 opacity-10" />
                  Your email content will be rendered here in real-time.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-foreground/10 bg-violet-500/[0.02]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4 px-1">Available Variables</h3>
          <div className="grid grid-cols-2 gap-2">
            {['customerName', 'orderId', 'totalAmount', 'trackingUrl', 'appDownloadUrl', 'loginUrl'].map((v) => (
              <button key={v} onClick={() => setBody(b => b + `{{${v}}}`)} className="text-left px-3 py-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl text-[10px] font-mono transition-all">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab = () => {
  const [testing, setTesting] = useState(false);
  const [prefs, setPrefs] = useState<any[]>([]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/email/test-connection", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        throw new Error(data.error || "Connection failed");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-8">
        <div className="glass p-8 rounded-[2.5rem] border border-foreground/5 shadow-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold">SMTP Configuration</h3>
              <p className="text-xs text-foreground/40 mt-1">Zoho Mail SMTP server settings</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
              <SettingsIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Host</label>
                <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">smtp.zoho.in</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Port</label>
                <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">465</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Authenticated User</label>
              <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">noreply@zicabella.com</div>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={testConnection}
                disabled={testing}
                className="flex-1 glass border border-foreground/10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-foreground/5 transition-all disabled:opacity-50"
              >
                {testing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
                Test Connection
              </button>
              <button className="flex-1 bg-foreground text-background font-bold py-4 rounded-2xl shadow-xl hover:opacity-90 transition-opacity">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] border border-foreground/5 shadow-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">Sender Aliases</h3>
            <button className="p-2 bg-foreground/5 rounded-xl hover:bg-foreground/10 transition-all">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Default', email: 'noreply@zicabella.com' },
              { label: 'Orders', email: 'orders@zicabella.com' },
              { label: 'Support', email: 'support@zicabella.com' }
            ].map((alias) => (
              <div key={alias.email} className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5">
                <div>
                  <div className="text-sm font-bold">{alias.label}</div>
                  <div className="text-xs text-foreground/40">{alias.email}</div>
                </div>
                <button className="text-xs font-bold text-foreground/40 hover:text-red-500 transition-all">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass p-8 rounded-[2.5rem] border border-foreground/5 shadow-3xl h-fit">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold">Notification Preferences</h3>
            <p className="text-xs text-foreground/40 mt-1">Automatic trigger controls</p>
          </div>
          <div className="p-3 bg-green-500/10 text-green-500 rounded-2xl">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'New order received → Admin email', key: 'order_admin' },
            { label: 'Order shipped → Customer email', key: 'order_shipped' },
            { label: 'Order delivered → Customer email', key: 'order_delivered' },
            { label: 'Order cancelled → Admin + Customer', key: 'order_cancelled' },
            { label: 'Low stock alert → Admin + Vendor', key: 'low_stock' },
            { label: 'Production update → Vendor email', key: 'prod_update' },
            { label: 'New user welcome → Customer email', key: 'welcome' }
          ].map((pref) => (
            <div key={pref.key} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-foreground/[0.02] border border-foreground/5 hover:border-foreground/10 transition-all group">
              <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">{pref.label}</span>
              <button className="relative w-12 h-6 rounded-full bg-green-500 transition-colors">
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function EmailModulePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "inbox";

  const tabs = [
    { id: "inbox", label: "Inbox / Sent Log", icon: History },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "compose", label: "Compose", icon: Send },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-foreground/40 mb-2">
            <Mail className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Marketing Suite</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            Email Center
            <span className="text-xs font-bold px-3 py-1 bg-blue-500 text-white rounded-full tracking-normal align-middle shadow-lg shadow-blue-500/20">ZOHO</span>
          </h1>
          <p className="text-foreground/40 mt-2 font-medium">Manage transactional, operational, and marketing communications.</p>
        </div>

        {/* Tab Switcher */}
        <div className="glass p-1.5 rounded-[2rem] border border-foreground/5 shadow-2xl flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all duration-500 ${
                  active 
                    ? "text-background" 
                    : "text-foreground/40 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {active && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-foreground rounded-2xl -z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 ${active ? 'text-background' : ''}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {activeTab === "inbox" && <InboxTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "compose" && <ComposeTab />}
        {activeTab === "settings" && <SettingsTab />}
      </motion.div>

      {/* Floating Action Button for quick test (optional) */}
      <button className="fixed bottom-10 right-10 bg-foreground text-background w-14 h-14 rounded-full shadow-3xl flex items-center justify-center group hover:scale-110 transition-all duration-500 z-50">
        <ArrowRight className="w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
      </button>
    </div>
  );
}


