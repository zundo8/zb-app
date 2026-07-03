"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Search, Send, RefreshCcw, User, Phone, 
  Mail, ShieldAlert, Check, CheckCheck, Clock, AlertCircle, Image, 
  ChevronRight, ArrowLeftRight, ExternalLink, UserCheck, Sparkles,
  ShoppingBag, X, Paperclip, Loader2, UploadCloud, Info, Trash2
} from "lucide-react";
import { toast } from "sonner";

interface Conversation {
  phoneNumber: string;
  lastMessage: {
    id: string;
    body: string;
    direction: "inbound" | "outbound";
    status: string;
    createdAt: string;
  };
  unreadCount: number;
  customerName: string | null;
  customerId: string | null;
  customerEmail: string | null;
  whatsappOptedOut: boolean | null;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  waMessageId: string | null;
  phoneNumber: string;
  body: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  status: string;
  createdAt: string;
}

export default function WhatsAppChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Templates Selection State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  // Catalog / Product Selection State
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll conversations every 5 seconds
  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch("/api/whatsapp/chat/conversations");
        const data = await res.json();
        if (res.ok && data.conversations) {
          setConversations(data.conversations);
        }
      } catch (err) {
        console.error("Error loading chat conversations:", err);
      } finally {
        setLoadingConversations(false);
      }
    }
    fetchConversations();

    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // Fetch messages when active conversation changes or poll every 4 seconds
  useEffect(() => {
    if (!activePhone) return;

    async function fetchMessages(showLoading = false) {
      if (showLoading) setLoadingMessages(true);
      try {
        const res = await fetch(`/api/whatsapp/chat/messages?phone=${activePhone}`);
        const data = await res.json();
        if (res.ok && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Error loading messages thread:", err);
      } finally {
        if (showLoading) setLoadingMessages(false);
      }
    }

    fetchMessages(true);

    const interval = setInterval(() => fetchMessages(false), 4000);
    return () => clearInterval(interval);
  }, [activePhone]);

  // Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConv = conversations.find(c => c.phoneNumber === activePhone);

  // Calculate if the 24-hour service window is active
  const isServiceWindowActive = () => {
    if (!messages.length) return true; // Default fallback
    const lastInbound = [...messages]
      .reverse()
      .find(m => m.direction === "inbound");
    
    if (!lastInbound) return false; // No customer message ever received
    
    const lastInboundTime = new Date(lastInbound.createdAt).getTime();
    const now = new Date().getTime();
    const hoursElapsed = (now - lastInboundTime) / (1000 * 60 * 60);
    
    return hoursElapsed <= 24;
  };

  const serviceWindowHoursRemaining = () => {
    if (!messages.length) return 24;
    const lastInbound = [...messages]
      .reverse()
      .find(m => m.direction === "inbound");
    
    if (!lastInbound) return 0;
    
    const lastInboundTime = new Date(lastInbound.createdAt).getTime();
    const now = new Date().getTime();
    const hoursRemaining = 24 - (now - lastInboundTime) / (1000 * 60 * 60);
    
    return Math.max(0, parseFloat(hoursRemaining.toFixed(1)));
  };

  // Handle direct image file upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const toastId = toast.loading("Uploading image to assets...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/whatsapp/chat/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setMediaUrl(data.url);
        setShowMediaInput(true);
        toast.success("Image uploaded successfully! Feel free to write a caption message.", { id: toastId });
      } else {
        toast.error(data.error || "Upload failed.", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error during file upload.", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Open Templates List
  const handleOpenTemplates = async () => {
    setShowTemplateModal(true);
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json();
      if (res.ok) {
        setTemplatesList(data.templates?.filter((t: any) => t.status === "APPROVED") || []);
      } else {
        toast.error("Failed to load templates.");
      }
    } catch (err) {
      toast.error("Error connecting to templates database.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Select specific template to configure variables
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    const bodyText = template.components?.find((c: any) => c.type === "BODY")?.text || "";
    // Match variables {{1}}, {{2}}
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    
    // Auto-fill common fields (Var 1 = Customer Name, Var 2 = app link)
    const defaults = new Array(matches.length).fill("");
    if (defaults.length > 0) {
      defaults[0] = activeConv?.customerName || "Customer";
    }
    if (defaults.length > 1) {
      defaults[1] = "app.zicabella.com";
    }
    setTemplateVariables(defaults);
  };

  // Trigger Send Template API call
  const handleSendTemplate = async () => {
    if (!activePhone || !selectedTemplate) return;

    setSending(true);
    const toastId = toast.loading("Dispatching WhatsApp template campaign...");
    try {
      // Build variable parameters array
      const parameters = templateVariables.map(val => ({
        type: "text",
        text: val.trim() || "Value"
      }));

      const components: any[] = [];
      if (parameters.length > 0) {
        components.push({
          type: "body",
          parameters
        });
      }

      // Check if image header is required
      const headerComp = selectedTemplate.components?.find((c: any) => c.type === "HEADER");
      if (headerComp?.format === "IMAGE") {
        components.push({
          type: "header",
          parameters: [{
            type: "image",
            image: {
              link: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400"
            }
          }]
        });
      }

      const res = await fetch("/api/whatsapp/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activePhone,
          templateName: selectedTemplate.name,
          components,
          text: selectedTemplate.components?.find((c: any) => c.type === "BODY")?.text
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(prev => [...prev, data.message]);
        setShowTemplateModal(false);
        setSelectedTemplate(null);
        setRefreshTrigger(p => p + 1);
        toast.success("Template sent successfully!", { id: toastId });
      } else {
        toast.error(data.error || "Failed to send template message.", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error sending template.", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // Open Shopify Products Catalog List
  const handleOpenCatalog = async () => {
    setShowCatalogModal(true);
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/shopify/products?pageSize=40");
      const data = await res.json();
      if (res.ok && data.products) {
        setProductsList(data.products);
      } else {
        toast.error("Failed to load shopify products catalog.");
      }
    } catch (err) {
      toast.error("Error connection to Shopify Products API.");
    } finally {
      setLoadingProducts(false);
    }
  };

  // Send selected Shopify product directly to chat
  const handleSendProduct = async (product: any) => {
    if (!activePhone) return;

    setSending(true);
    const toastId = toast.loading("Sending catalog product details...");
    
    // Construct premium formatted catalog text
    const productPrice = product.variants?.[0]?.price || "N/A";
    const productUrl = `https://app.zicabella.com/products/${product.handle || product.id}`;
    
    const messageBody = `*Check out this product from Zica Bella!* \n\n*${product.title}*\nPrice: ${productPrice} INR\n\nShop online now:\n${productUrl}`;
    const firstImage = product.image?.src || (product.images?.[0]?.src) || null;

    try {
      const res = await fetch("/api/whatsapp/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activePhone,
          text: messageBody,
          mediaUrl: firstImage,
          mediaType: firstImage ? "image" : undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(prev => [...prev, data.message]);
        setShowCatalogModal(false);
        setRefreshTrigger(p => p + 1);
        toast.success("Catalog product sent!", { id: toastId });
      } else {
        toast.error(data.error || "Failed to send product.", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error sending catalog message.", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // Handle standard message form dispatch
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePhone || (!messageText.trim() && !mediaUrl.trim())) return;

    setSending(true);
    const textToSend = messageText;
    const urlToSend = mediaUrl;
    
    setMessageText("");
    setMediaUrl("");
    setShowMediaInput(false);

    try {
      const res = await fetch("/api/whatsapp/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activePhone,
          text: textToSend || undefined,
          mediaUrl: urlToSend || undefined,
          mediaType: urlToSend ? "image" : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(prev => [...prev, data.message]);
        setRefreshTrigger(p => p + 1);
      } else {
        toast.error(data.error || "Failed to send message.");
        setMessageText(textToSend); // Restore
        setMediaUrl(urlToSend);
        if (urlToSend) setShowMediaInput(true);
      }
    } catch (err: any) {
      toast.error("Network error sending message.");
      setMessageText(textToSend); // Restore
      setMediaUrl(urlToSend);
      if (urlToSend) setShowMediaInput(true);
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />;
      case "sent":
        return <Check className="w-3.5 h-3.5 text-zinc-400" />;
      case "failed":
        return <span title="Delivery failed"><AlertCircle className="w-3.5 h-3.5 text-rose-500" /></span>;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-500 animate-pulse" />;
    }
  };

  // Render message bubble content with image previews
  const renderMessageContent = (m: Message) => {
    const isInbound = m.direction === "inbound";
    const mUrl = m.mediaUrl || "";
    const mType = m.mediaType || "";

    const isImg = mType === "image" || (m.body && (m.body.startsWith("[Media: image]") || m.body.startsWith("http") && /\.(jpeg|jpg|gif|png|webp)/i.test(m.body)));
    const actualImgUrl = mUrl || (m.body && m.body.startsWith("[Media: image]") ? m.body.replace("[Media: image]", "").trim() : (m.body && m.body.startsWith("http") ? m.body : ""));

    return (
      <div key={m.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm space-y-1.5 ${
          isInbound 
            ? "bg-foreground/5 border border-foreground/10 rounded-tl-none text-foreground/90" 
            : "bg-emerald-500 text-foreground rounded-tr-none"
        }`}>
          {isImg && actualImgUrl ? (
            <div className="space-y-2">
              <img 
                src={actualImgUrl} 
                alt="Chat Attachment" 
                className="max-w-xs max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                onClick={() => window.open(actualImgUrl, '_blank')}
              />
              {m.body && !m.body.startsWith("[Media: image]") && !m.body.startsWith("http") && (
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
          )}
          <div className="flex items-center justify-end gap-1.5 text-[9px] opacity-60">
            <span>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isInbound && getStatusIcon(m.status)}
          </div>
        </div>
      </div>
    );
  };

  const filteredConversations = conversations.filter(c => {
    const query = searchQuery.toLowerCase();
    const nameMatch = c.customerName?.toLowerCase().includes(query) || false;
    const phoneMatch = c.phoneNumber.includes(query);
    return nameMatch || phoneMatch;
  });

  const filteredProducts = productsList.filter(p => 
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-170px)] overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Live Chat</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time customer support chat. Respond directly to incoming customer messages.
          </p>
        </div>

        <button 
          onClick={() => setRefreshTrigger(p => p + 1)}
          className="p-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10 rounded-xl transition-all"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Panel grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 rounded-2xl overflow-hidden border border-foreground/10 glass-card">
        
        {/* Left Side: Conversations List */}
        <div className="border-r border-foreground/10 flex flex-col h-full bg-background/20 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-foreground/10 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-emerald-500/50 text-sm"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-foreground/5 custom-scrollbar">
            {loadingConversations ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No active conversations found.
              </div>
            ) : (
              filteredConversations.map(c => {
                const isActive = activePhone === c.phoneNumber;
                return (
                  <button
                    key={c.phoneNumber}
                    onClick={() => setActivePhone(c.phoneNumber)}
                    className={`w-full p-4 text-left flex items-start justify-between gap-3 transition-colors ${
                      isActive 
                        ? "bg-foreground/10 border-l-2 border-emerald-500" 
                        : "hover:bg-foreground/5"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-foreground/90 block truncate">
                          {c.customerName || `Customer (+${c.phoneNumber})`}
                        </span>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {c.lastMessage.direction === "outbound" && "You: "}
                          {c.lastMessage.body}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {c.unreadCount > 0 ? (
                        <span className="bg-emerald-500 text-foreground font-extrabold text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {c.unreadCount}
                        </span>
                      ) : (
                        c.lastMessage.direction === "outbound" && getStatusIcon(c.lastMessage.status)
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat Message Thread */}
        <div className="lg:col-span-2 flex flex-col h-full bg-background/5 overflow-hidden">
          {activePhone ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-foreground/10 bg-background/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {activeConv?.customerName || "Unregistered Customer"}
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">+{activePhone}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeConv?.customerEmail && (
                    <span className="text-[10px] bg-foreground/5 text-muted-foreground border border-foreground/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span>{activeConv.customerEmail}</span>
                    </span>
                  )}
                  {activeConv?.whatsappOptedOut && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold font-mono">
                      <ShieldAlert className="w-3 h-3" />
                      <span>OPTED OUT</span>
                    </span>
                  )}
                  {activeConv?.customerId && (
                    <a
                      href={`/dashboard/customers/${activeConv.customerId}`}
                      target="_blank"
                      className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>View Profile</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* 24h Customer Service Window Alert */}
              <div className={`px-4 py-2 border-b text-[11px] flex items-center justify-between gap-3 shrink-0 ${
                isServiceWindowActive() 
                  ? "bg-emerald-500/10 border-emerald-500/10 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/10 text-rose-400"
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isServiceWindowActive() 
                      ? `24-Hour Customer Care Window: Active (${serviceWindowHoursRemaining()} hours remaining to reply)` 
                      : "24-Hour Customer Care Window: Expired. You can only reply with pre-approved WhatsApp Templates."}
                  </span>
                </div>
                {!isServiceWindowActive() && (
                  <button 
                    onClick={handleOpenTemplates}
                    className="underline text-[10px] font-bold hover:text-rose-300 flex items-center gap-1 shrink-0"
                  >
                    <span>Use Meta Templates</span>
                    <Sparkles className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-zinc-950/20">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCcw className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground text-xs p-8">
                    No conversation history found. Type a message below to start chatting.
                  </div>
                ) : (
                  messages.map(m => renderMessageContent(m))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-4 border-t border-foreground/10 bg-background/25 shrink-0 flex flex-col gap-2">
                {/* Media Attachment Preview (if any) */}
                {mediaUrl && (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-xs gap-3">
                    <div className="flex items-center gap-2 truncate">
                      <img src={mediaUrl} alt="Thumbnail preview" className="w-10 h-10 object-cover rounded-lg border border-foreground/10 shrink-0" />
                      <span className="text-[11px] text-emerald-400 font-mono truncate">{mediaUrl}</span>
                    </div>
                    <button 
                      onClick={() => setMediaUrl("")} 
                      className="p-1 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Clear image preview"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {/* Catalog dispatch selector */}
                    <button
                      type="button"
                      onClick={handleOpenCatalog}
                      className="p-2.5 rounded-xl border bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all shrink-0"
                      title="Send Catalog Product"
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-500" />
                    </button>

                    {/* Pre-approved Meta Templates Selector */}
                    <button
                      type="button"
                      onClick={handleOpenTemplates}
                      className="p-2.5 rounded-xl border bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all shrink-0"
                      title="Send Meta Approved Template"
                    >
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </button>

                    {/* Image Attachment (Upload or Link) */}
                    <button
                      type="button"
                      onClick={() => setShowMediaInput(p => !p)}
                      className={`p-2.5 rounded-xl border transition-all shrink-0 ${
                        showMediaInput 
                          ? "bg-emerald-500/20 border-emerald-500/20 text-emerald-500" 
                          : "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      }`}
                      title="Attach Image Link / File Upload"
                    >
                      <Image className="w-4 h-4" />
                    </button>

                    {/* Hidden file selector trigger */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    
                    <input
                      type="text"
                      placeholder={
                        activeConv?.whatsappOptedOut 
                          ? "Customer has opted out. Send blocked." 
                          : isServiceWindowActive() 
                          ? "Type your customer reply message..." 
                          : "Care window expired. Select a template campaign instead."
                      }
                      disabled={sending || activeConv?.whatsappOptedOut === true}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!messageText.trim() && !mediaUrl.trim()) || activeConv?.whatsappOptedOut === true}
                      className="bg-emerald-500 text-foreground p-2.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {sending ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {showMediaInput && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row gap-2 bg-foreground/[0.02] border border-foreground/10 p-3 rounded-xl"
                    >
                      <div className="flex-1 flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste public image URL here..."
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-1.5 outline-none focus:border-emerald-500/50 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[10px] text-muted-foreground uppercase">or</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 rounded-lg text-xs font-semibold text-foreground/80 border border-foreground/10 transition-colors"
                        >
                          {uploading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>Upload File</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <h3 className="font-semibold text-foreground/80 mb-1">Select a Conversation</h3>
              <p className="text-xs max-w-sm">
                Pick a conversation thread from the left menu to view history and chat with the customer.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ──────────────── MODALS ──────────────── */}
      
      {/* 1. Meta Template Select Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-background border border-foreground/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex justify-between items-center p-4 border-b border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h3 className="font-bold text-sm text-foreground">Select WhatsApp Template</h3>
                </div>
                <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(null); }} className="p-1 hover:bg-foreground/5 rounded-lg text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {selectedTemplate ? (
                  // Configure Variables View
                  <div className="space-y-4">
                    <button 
                      onClick={() => setSelectedTemplate(null)}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      ← Back to template list
                    </button>

                    <div className="p-3 bg-foreground/[0.02] border border-foreground/10 rounded-xl space-y-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="font-bold font-mono">TEMPLATE: {selectedTemplate.name}</span>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono uppercase font-bold">{selectedTemplate.category}</span>
                      </div>
                      <div className="bg-background/50 p-3 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedTemplate.components?.find((c: any) => c.type === "BODY")?.text}
                      </div>
                    </div>

                    {templateVariables.length > 0 ? (
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold text-foreground/80 block">Configure Parameters</span>
                        {templateVariables.map((val, idx) => (
                          <div key={idx} className="space-y-1">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Variable {idx + 1}</label>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => {
                                const copy = [...templateVariables];
                                copy[idx] = e.target.value;
                                setTemplateVariables(copy);
                              }}
                              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500/50"
                              placeholder={`Enter value for {{${idx + 1}}}`}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs">
                        <Info className="w-4 h-4" />
                        <span>This template has no dynamic variables. Ready to dispatch.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  // Templates Search / Grid View
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search approved templates..."
                        onChange={(e) => {
                          const query = e.target.value.toLowerCase();
                          // Filter inline
                        }}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-emerald-500/50 text-xs"
                      />
                    </div>

                    {loadingTemplates ? (
                      <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /></div>
                    ) : templatesList.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">No approved templates found in WABA profile.</div>
                    ) : (
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                        {templatesList.map((t: any) => (
                          <button
                            key={t.name}
                            onClick={() => handleSelectTemplate(t)}
                            className="w-full text-left p-3 border border-foreground/5 hover:border-foreground/10 hover:bg-foreground/5 rounded-xl transition-all flex justify-between items-center gap-3"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-foreground block truncate">{t.name}</span>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {t.components?.find((c: any) => c.type === "BODY")?.text}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div className="p-4 border-t border-foreground/5 bg-foreground/[0.01] flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={() => setSelectedTemplate(null)} 
                    className="px-4 py-2 hover:bg-foreground/5 border border-transparent rounded-xl text-xs font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendTemplate}
                    disabled={sending}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-foreground font-semibold rounded-xl text-xs flex items-center gap-2"
                  >
                    {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Dispatch Template</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Catalog / Products Selector Modal */}
      <AnimatePresence>
        {showCatalogModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-background border border-foreground/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex justify-between items-center p-4 border-b border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-bold text-sm text-foreground">Select Catalog Product</h3>
                </div>
                <button onClick={() => setShowCatalogModal(false)} className="p-1 hover:bg-foreground/5 rounded-lg text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              {/* Search bar */}
              <div className="p-4 border-b border-foreground/5 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search Shopify inventory catalog..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-emerald-500/50 text-xs"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loadingProducts ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /></div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No products found.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto custom-scrollbar">
                    {filteredProducts.map((p: any) => {
                      const firstImg = p.image?.src || (p.images?.[0]?.src) || null;
                      const price = p.variants?.[0]?.price || "N/A";
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSendProduct(p)}
                          className="border border-foreground/5 hover:border-emerald-500/20 hover:bg-foreground/5 p-3 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 text-left group"
                        >
                          <div className="space-y-2">
                            {firstImg ? (
                              <img src={firstImg} alt={p.title} className="w-full h-24 object-cover rounded-lg border border-foreground/10 group-hover:scale-[1.02] transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-24 bg-foreground/10 rounded-lg flex items-center justify-center text-[10px] text-muted-foreground">No Photo</div>
                            )}
                            <span className="font-semibold text-xs text-foreground/90 block truncate leading-tight mt-1">{p.title}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">{price} INR</span>
                            <span className="text-[9px] text-emerald-500 font-semibold group-hover:underline">Send →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
