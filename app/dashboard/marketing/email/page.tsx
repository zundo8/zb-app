"use client";

import { useState, useEffect, Suspense } from "react";
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
  X,
  Bell
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";

// --- Tab Components ---

const InboxTab = () => {
  const [viewMode, setViewMode] = useState<"live" | "outgoing">("live");
  const [logs, setLogs] = useState<any[]>([]);
  const [inboxEmails, setInboxEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [imapError, setImapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [senderEmail, setSenderEmail] = useState("developer@zicabella.com");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/email/config");
        const data = await res.json();
        if (data.success && data.config?.user) {
          setSenderEmail(data.config.user);
        }
      } catch (error) {
        console.error("Failed to load email config in inbox:", error);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (viewMode === "live") {
      fetchInbox();
    } else {
      fetchLogs();
    }
  }, [viewMode]);

  const fetchLogs = async () => {
    setLoading(true);
    setImapError(null);
    try {
      const res = await fetch("/api/email/logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      toast.error("Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchInbox = async () => {
    setLoading(true);
    setImapError(null);
    try {
      const res = await fetch("/api/mail/inbox");
      const data = await res.json();
      if (data.success) {
        setInboxEmails(data.emails || []);
      } else {
        setImapError(data.error || "Failed to load Zoho inbox");
      }
    } catch (error: any) {
      setImapError(error.message || "Failed to load Zoho inbox");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (log: any) => {
    toast.promise(
      fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: log.recipientEmail,
          subject: log.subject,
          html: `<h1>Resent Communication</h1><p>This is a resent message. Original ID: ${log.id}</p>`,
          recipientName: log.recipientName || log.recipientEmail.split("@")[0],
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to resend");
        fetchLogs();
        setSelectedLog(null);
      }),
      {
        loading: "Resending email...",
        success: "Email resent successfully!",
        error: (err) => err.message,
      }
    );
  };

  const filteredInbox = inboxEmails.filter(
    (email) =>
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = logs.filter(
    (log) =>
      log.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.recipientName && log.recipientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub-Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-foreground/5 pb-4">
        <div className="flex items-center gap-2 bg-foreground/5 p-1 rounded-2xl border border-foreground/10 w-fit">
          <button
            onClick={() => setViewMode("live")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              viewMode === "live"
                ? "bg-foreground text-background shadow-lg"
                : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            Live Zoho Inbox
          </button>
          <button
            onClick={() => setViewMode("outgoing")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              viewMode === "outgoing"
                ? "bg-foreground text-background shadow-lg"
                : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            System Sent Logs
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-foreground/20 transition-all text-xs font-medium"
            />
          </div>
          <button
            onClick={viewMode === "live" ? fetchInbox : fetchLogs}
            className="glass border border-foreground/10 p-2 rounded-xl hover:bg-foreground/5 transition-all"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Zoho IMAP Error Panel */}
      {viewMode === "live" && imapError && (
        <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 text-foreground flex flex-col md:flex-row gap-6 items-start animate-fade-in shadow-xl">
          <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              Zoho IMAP Authentication Notice
            </h4>
            <p className="text-xs text-foreground/60 leading-relaxed max-w-3xl">
              The mail server returned: <code className="bg-foreground/5 px-1.5 py-0.5 rounded font-mono text-amber-500/90">{imapError}</code>. 
              This commonly indicates IMAP access is disabled for the Zoho account <strong>{senderEmail}</strong>.
            </p>
            <div className="pt-2 space-y-2 text-xs text-foreground/40 border-t border-foreground/5 mt-4">
              <p className="font-bold text-foreground/60">To enable real-time Zoho Inbox synchronization:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li>Log in to your <a href="https://mail.zoho.in" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1 font-bold">Zoho Mail Client <ExternalLink className="w-3 h-3 inline" /></a></li>
                <li>Go to <strong>Settings</strong> (Gear Icon) &gt; <strong>Mail Accounts</strong></li>
                <li>Select the account and look for <strong>IMAP Access</strong></li>
                <li>Toggle the <strong>IMAP Access</strong> checkbox to <strong>Enabled</strong> and click Save</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Content Table / Grid */}
      <div className="glass overflow-hidden rounded-3xl border border-foreground/5 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            {viewMode === "live" ? (
              <tr className="bg-foreground/[0.03] text-[10px] font-bold uppercase tracking-widest text-foreground/40 border-b border-foreground/5">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">From</th>
                <th className="px-6 py-4">Subject & Preview</th>
                <th className="px-6 py-4">Received Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            ) : (
              <tr className="bg-foreground/[0.03] text-[10px] font-bold uppercase tracking-widest text-foreground/40 border-b border-foreground/5">
                <th className="px-6 py-4">Date / Time</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Template</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-foreground/5">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="h-4 bg-foreground/5 rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : viewMode === "live" ? (
              filteredInbox.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-foreground/30 italic text-xs">
                    {imapError ? "Unable to read inbox (IMAP Disabled)" : "No live incoming emails found."}
                  </td>
                </tr>
              ) : (
                filteredInbox.map((email) => (
                  <tr
                    key={email.id}
                    className="hover:bg-foreground/[0.01] transition-colors group cursor-pointer"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`w-2.5 h-2.5 rounded-full ${!email.isRead ? "bg-blue-500 shadow-lg shadow-blue-500/50" : "bg-foreground/10"}`} />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-xs max-w-[180px] truncate">
                      {email.from}
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="text-xs font-bold text-foreground truncate">{email.subject}</div>
                      <div className="text-[10px] text-foreground/40 truncate mt-0.5">{email.preview}</div>
                    </td>
                    <td className="px-6 py-4 text-[10px] text-foreground/40">
                      {new Date(email.date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/30 hover:text-foreground transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-foreground/30 italic text-xs">
                  No system sent logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-foreground/[0.01] transition-colors group cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-6 py-4 text-[10px] text-foreground/50">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold">{log.recipientName || "N/A"}</div>
                    <div className="text-[10px] text-foreground/40 mt-0.5">{log.recipientEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium max-w-xs truncate">{log.subject}</td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-bold uppercase tracking-tight text-foreground/60">
                      {log.templateName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        log.status === "sent"
                          ? "bg-green-500/10 text-green-400 border border-green-500/10"
                          : "bg-red-500/10 text-red-400 border border-red-500/10"
                      }`}
                    >
                      {log.status === "sent" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/30 hover:text-foreground transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over drawer for Outgoing Log Details */}
      <AnimatePresence>
        {selectedLog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-background/70 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l border-foreground/10 z-[101] shadow-3xl p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6 flex-1">
                <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
                  <div>
                    <h2 className="text-md font-bold">Outgoing Communication Log</h2>
                    <p className="text-[10px] text-foreground/40 mt-0.5">Reference ID: {selectedLog.id}</p>
                  </div>
                  <button onClick={() => setSelectedLog(null)} className="p-2 rounded-xl hover:bg-foreground/5 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/5">
                    <div className="text-[9px] uppercase font-bold text-foreground/30 mb-1">Status</div>
                    <div
                      className={`text-xs font-bold uppercase tracking-wider ${
                        selectedLog.status === "sent" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {selectedLog.status}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/5">
                    <div className="text-[9px] uppercase font-bold text-foreground/30 mb-1">Trigger Event</div>
                    <div className="text-xs font-bold text-foreground/70 truncate">{selectedLog.triggerEvent || "Manual"}</div>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between border-b border-foreground/5 pb-3">
                    <span className="text-foreground/40">Recipient</span>
                    <span className="font-bold text-foreground/80">
                      {selectedLog.recipientName} &lt;{selectedLog.recipientEmail}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-foreground/5 pb-3">
                    <span className="text-foreground/40">Subject Line</span>
                    <span className="font-bold text-foreground/80">{selectedLog.subject}</span>
                  </div>
                  <div className="flex justify-between border-b border-foreground/5 pb-3">
                    <span className="text-foreground/40">Timestamp</span>
                    <span className="font-bold text-foreground/80">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedLog.messageId && (
                    <div className="flex justify-between border-b border-foreground/5 pb-3">
                      <span className="text-foreground/40">Message ID</span>
                      <span className="font-mono text-[10px] text-foreground/60">{selectedLog.messageId}</span>
                    </div>
                  )}
                  {selectedLog.errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400 text-xs">
                      <div className="font-bold mb-1">Error Logs:</div>
                      <div className="font-mono text-[10px] whitespace-pre-wrap leading-relaxed">{selectedLog.errorMessage}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">HTML Preview</label>
                  <div className="border border-foreground/10 rounded-2xl overflow-hidden bg-white h-[320px] shadow-inner">
                    <div className="p-4 h-full overflow-auto text-black text-xs">
                      <div className="text-center p-8 text-gray-400 italic">
                        [System Generated Transactional Email]
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedLog.status === "failed" && (
                <button
                  onClick={() => handleResend(selectedLog)}
                  className="w-full bg-foreground text-background font-bold py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:opacity-95 transition-opacity mt-4 text-xs tracking-wider uppercase"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Retry Delivery via SMTP
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-over drawer for Live Email Details */}
      <AnimatePresence>
        {selectedEmail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEmail(null)}
              className="fixed inset-0 bg-background/70 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l border-foreground/10 z-[101] shadow-3xl p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
                  <div>
                    <h2 className="text-md font-bold">Zoho Live Email</h2>
                    <p className="text-[10px] text-foreground/40 mt-0.5">Zoho Mail Server Sync UID: {selectedEmail.id}</p>
                  </div>
                  <button onClick={() => setSelectedEmail(null)} className="p-2 rounded-xl hover:bg-foreground/5 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs border-b border-foreground/5 pb-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground/40 font-bold">From</span>
                    <span className="font-bold text-foreground/80 bg-foreground/5 px-3.5 py-2.5 rounded-xl border border-foreground/5">
                      {selectedEmail.from}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground/40 font-bold">Subject</span>
                    <span className="font-bold text-foreground/80 bg-foreground/5 px-3.5 py-2.5 rounded-xl border border-foreground/5">
                      {selectedEmail.subject}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-2">
                    <span className="text-foreground/40">Received Date</span>
                    <span className="font-bold text-foreground/60">{new Date(selectedEmail.date).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">Message Content Preview</label>
                  <div className="border border-foreground/10 rounded-2xl bg-foreground/5 p-5 shadow-inner min-h-[180px] leading-relaxed text-xs text-foreground/75 font-medium whitespace-pre-wrap">
                    {selectedEmail.preview}
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href="https://mail.zoho.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full glass border border-foreground/10 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-foreground/5 transition-all text-xs tracking-wider uppercase"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Zoho Client to Read Full & Reply
                  </a>
                </div>
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
  const [senderEmail, setSenderEmail] = useState("developer@zicabella.com");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/email/config");
        const data = await res.json();
        if (data.success && data.config) {
          setSenderEmail(data.config.user);
        }
      } catch (error) {
        console.error("Failed to load email config in compose:", error);
      }
    };
    fetchConfig();
  }, []);

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
                {senderEmail}
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
              <div className="text-[10px] font-bold text-gray-400">From: <span className="text-gray-800">Zica Bella &lt;{senderEmail}&gt;</span></div>
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
  const [config, setConfig] = useState<any>({
    host: "smtp.zoho.in",
    port: "465",
    user: "developer@zicabella.com",
    senderName: "Zica Bella",
  });
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    order_admin: true,
    order_shipped: true,
    order_delivered: true,
    order_cancelled: true,
    low_stock: true,
    prod_update: true,
    welcome: true,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/email/config");
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      } catch (error) {
        console.error("Failed to load email config in settings:", error);
      }
    };
    fetchConfig();
  }, []);

  const togglePref = (key: string) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success("Notification trigger preference updated!");
  };

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
                <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">{config.host}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Port</label>
                <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">{config.port}</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2">Authenticated User</label>
              <div className="bg-foreground/5 border border-foreground/10 rounded-2xl px-5 py-3.5 text-sm font-medium">{config.user}</div>
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
              <button 
                onClick={() => toast.success("Configuration is synchronized with Zoho servers.")}
                className="flex-1 bg-foreground text-background font-bold py-4 rounded-2xl shadow-xl hover:opacity-90 transition-opacity"
              >
                Sync with Env
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
              { label: 'Default Alias', email: config.user },
              { label: 'Orders Support', email: `orders@${config.user.split('@')[1] || 'zicabella.com'}` },
              { label: 'Concierge VIP', email: `support@${config.user.split('@')[1] || 'zicabella.com'}` }
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
              <button 
                onClick={() => togglePref(pref.key)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                  prefs[pref.key] ? "bg-green-500" : "bg-foreground/25"
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                  prefs[pref.key] ? "right-1" : "left-1"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function EmailModuleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inbox");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tabId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const tabs = [
    { id: "inbox", label: "Inbox / Sent Log", icon: History },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "compose", label: "Compose", icon: Send },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

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

export default function EmailModulePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground"></div>
      </div>
    }>
      <EmailModuleContent />
    </Suspense>
  );
}


