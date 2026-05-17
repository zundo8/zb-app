"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Send, 
  History, 
  FileText, 
  Search, 
  RefreshCcw, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Inbox,
  Paperclip,
  ChevronRight,
  Flame,
  FileCheck,
  Megaphone,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/app/dashboard/layout";

export default function MailCenterPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "templates" | "marketing">("inbox");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [emails, setEmails] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  
  // Loading states
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active right panel state
  // 'empty' | 'compose' | 'detail' | 'template-editor' | 'campaign-editor'
  const [rightView, setRightView] = useState<"empty" | "compose" | "detail" | "template-editor" | "campaign-editor">("empty");
  
  // Selection states
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Form states
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState("");
  
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignHtml, setCampaignHtml] = useState("");
  const [campaignRecipients, setCampaignRecipients] = useState<string[]>([]);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Unread badge count
  const unreadCount = emails.filter(e => !e.isRead).length;

  // Initial loads
  useEffect(() => {
    fetchInbox();
    fetchTemplates();
    fetchCampaigns();
    fetchContacts();
  }, []);

  const fetchInbox = async () => {
    setLoadingInbox(true);
    try {
      const res = await fetch("/api/mail/inbox");
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Failed to load Zoho inbox: " + err.message);
    } finally {
      setLoadingInbox(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/mail/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Failed to load email templates: " + err.message);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch("/api/mail/campaigns");
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Failed to load campaigns: " + err.message);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch("/api/mail/contacts");
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Failed to load marketing contacts: " + err.message);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Action handlers
  const handleComposeNew = () => {
    setComposeTo("");
    setComposeSubject("");
    setComposeHtml("");
    setRightView("compose");
  };

  const handleSelectEmail = (email: any) => {
    setSelectedEmail(email);
    setRightView("detail");
    // Mark as read locally for aesthetics
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
  };

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateHtml(template.html);
    setRightView("template-editor");
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setTemplateName("");
    setTemplateSubject("");
    setTemplateHtml("");
    setRightView("template-editor");
  };

  const handleNewCampaign = () => {
    setCampaignName("");
    setCampaignSubject("");
    setCampaignHtml("");
    setCampaignRecipients([]);
    setRightView("campaign-editor");
  };

  // Sending and CRUD dispatches
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeHtml) {
      toast.warning("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          html: composeHtml,
          isMarketing: false
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Email dispatched successfully!`);
        setRightView("empty");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Send failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !templateSubject || !templateHtml) {
      toast.warning("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = !!selectedTemplate;
      const url = "/api/mail/templates";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing 
        ? { id: selectedTemplate.id, name: templateName, subject: templateSubject, html: templateHtml }
        : { name: templateName, subject: templateSubject, html: templateHtml };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(isEditing ? "Template updated successfully" : "Template saved successfully");
        fetchTemplates();
        setRightView("empty");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`/api/mail/templates?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Template deleted successfully");
        fetchTemplates();
        if (selectedTemplate?.id === id) {
          setRightView("empty");
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    }
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName || !campaignSubject || !campaignHtml || campaignRecipients.length === 0) {
      toast.warning("All fields and at least one recipient are required");
      return;
    }

    if (!confirm(`Are you sure you want to launch this campaign to ${campaignRecipients.length} recipients?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/mail/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          subject: campaignSubject,
          html: campaignHtml,
          recipients: campaignRecipients
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Marketing campaign launched! Emails are sending in the background.`);
        fetchCampaigns();
        setRightView("empty");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error("Campaign failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyTemplateToCompose = (tpl: any) => {
    setComposeSubject(tpl.subject);
    setComposeHtml(tpl.html);
  };

  const handleApplyTemplateToCampaign = (tpl: any) => {
    setCampaignSubject(tpl.subject);
    setCampaignHtml(tpl.html);
  };

  const toggleCampaignRecipient = (email: string) => {
    setCampaignRecipients(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const selectAllRecipients = () => {
    setCampaignRecipients(contacts.map(c => c.email));
  };

  const clearAllRecipients = () => {
    setCampaignRecipients([]);
  };

  // Searching logic
  const filteredEmails = emails.filter(e => 
    e.from.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)] min-h-[600px] overflow-hidden -mx-4 -my-4 lg:-mx-8 lg:-my-8 bg-[#0D0D0D] text-foreground rounded-[2.5rem] border border-foreground/5 shadow-3xl">
        
        {/* ──────── TOP BANNER / CONTROLS ──────── */}
        <div className="flex items-center justify-between border-b border-foreground/5 px-6 py-4 bg-[#121212]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/10 shadow-inner">
              <Mail className="w-5 h-5 text-[#C9A96E]" />
            </div>
            <div>
              <h1 className="text-md font-bold font-inter tracking-tight flex items-center gap-2">
                Zoho Mail Hub
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#C9A96E]/20 text-[#C9A96E] font-semibold border border-[#C9A96E]/20">
                  DEVELOPER
                </span>
              </h1>
              <p className="text-[11px] text-foreground/40 font-medium">developer@zicabella.com</p>
            </div>
          </div>
          <div className="flex items-center gap-3 max-w-sm flex-1 ml-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
              <input 
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl pl-9 pr-4 py-2 text-xs outline-none focus:border-[#C9A96E]/30 focus:bg-foreground/[0.07] transition-all"
              />
            </div>
            <button 
              onClick={() => {
                if (activeTab === "inbox") fetchInbox();
                if (activeTab === "templates") fetchTemplates();
                if (activeTab === "marketing") fetchCampaigns();
                fetchContacts();
              }}
              className="p-2.5 rounded-2xl bg-foreground/5 border border-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-all shrink-0"
              title="Refresh Stream"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ──────── MAIN 3-PANEL AREA ──────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ────── PANEL 1: SIDEBAR (220px) ────── */}
          <div className="w-[220px] border-r border-foreground/5 bg-[#0F0F0F] p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-6">
              {/* Compose Action */}
              <button 
                onClick={handleComposeNew}
                className="w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-2xl transition-all duration-300 transform active:scale-95 bg-gradient-to-r from-[#C9A96E] to-[#B39359] text-black hover:opacity-95 shadow-[#C9A96E]/10"
              >
                <Plus className="w-4 h-4 text-black" strokeWidth={3} />
                Compose Mail
              </button>

              {/* Navigation Links */}
              <div className="space-y-1">
                {[
                  { id: "inbox", label: "Inbox", icon: Inbox, count: unreadCount },
                  { id: "templates", label: "Templates", icon: FileText },
                  { id: "marketing", label: "Campaigns", icon: Megaphone },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button 
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSearchQuery("");
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-semibold tracking-tight transition-all duration-300 ${
                        active 
                          ? "bg-foreground/10 text-foreground border border-foreground/10 shadow-lg" 
                          : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-[#C9A96E]' : 'opacity-40'}`} />
                        <span>{tab.label}</span>
                      </div>
                      {!!tab.count && tab.count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A96E] text-black font-extrabold font-inter">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Contacts Banner */}
            <div className="p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5 text-center">
              <UserPlus className="w-5 h-5 mx-auto mb-2 text-foreground/40" />
              <div className="text-[11px] font-bold text-foreground/80 font-inter">Broadcast List</div>
              <div className="text-[10px] text-[#C9A96E] font-semibold mt-1">{contacts.length} Active Contacts</div>
            </div>
          </div>

          {/* ────── PANEL 2: ITEM STREAM (360px) ────── */}
          <div className="w-[360px] border-r border-foreground/5 bg-[#0A0A0A] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            
            {/* Inbox stream */}
            {activeTab === "inbox" && (
              <div className="flex-1 divide-y divide-foreground/5">
                {loadingInbox ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 space-y-2 animate-pulse">
                      <div className="flex justify-between"><div className="h-3.5 bg-foreground/5 rounded w-1/3"></div><div className="h-3 bg-foreground/5 rounded w-12"></div></div>
                      <div className="h-3.5 bg-foreground/5 rounded w-2/3"></div>
                      <div className="h-3 bg-foreground/5 rounded w-full"></div>
                    </div>
                  ))
                ) : filteredEmails.length === 0 ? (
                  <div className="p-8 text-center text-foreground/30 italic text-xs">
                    No emails found in Zoho Inbox.
                  </div>
                ) : (
                  filteredEmails.map((email) => {
                    const active = selectedEmail?.id === email.id && rightView === "detail";
                    return (
                      <div 
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={`p-4 cursor-pointer transition-all duration-300 relative border-l-2 ${
                          active 
                            ? "bg-foreground/5 border-l-[#C9A96E]" 
                            : !email.isRead 
                              ? "bg-foreground/[0.02] border-l-[#C9A96E]/40" 
                              : "border-l-transparent hover:bg-foreground/[0.01]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs truncate max-w-[200px] ${!email.isRead ? 'font-black text-foreground' : 'font-semibold text-foreground/75'}`}>
                            {email.from.split("<")[0].trim()}
                          </span>
                          <span className="text-[10px] text-foreground/30 font-medium font-inter shrink-0">
                            {new Date(email.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <h4 className={`text-xs truncate mb-1 ${!email.isRead ? 'font-bold text-[#C9A96E]' : 'font-medium text-foreground/60'}`}>
                          {email.subject}
                        </h4>
                        <p className="text-[11px] text-foreground/40 line-clamp-2 leading-relaxed">
                          {email.preview}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {email.hasAttachment && <Paperclip className="w-3 h-3 text-foreground/30" />}
                          {!email.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Templates view */}
            {activeTab === "templates" && (
              <div className="flex-1 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-foreground/5">
                  <span className="text-xs font-bold text-foreground/50">Custom Templates</span>
                  <button 
                    onClick={handleNewTemplate}
                    className="text-[10px] font-bold text-[#C9A96E] hover:text-[#C9A96E]/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New Template
                  </button>
                </div>
                {loadingTemplates ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-foreground/5 rounded-2xl animate-pulse" />
                  ))
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center text-foreground/30 italic text-xs py-8">
                    No custom templates saved.
                  </div>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const active = selectedTemplate?.id === tpl.id && rightView === "template-editor";
                    return (
                      <div 
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 relative group ${
                          active 
                            ? "bg-foreground/5 border-[#C9A96E]/40" 
                            : "bg-[#0F0F0F] border-foreground/5 hover:border-foreground/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h4 className="text-xs font-bold text-foreground truncate">{tpl.name}</h4>
                          <button 
                            onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                            className="p-1 rounded bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                            title="Delete Template"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] text-foreground/40 mb-3 truncate">Subject: {tpl.subject}</div>
                        <div className="flex items-center justify-between text-[9px] text-foreground/30 font-inter">
                          <span>Updated {new Date(tpl.updatedAt).toLocaleDateString()}</span>
                          <span className="px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/60 border border-foreground/5 font-semibold">
                            {tpl.category}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Marketing Campaigns view */}
            {activeTab === "marketing" && (
              <div className="flex-1 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-foreground/5">
                  <span className="text-xs font-bold text-foreground/50">Past Broadcasts</span>
                  <button 
                    onClick={handleNewCampaign}
                    className="text-[10px] font-bold text-[#C9A96E] hover:text-[#C9A96E]/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New Campaign
                  </button>
                </div>
                {loadingCampaigns ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-foreground/5 rounded-2xl animate-pulse" />
                  ))
                ) : filteredCampaigns.length === 0 ? (
                  <div className="text-center text-foreground/30 italic text-xs py-8">
                    No campaigns launched yet.
                  </div>
                ) : (
                  filteredCampaigns.map((camp) => (
                    <div 
                      key={camp.id}
                      className="p-4 rounded-2xl bg-[#0F0F0F] border border-foreground/5 hover:border-foreground/10 transition-all"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <h4 className="text-xs font-bold text-foreground truncate">{camp.name}</h4>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          camp.status === 'sent' 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-amber-500/10 text-amber-500 animate-pulse'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-foreground/40 mb-4 truncate">Subject: {camp.subject}</div>
                      
                      <div className="grid grid-cols-2 gap-2 border-t border-foreground/5 pt-3 text-[10px] text-foreground/50 font-inter">
                        <div>
                          <div className="text-foreground/30 text-[9px] uppercase tracking-tighter">Sent Out</div>
                          <div className="font-extrabold text-foreground">{camp.statsSent || 0} Emails</div>
                        </div>
                        <div>
                          <div className="text-foreground/30 text-[9px] uppercase tracking-tighter">Date</div>
                          <div className="font-extrabold text-foreground">
                            {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : 'Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ────── PANEL 3: DETAIL PANEL (FLEXIBLE) ────── */}
          <div className="flex-1 bg-[#0D0D0D] overflow-y-auto custom-scrollbar p-6">
            <AnimatePresence mode="wait">

              {/* EMPTY VIEW */}
              {rightView === "empty" && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-8"
                >
                  <Mail className="w-12 h-12 text-foreground/10 mb-4" />
                  <h3 className="text-sm font-bold text-foreground/60 mb-1">No Message Selected</h3>
                  <p className="text-xs text-foreground/30 max-w-xs">
                    Select an email to view its thread, or click Compose to launch new communications.
                  </p>
                </motion.div>
              )}

              {/* EMAIL DETAIL VIEW */}
              {rightView === "detail" && selectedEmail && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Email header */}
                  <div className="flex items-start justify-between border-b border-foreground/5 pb-4">
                    <div>
                      <h2 className="text-md font-bold text-[#C9A96E] mb-2">{selectedEmail.subject}</h2>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-foreground/60" />
                        </div>
                        <div className="text-xs text-foreground/70">
                          From: <span className="font-bold text-foreground">{selectedEmail.from}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-foreground/30 font-inter shrink-0">
                      {new Date(selectedEmail.date).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
                    </span>
                  </div>

                  {/* Sandboxed Email HTML body inside an iframe */}
                  <div className="rounded-2xl border border-foreground/5 bg-white h-[450px] shadow-2xl overflow-hidden">
                    <iframe 
                      title="email-body"
                      srcDoc={`
                        <html>
                          <head>
                            <style>
                              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 24px; margin: 0; background: #ffffff; }
                              img { max-width: 100%; height: auto; border-radius: 8px; }
                              a { color: #C9A96E; text-decoration: none; font-weight: 600; }
                            </style>
                          </head>
                          <body>
                            ${selectedEmail.preview.includes('(Raw email failed to parse)') ? `<p>${selectedEmail.preview}</p>` : selectedEmail.preview}
                          </body>
                        </html>
                      `}
                      className="w-full h-full border-0 bg-white"
                      sandbox="allow-same-origin"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-2">
                    <button 
                      onClick={() => {
                        const cleanEmail = selectedEmail.from.match(/<([^>]+)>/)?.[1] || selectedEmail.from;
                        setComposeTo(cleanEmail);
                        setComposeSubject(`Re: ${selectedEmail.subject}`);
                        setComposeHtml(`<br><br>On ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} wrote:<br><blockquote style="border-left: 2px solid #C9A96E; padding-left: 12px; margin-left: 4px; color: #666;">${selectedEmail.preview}</blockquote>`);
                        setRightView("compose");
                      }}
                      className="px-6 py-3 rounded-xl bg-foreground/5 border border-foreground/5 hover:bg-foreground/10 text-xs font-bold transition-all"
                    >
                      Reply to Sender
                    </button>
                  </div>
                </motion.div>
              )}

              {/* INDIVIDUAL EMAIL COMPOSER */}
              {rightView === "compose" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
                    <h2 className="text-md font-bold text-foreground">New Message</h2>
                    {/* Template Picker */}
                    <div className="relative">
                      <select 
                        onChange={(e) => {
                          const tpl = templates.find(t => t.id === e.target.value);
                          if (tpl) handleApplyTemplateToCompose(tpl);
                        }}
                        className="bg-foreground/5 border border-foreground/5 rounded-xl px-3 py-1.5 text-[10px] font-bold text-[#C9A96E] outline-none cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Apply Template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleSendEmail} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">To</label>
                        <input 
                          type="text"
                          placeholder="recipient@email.com"
                          value={composeTo}
                          onChange={(e) => setComposeTo(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#C9A96E]/30 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">From</label>
                        <div className="w-full bg-[#121212] border border-foreground/5 rounded-xl px-4 py-3 text-xs text-foreground/40 italic">
                          developer@zicabella.com
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">Subject</label>
                      <input 
                        type="text"
                        placeholder="Subject Line"
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#C9A96E]/30 transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">HTML Body</label>
                      <textarea 
                        rows={12}
                        placeholder="<h1>Email Title</h1><p>Body Content</p>"
                        value={composeHtml}
                        onChange={(e) => setComposeHtml(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-4 py-3 text-xs font-mono outline-none focus:border-[#C9A96E]/30 resize-none transition-all"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button 
                        type="button" 
                        onClick={() => setRightView("empty")}
                        className="px-6 py-3.5 rounded-xl border border-foreground/5 text-xs font-bold text-foreground/50 hover:bg-foreground/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-3.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 transition-all transform active:scale-95 bg-gradient-to-r from-[#C9A96E] to-[#B39359] text-black hover:opacity-95 disabled:opacity-50"
                      >
                        {submitting ? <RefreshCcw className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
                        <span>Send Email</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* EMAIL TEMPLATE EDITOR */}
              {rightView === "template-editor" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <h2 className="text-md font-bold text-foreground border-b border-foreground/5 pb-4">
                    {selectedTemplate ? `Edit Template: ${selectedTemplate.name}` : "Create New Template"}
                  </h2>

                  <form onSubmit={handleSaveTemplate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">Template Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. Winter Catalog Launch"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#C9A96E]/30 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">Default Subject</label>
                        <input 
                          type="text"
                          placeholder="Default Subject Line"
                          value={templateSubject}
                          onChange={(e) => setTemplateSubject(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#C9A96E]/30 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">HTML Content</label>
                      <textarea 
                        rows={12}
                        placeholder="<div>Your template layout here...</div>"
                        value={templateHtml}
                        onChange={(e) => setTemplateHtml(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-4 py-3 text-xs font-mono outline-none focus:border-[#C9A96E]/30 resize-none transition-all"
                        required
                      />
                    </div>

                    {/* Basic visual sandbox preview */}
                    {templateHtml && (
                      <div className="p-4 rounded-2xl border border-foreground/5 bg-white overflow-hidden shadow-inner">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-black/40 block mb-2">Visual Preview</label>
                        <div 
                          className="text-black text-xs max-h-40 overflow-y-auto p-4 bg-gray-50 rounded-xl"
                          dangerouslySetInnerHTML={{ __html: templateHtml }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button 
                        type="button" 
                        onClick={() => setRightView("empty")}
                        className="px-6 py-3.5 rounded-xl border border-foreground/5 text-xs font-bold text-foreground/50 hover:bg-foreground/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-3.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 transition-all transform active:scale-95 bg-gradient-to-r from-[#C9A96E] to-[#B39359] text-black hover:opacity-95 disabled:opacity-50"
                      >
                        {submitting ? <RefreshCcw className="w-4 h-4 animate-spin text-black" /> : <FileCheck className="w-4 h-4 text-black" />}
                        <span>Save Template</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* MARKETING CAMPAIGN COMPOSER */}
              {rightView === "campaign-editor" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
                    <h2 className="text-md font-bold text-foreground">Launch Marketing Broadcast</h2>
                    {/* Template Picker */}
                    <div className="relative">
                      <select 
                        onChange={(e) => {
                          const tpl = templates.find(t => t.id === e.target.value);
                          if (tpl) handleApplyTemplateToCampaign(tpl);
                        }}
                        className="bg-foreground/5 border border-foreground/5 rounded-xl px-3 py-1.5 text-[10px] font-bold text-[#C9A96E] outline-none cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Apply Template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleLaunchCampaign} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">Campaign Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. Festival Season Kickoff"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#C9A96E]/30 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">Subject Line</label>
                        <input 
                          type="text"
                          placeholder="Festival Subject Line"
                          value={campaignSubject}
                          onChange={(e) => setCampaignSubject(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#C9A96E]/30 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Contacts Selector */}
                    <div className="space-y-2 relative">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1 block">
                        Target Recipients ({campaignRecipients.length} Selected)
                      </label>
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                          className="px-4 py-2.5 rounded-xl bg-foreground/5 border border-foreground/5 text-xs font-bold text-[#C9A96E] hover:bg-foreground/10 transition-all flex items-center gap-2"
                        >
                          Select Contacts...
                        </button>
                        <button 
                          type="button"
                          onClick={selectAllRecipients}
                          className="text-[10px] font-bold text-foreground/40 hover:text-foreground transition-colors"
                        >
                          Select All
                        </button>
                        <button 
                          type="button"
                          onClick={clearAllRecipients}
                          className="text-[10px] font-bold text-foreground/40 hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      </div>

                      {showRecipientDropdown && (
                        <div className="absolute top-14 left-0 w-full max-h-60 bg-[#121212] border border-foreground/10 rounded-2xl p-4 overflow-y-auto custom-scrollbar z-50 shadow-3xl space-y-2">
                          <div className="flex items-center justify-between border-b border-foreground/5 pb-2 mb-2">
                            <span className="text-[10px] font-bold text-foreground/40">Select Contacts</span>
                            <button onClick={() => setShowRecipientDropdown(false)} className="text-[10px] font-bold hover:text-red-500 transition-colors">
                              Close
                            </button>
                          </div>
                          {contacts.map((c) => {
                            const isSelected = campaignRecipients.includes(c.email);
                            return (
                              <div 
                                key={c.id}
                                onClick={() => toggleCampaignRecipient(c.email)}
                                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                                  isSelected ? "bg-foreground/5 text-foreground" : "hover:bg-foreground/[0.02] text-foreground/50"
                                }`}
                              >
                                <div className="text-[11px]">
                                  <div className="font-bold">{c.name}</div>
                                  <div className="text-[10px] opacity-60 font-mono">{c.email}</div>
                                </div>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by click div
                                  className="accent-[#C9A96E]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-foreground/40 px-1">HTML Broadcast Content</label>
                      <textarea 
                        rows={10}
                        placeholder="<div>HTML Broadcast structure...</div>"
                        value={campaignHtml}
                        onChange={(e) => setCampaignHtml(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-4 py-3 text-xs font-mono outline-none focus:border-[#C9A96E]/30 resize-none transition-all"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button 
                        type="button" 
                        onClick={() => setRightView("empty")}
                        className="px-6 py-3.5 rounded-xl border border-foreground/5 text-xs font-bold text-foreground/50 hover:bg-foreground/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={submitting || campaignRecipients.length === 0}
                        className="px-8 py-3.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 transition-all transform active:scale-95 bg-gradient-to-r from-[#C9A96E] to-[#B39359] text-black hover:opacity-95 disabled:opacity-50"
                      >
                        {submitting ? <RefreshCcw className="w-4 h-4 animate-spin text-black" /> : <Flame className="w-4 h-4 text-black" />}
                        <span>Launch Broadcast ({campaignRecipients.length})</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
