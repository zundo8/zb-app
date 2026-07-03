"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Search, Send, RefreshCcw, User, Phone, 
  Mail, ShieldAlert, Check, CheckCheck, Clock, AlertCircle, Image, 
  ChevronRight, ArrowLeftRight, ExternalLink, UserCheck
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

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePhone || (!messageText.trim() && !mediaUrl.trim())) return;

    setSending(true);
    const textToSend = messageText;
    setMessageText("");
    setMediaUrl("");
    setShowMediaInput(false);

    try {
      const res = await fetch("/api/whatsapp/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activePhone,
          text: textToSend
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Append locally immediately
        setMessages(prev => [...prev, data.message]);
        setRefreshTrigger(p => p + 1);
      } else {
        toast.error(data.error || "Failed to send message.");
        setMessageText(textToSend); // Restore text
      }
    } catch (err: any) {
      toast.error("Network error sending message.");
      setMessageText(textToSend); // Restore text
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

  const filteredConversations = conversations.filter(c => {
    const query = searchQuery.toLowerCase();
    const nameMatch = c.customerName?.toLowerCase().includes(query) || false;
    const phoneMatch = c.phoneNumber.includes(query);
    return nameMatch || phoneMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

      {/* Main Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh] rounded-2xl overflow-hidden border border-foreground/10 glass-card">
        
        {/* Left Side: Conversations List */}
        <div className="border-r border-foreground/10 flex flex-col h-full bg-background/20">
          {/* Search bar */}
          <div className="p-4 border-b border-foreground/10">
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
                        ? "bg-foreground/10" 
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
        <div className="lg:col-span-2 flex flex-col h-full bg-background/5">
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
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
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
                  <a 
                    href="/dashboard/marketing/whatsapp" 
                    className="underline text-[10px] font-bold hover:text-rose-300 flex items-center gap-1 shrink-0"
                  >
                    <span>Send Template Campaign</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCcw className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground text-xs p-8">
                    No conversation history found. Type a message below to start chatting.
                  </div>
                ) : (
                  messages.map(m => {
                    const isInbound = m.direction === "inbound";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                      >
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm space-y-1 ${
                          isInbound 
                            ? "bg-foreground/5 border border-foreground/10 rounded-tl-none text-foreground/90" 
                            : "bg-emerald-500 text-foreground rounded-tr-none"
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                          <div className="flex items-center justify-end gap-1.5 text-[9px] opacity-60">
                            <span>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isInbound && getStatusIcon(m.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-4 border-t border-foreground/10 bg-background/25 shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMediaInput(p => !p)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        showMediaInput 
                          ? "bg-emerald-500/20 border-emerald-500/20 text-emerald-500" 
                          : "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      }`}
                      title="Attach Image Link"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    
                    <input
                      type="text"
                      placeholder={
                        activeConv?.whatsappOptedOut 
                          ? "Customer has opted out. Send blocked." 
                          : isServiceWindowActive() 
                          ? "Type your customer reply message..." 
                          : "Care window expired. Select a template campaign instead."
                      }
                      disabled={sending || activeConv?.whatsappOptedOut === true || !isServiceWindowActive()}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!messageText.trim() && !mediaUrl.trim()) || activeConv?.whatsappOptedOut === true || !isServiceWindowActive()}
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
                      className="flex gap-2"
                    >
                      <input
                        type="url"
                        placeholder="Paste image URL here..."
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500/50 text-sm"
                      />
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
    </div>
  );
}
