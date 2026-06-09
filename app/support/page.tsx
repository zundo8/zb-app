'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  MessageSquare, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Lock, 
  ShieldAlert,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SupportPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'form' | 'chat' | 'delete'>('form');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isMobileApp, setIsMobileApp] = useState(false);
  
  // Account Deletion Request States
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [existingDeletionTicket, setExistingDeletionTicket] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Detect mobile app environment via URL parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('platform') === 'mobile' || params.get('app') === 'true') {
        setIsMobileApp(true);
      }
    }
  }, []);

  // Prefill details if user is logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setFormData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || ''
      }));
      fetchExistingDeletionTicket();
    }
  }, [status, session]);

  // Fetch active messages or polling for chat
  useEffect(() => {
    if (activeTab === 'chat' && ticketId) {
      scrollToBottom();
      const interval = setInterval(fetchMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab, ticketId]);

  const fetchExistingDeletionTicket = async () => {
    const customerId = (session as any)?.customer?.id || (session?.user as any)?.id;
    if (!customerId) return;
    try {
      const res = await fetch(`/api/support/tickets?customerId=${customerId}`);
      const data = await res.json();
      if (data.tickets) {
        const delTicket = data.tickets.find(
          (t: any) => t.subject.startsWith('[ACCOUNT_DELETION]') && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
        );
        if (delTicket) {
          setExistingDeletionTicket(delTicket);
        }
      }
    } catch (e) {
      console.error('Failed to fetch existing deletion request:', e);
    }
  };

  const fetchMessages = async () => {
    if (!ticketId) return;
    try {
      const res = await fetch(`/api/support/tickets?ticketId=${ticketId}`);
      const data = await res.json();
      if (data.tickets && data.tickets[0]) {
        setChatMessages(data.tickets[0].messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const customerId = (session as any)?.customer?.id || (session?.user as any)?.id || null;

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          guestName: formData.name,
          guestEmail: formData.email,
          subject: formData.subject,
          content: formData.message,
          priority: 'MEDIUM'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTicketId(data.ticket.id);
        setChatMessages(data.ticket.messages);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
        setActiveTab('chat');
      } else {
        alert(data.error || 'Failed to submit ticket');
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticketId) return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          content: messageContent,
          senderType: 'USER',
          senderName: formData.name || 'User'
        })
      });

      if (res.ok) {
        fetchMessages();
      }
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  // Submit Account Deletion Request
  const handleDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmDelete) return;
    setLoading(true);

    const customerId = (session as any)?.customer?.id || (session?.user as any)?.id;
    if (!customerId) return;

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          guestName: session.user?.name || 'Customer',
          guestEmail: session.user?.email || 'Logged-in User',
          subject: `[ACCOUNT_DELETION] Request from ${session.user?.name || customerId}`,
          content: `Account Deletion Request.\nReason: ${deleteReason || 'Not provided'}\nCheckbox Confirmation: Verified.`,
          priority: 'HIGH'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTicketId(data.ticket.id);
        setChatMessages(data.ticket.messages);
        setExistingDeletionTicket(data.ticket);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
        setActiveTab('chat');
      } else {
        alert(data.error || 'Failed to submit account deletion request.');
      }
    } catch (error) {
      alert('Network error submitting deletion request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 font-sans relative overflow-x-hidden">
      
      {/* Background Animated Gradient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[140px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[140px] animate-pulse delay-1000" style={{ animationDuration: '10s' }} />
      </div>

      <main className={`relative z-10 max-w-7xl mx-auto px-4 md:px-8 ${isMobileApp ? 'pt-6 pb-12' : 'pt-24 md:pt-32 pb-24'}`}>
        
        {/* Title Identity */}
        {!isMobileApp && (
          <div className="text-center mb-16">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 bg-gradient-to-b from-foreground to-foreground/40 bg-clip-text text-transparent"
            >
              SUPPORT CENTER
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.2 }}
              className="text-foreground/60 text-xs md:text-sm uppercase tracking-[0.25em]"
            >
              How can we assist you today?
            </motion.p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Info Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-1 space-y-6"
          >
            <div className="p-6 md:p-8 rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent pointer-events-none" />
              
              <h2 className="text-lg font-bold mb-8 uppercase tracking-widest text-foreground/95">Get In Touch</h2>
              
              <div className="space-y-6">
                
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 text-foreground/70">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] text-foreground/30 uppercase tracking-widest mb-0.5">Email Support</p>
                    <p className="text-foreground/80 text-sm font-medium">support@zicabella.com</p>
                    <p className="text-foreground/40 text-xs mt-1">Average response within 24h</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 text-foreground/70">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] text-foreground/30 uppercase tracking-widest mb-0.5">Helpline</p>
                    <p className="text-foreground/80 text-sm font-medium">+91 (800) ZICA-BELA</p>
                    <p className="text-foreground/40 text-xs mt-1">Mon - Sat: 10AM - 7PM IST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 text-foreground/70">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] text-foreground/30 uppercase tracking-widest mb-0.5">HQ Location</p>
                    <p className="text-foreground/80 text-sm font-medium">Bengaluru, KA, India</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-5 rounded-2xl bg-blue-500/[0.02] border border-blue-500/10">
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Knowledge Base</p>
                <p className="text-foreground/50 text-xs leading-relaxed">
                  Have quick queries? Look at our <a href="/faq" className="text-foreground border-b border-foreground/20 hover:border-foreground transition-colors">FAQ section</a> first.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Interaction Card Area */}
          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="h-full min-h-[580px] rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] backdrop-blur-3xl shadow-2xl overflow-hidden flex flex-col relative">
              <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.01] to-transparent pointer-events-none" />
              
              {/* Tab Navigation */}
              <div className="flex border-b border-foreground/5 p-2 bg-foreground/[0.01] relative z-10">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'form' ? 'bg-foreground/5 text-foreground border border-foreground/5' : 'text-foreground/40 hover:text-foreground/75'
                  }`}
                >
                  Message Us
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'chat' ? 'bg-foreground/5 text-foreground border border-foreground/5' : 'text-foreground/40 hover:text-foreground/75'
                  }`}
                >
                  Live Chat
                </button>
                <button
                  onClick={() => setActiveTab('delete')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'delete' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-foreground/40 hover:text-rose-400/80'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Account deletion
                </button>
              </div>

              {/* Interaction Content Area */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto relative z-10">
                
                <AnimatePresence mode="wait">
                  
                  {/* TAB 1: Support Message Form */}
                  {activeTab === 'form' && (
                    <motion.div
                      key="form-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 max-w-xl mx-auto"
                    >
                      {success && (
                        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-semibold">Message sent! Switching to live support chat...</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Name</label>
                            <input
                              required
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                              placeholder="Enter your name"
                            />
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Email Address</label>
                            <input
                              required
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                              placeholder="Enter your email"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Subject</label>
                          <input
                            required
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                            placeholder="Reason for inquiry"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Message Description</label>
                          <textarea
                            required
                            rows={5}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground resize-none"
                            placeholder="Detail your request..."
                          />
                        </div>

                        <button
                          disabled={loading}
                          type="submit"
                          className="w-full py-4.5 rounded-2xl bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2 mt-4 shadow-lg shadow-black/5"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Submit Support Request</>}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* TAB 2: Live Chat */}
                  {activeTab === 'chat' && (
                    <motion.div
                      key="chat-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="h-full flex flex-col"
                    >
                      {!ticketId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
                          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.02] border border-foreground/5 flex items-center justify-center mb-2">
                            <MessageSquare className="w-6 h-6 text-foreground/30" />
                          </div>
                          <h3 className="text-base font-semibold">Active Session Required</h3>
                          <p className="text-foreground/40 text-xs max-w-xs mx-auto leading-relaxed">
                            Please submit a support message first. Once submitted, you can chat with our support team live.
                          </p>
                          <button
                            onClick={() => setActiveTab('form')}
                            className="mt-2 px-6 py-2.5 rounded-full bg-foreground/5 border border-foreground/5 hover:bg-foreground/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            Create a Ticket
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col min-h-[440px]">
                          {/* Messages list */}
                          <div className="flex-1 space-y-4 pb-4 overflow-y-auto max-h-[360px] custom-scrollbar">
                            {chatMessages.length === 0 ? (
                              <div className="flex items-center justify-center h-32 text-foreground/30 text-xs">
                                No messages yet...
                              </div>
                            ) : (
                              chatMessages.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`flex ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[75%] p-4 rounded-2xl ${
                                      msg.senderType === 'USER'
                                        ? 'bg-foreground/[0.06] text-foreground border border-foreground/10 rounded-tr-none'
                                        : 'bg-foreground text-background rounded-tl-none font-medium'
                                    }`}
                                  >
                                    <p className="text-xs leading-relaxed">{msg.content}</p>
                                    <p className={`text-[8px] mt-2 uppercase tracking-tighter ${msg.senderType === 'USER' ? 'text-foreground/45' : 'text-background/50'}`}>
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Message Input form */}
                          <form onSubmit={handleSendMessage} className="mt-4 relative">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message..."
                              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-foreground/20 transition-all text-xs text-foreground"
                            />
                            <button
                              type="submit"
                              disabled={!newMessage.trim()}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* TAB 3: Account Deletion */}
                  {activeTab === 'delete' && (
                    <motion.div
                      key="delete-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 max-w-xl mx-auto"
                    >
                      {status === 'unauthenticated' ? (
                        // Not Logged In
                        <div className="text-center py-12 space-y-6">
                          <div className="w-16 h-16 rounded-[1.25rem] bg-rose-500/5 border border-rose-500/10 flex items-center justify-center mx-auto mb-2 text-rose-500">
                            <Lock className="w-7 h-7 animate-pulse" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-base font-semibold uppercase tracking-wider">Authentication Required</h3>
                            <p className="text-foreground/40 text-xs max-w-xs mx-auto leading-relaxed">
                              You must be logged in to your account to initiate a deletion request.
                            </p>
                          </div>
                          <button
                            onClick={() => window.location.href = `/login?callbackUrl=/support?tab=delete`}
                            className="px-8 py-3.5 rounded-2xl bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all active:scale-95 shadow-lg"
                          >
                            Sign In to Zica Bella
                          </button>
                        </div>
                      ) : (
                        // Logged In Deletion Form
                        <div className="space-y-6">
                          
                          {existingDeletionTicket ? (
                            // Existing active deletion request
                            <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] space-y-5 text-center">
                              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-rose-400">Deletion Request Pending</h4>
                                <p className="text-foreground/45 text-xs">
                                  We have received your account deletion request.
                                </p>
                              </div>
                              <div className="p-4 rounded-xl bg-foreground/[0.02] border border-foreground/5 text-left text-xs text-foreground/70 space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-foreground/40 uppercase tracking-wider text-[9px]">Request ID:</span>
                                  <span className="font-bold text-[10px] text-foreground/80">#{existingDeletionTicket.id.slice(-8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-foreground/40 uppercase tracking-wider text-[9px]">Status:</span>
                                  <span className="font-bold text-[10px] text-yellow-500 uppercase tracking-widest">{existingDeletionTicket.status}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-foreground/40 uppercase tracking-wider text-[9px]">Submitted:</span>
                                  <span className="font-bold text-[10px] text-foreground/80">{new Date(existingDeletionTicket.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-foreground/40 leading-relaxed">
                                You can message support in the <button onClick={() => { setTicketId(existingDeletionTicket.id); setChatMessages(existingDeletionTicket.messages); setActiveTab('chat'); }} className="text-blue-400 border-b border-blue-400/20 hover:text-blue-300">Live Chat</button> tab to follow up.
                              </p>
                            </div>
                          ) : (
                            // New deletion form
                            <form onSubmit={handleDeleteRequest} className="space-y-6">
                              <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] flex gap-4">
                                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-rose-400">Important Security Notice</h4>
                                  <p className="text-foreground/50 text-[11px] leading-relaxed">
                                    Account deletion is permanent. Once completed, your profile history, addresses, unused store credits, wishlists, order receipts, and community memberships are completely purged.
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                  <input
                                    required
                                    type="checkbox"
                                    id="confirmDelete"
                                    checked={confirmDelete}
                                    onChange={(e) => setConfirmDelete(e.target.checked)}
                                    className="w-4 h-4 rounded border-foreground/10 bg-foreground/5 mt-0.5 accent-rose-500"
                                  />
                                  <label htmlFor="confirmDelete" className="text-foreground/70 text-xs select-none leading-relaxed">
                                    I understand that this action is irreversible and request the permanent deletion of my personal user data.
                                  </label>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Reason for leaving (Optional)</label>
                                <textarea
                                  rows={4}
                                  value={deleteReason}
                                  onChange={(e) => setDeleteReason(e.target.value)}
                                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-xs text-foreground resize-none"
                                  placeholder="Help us improve. Why are you deleting your account?"
                                />
                              </div>

                              <button
                                disabled={loading || !confirmDelete}
                                type="submit"
                                className="w-full py-4.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 flex justify-center items-center gap-2 mt-4 shadow-lg shadow-rose-950/25"
                              >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Submit Deletion Request</>}
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* footer */}
      {!isMobileApp && (
        <footer className="relative z-10 border-t border-foreground/5 py-12 px-6 bg-background">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-xl font-black tracking-[0.4em] text-foreground">ZICA BELLA</div>
            <p className="text-foreground/20 text-[9px] uppercase tracking-[0.3em]">
              © 2026 Zica Bella Private Limited. All rights reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
