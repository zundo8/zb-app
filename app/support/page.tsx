'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Mail, 
  MapPin, 
  Send, 
  MessageSquare, 
  Loader2, 
  CheckCircle2, 
  Lock, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function SupportPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'form' | 'chat'>('form');
  const [loading, setLoading] = useState(false);
  const [fetchingTicket, setFetchingTicket] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isMobileApp, setIsMobileApp] = useState(false);

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
        name: session.user?.name || '',
        email: session.user?.email || ''
      }));
    }
  }, [status, session]);

  // Load session or handle tab parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const orderIdParam = searchParams.get('orderId');

    if (tabParam === 'chat') {
      setActiveTab('chat');
    }

    if (status === 'authenticated' && session?.user) {
      const customerId = (session as any)?.customer?.id || (session?.user as any)?.id;
      if (customerId) {
        handleLoadOrCreateTicket(customerId, orderIdParam);
      }
    }
  }, [status, session, searchParams]);

  // Fetch active messages or polling for chat
  useEffect(() => {
    if (activeTab === 'chat' && ticketId) {
      scrollToBottom();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, ticketId]);

  const handleLoadOrCreateTicket = async (customerId: string, orderIdParam: string | null) => {
    setFetchingTicket(true);
    try {
      const res = await fetch(`/api/support/tickets?customerId=${customerId}&status=OPEN`);
      const data = await res.json();
      if (data.tickets && data.tickets.length > 0) {
        const activeTicket = data.tickets[0];
        setTicketId(activeTicket.id);
        setChatMessages(activeTicket.messages || []);
      } else {
        const shouldAutoCreate = searchParams.get('tab') === 'chat' || orderIdParam;
        if (shouldAutoCreate) {
          const subject = orderIdParam 
            ? `Order Support #${orderIdParam.slice(-8).toUpperCase()}` 
            : 'Live Chat Support';
          
          const createRes = await fetch('/api/support/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId,
              guestName: session?.user?.name || 'Customer',
              guestEmail: session?.user?.email || 'Logged-in User',
              subject,
              content: `Live chat session initiated by user${orderIdParam ? ` for order #${orderIdParam}` : ''}.`,
              priority: orderIdParam ? 'HIGH' : 'MEDIUM'
            })
          });
          const createData = await createRes.json();
          if (createRes.ok && createData.ticket) {
            setTicketId(createData.ticket.id);
            setChatMessages(createData.ticket.messages || []);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load or create ticket:', e);
    } finally {
      setFetchingTicket(false);
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

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 font-sans relative overflow-x-hidden">
      
      {/* Background Animated Gradient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[140px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[140px] animate-pulse delay-1000" style={{ animationDuration: '10s' }} />
      </div>

      <main className={`relative z-10 max-w-7xl mx-auto px-4 md:px-8 ${isMobileApp ? 'pt-4 pb-12' : 'pt-24 md:pt-32 pb-24'}`}>
        
        {/* Title Identity */}
        {!isMobileApp && (
          <div className="text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-5xl font-bold tracking-tighter mb-3 bg-gradient-to-b from-foreground to-foreground/45 bg-clip-text text-transparent"
            >
              SUPPORT CENTER
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.2 }}
              className="text-foreground/60 text-xs md:text-sm uppercase tracking-[0.25em]"
            >
              How can we assist you today?
            </motion.p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Contact Info Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-1 space-y-4"
          >
            <div className="p-6 md:p-8 rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] dark:bg-white/[0.01] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent pointer-events-none" />
              
              <h2 className="text-sm font-bold mb-6 uppercase tracking-widest text-foreground/85">Get In Touch</h2>
              
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
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] text-foreground/30 uppercase tracking-widest mb-0.5">HQ Location</p>
                    <p className="text-foreground/80 text-sm font-medium">Bengaluru, KA, India</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-5 rounded-2xl bg-blue-500/[0.02] border border-blue-500/10">
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
            <div className="h-full min-h-[500px] md:min-h-[560px] rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] dark:bg-white/[0.01] backdrop-blur-3xl shadow-2xl overflow-hidden flex flex-col relative">
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
                  onClick={() => {
                    setActiveTab('chat');
                    if (status === 'authenticated' && session?.user && !ticketId) {
                      const customerId = (session as any)?.customer?.id || (session?.user as any)?.id;
                      if (customerId) {
                        handleLoadOrCreateTicket(customerId, null);
                      }
                    }
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'chat' ? 'bg-foreground/5 text-foreground border border-foreground/5' : 'text-foreground/40 hover:text-foreground/75'
                  }`}
                >
                  Live Chat
                </button>
              </div>

              {/* Interaction Content Area */}
              <div className="flex-1 p-5 md:p-8 flex flex-col relative z-10">
                
                <AnimatePresence mode="wait">
                  
                  {/* TAB 1: Support Message Form */}
                  {activeTab === 'form' && (
                    <motion.div
                      key="form-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 max-w-xl mx-auto w-full"
                    >
                      {success && (
                        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-semibold">Message sent! Switching to live support chat...</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Name</label>
                            <input
                              required
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/10 dark:border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                              placeholder="Enter your name"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Email Address</label>
                            <input
                              required
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="w-full bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/10 dark:border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                              placeholder="Enter your email"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Subject</label>
                          <input
                            required
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/10 dark:border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground"
                            placeholder="Reason for inquiry"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-foreground/30 uppercase tracking-widest ml-2">Message Description</label>
                          <textarea
                            required
                            rows={4}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/10 dark:border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-foreground/20 transition-all text-sm text-foreground resize-none"
                            placeholder="Detail your request..."
                          />
                        </div>

                        <button
                          disabled={loading}
                          type="submit"
                          className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2 mt-2 shadow-lg shadow-black/5"
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
                      className="flex-1 flex flex-col w-full h-full"
                    >
                      {fetchingTicket ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 gap-3">
                          <Loader2 className="w-6 h-6 text-foreground/35 animate-spin" />
                          <p className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] font-bold">Connecting to support session...</p>
                        </div>
                      ) : status === 'unauthenticated' && !ticketId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
                          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.02] border border-foreground/5 flex items-center justify-center mb-2">
                            <MessageSquare className="w-6 h-6 text-foreground/30" />
                          </div>
                          <h3 className="text-base font-semibold">Active Session Required</h3>
                          <p className="text-foreground/40 text-xs max-w-xs mx-auto leading-relaxed">
                            Sign in to access your persistent live chat and ticket history.
                          </p>
                          <button
                            onClick={() => router.push(`/login?callbackUrl=/support?tab=chat`)}
                            className="mt-2 px-6 py-2.5 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg"
                          >
                            Sign In
                          </button>
                          <div className="pt-4 text-foreground/25 text-[9px] uppercase tracking-[0.3em] font-semibold">Or guest chat</div>
                          <p className="text-foreground/45 text-[11px] max-w-xs mx-auto">
                            Submit a ticket in the <button onClick={() => setActiveTab('form')} className="text-blue-500/85 hover:text-blue-500 font-semibold underline decoration-dotted">Message Us</button> tab to start a guest chat session immediately.
                          </p>
                        </div>
                      ) : !ticketId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
                          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.02] border border-foreground/5 flex items-center justify-center mb-2">
                            <MessageSquare className="w-6 h-6 text-foreground/30" />
                          </div>
                          <h3 className="text-base font-semibold">Live Chat Support</h3>
                          <p className="text-foreground/40 text-xs max-w-xs mx-auto leading-relaxed">
                            No active support ticket found. Click below to initialize a live support chat session with an agent.
                          </p>
                          <button
                            onClick={() => {
                              const customerId = (session as any)?.customer?.id || (session?.user as any)?.id;
                              if (customerId) {
                                handleLoadOrCreateTicket(customerId, null);
                              }
                            }}
                            className="mt-2 px-6 py-2.5 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg"
                          >
                            Start Live Session
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col h-full justify-between">
                          {/* Messages list */}
                          <div className="flex-1 space-y-4 pb-4 overflow-y-auto h-[320px] md:h-[380px] pr-2 custom-scrollbar">
                            {chatMessages.length === 0 ? (
                              <div className="flex items-center justify-center h-32 text-foreground/35 text-xs font-medium">
                                Support session initialized. How can we help?
                              </div>
                            ) : (
                              chatMessages.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`flex ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className="flex flex-col gap-1 max-w-[80%]">
                                    <div className="flex items-center gap-1.5 px-1">
                                      {msg.senderType === 'AGENT' ? (
                                        <>
                                          <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">{msg.senderName || 'Zica Support'}</span>
                                          <ShieldCheck className="w-3 h-3 text-blue-500" />
                                        </>
                                      ) : (
                                        <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest">You</span>
                                      )}
                                    </div>
                                    <div
                                      className={`p-4 rounded-2xl ${
                                        msg.senderType === 'USER'
                                          ? 'bg-foreground/[0.05] text-foreground border border-foreground/10 rounded-tr-none'
                                          : 'bg-foreground text-background rounded-tl-none font-medium'
                                      }`}
                                    >
                                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    <p className={`text-[8px] font-bold text-foreground/20 uppercase tracking-tighter ${msg.senderType === 'USER' ? 'text-right' : 'text-left'}`}>
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
                              className="w-full bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/10 dark:border-white/10 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-foreground/20 transition-all text-xs text-foreground placeholder:text-foreground/30"
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
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </main>


    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/20" />
        <p className="text-[8px] text-foreground/30 font-black uppercase tracking-[0.3em]">Loading Support...</p>
      </div>
    }>
      <SupportPageContent />
    </Suspense>
  );
}
