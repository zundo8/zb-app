'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'chat'>('form');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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

  useEffect(() => {
    if (activeTab === 'chat' && ticketId) {
      scrollToBottom();
      const interval = setInterval(fetchMessages, 5000); // Poll for new messages
      return () => clearInterval(interval);
    }
  }, [activeTab, ticketId]);

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
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse delay-700" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            SUPPORT CENTER
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto uppercase tracking-[0.2em]">
            WE'RE HERE TO ASSIST YOU WITH ANY QUERIES
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <h2 className="text-xl font-semibold mb-8 uppercase tracking-widest">Contact Info</h2>
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <Mail className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 uppercase tracking-wider mb-1">Email Us</p>
                    <p className="text-white/80">support@zicabella.com</p>
                    <p className="text-white/80 text-sm mt-1">Response within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <Phone className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 uppercase tracking-wider mb-1">Call Us</p>
                    <p className="text-white/80">+91 (800) ZICA-BELA</p>
                    <p className="text-white/80 text-sm mt-1">Mon - Sat: 10AM - 7PM</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <MapPin className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 uppercase tracking-wider mb-1">Office</p>
                    <p className="text-white/80">Bengaluru, KA, India</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-sm text-blue-400 font-medium mb-2 uppercase tracking-widest">Self Service</p>
                <p className="text-white/60 text-sm leading-relaxed">
                  Visit our <a href="/faq" className="text-white border-b border-white/20 hover:border-white transition-colors">FAQ page</a> for instant answers to common questions.
                </p>
              </div>
            </div>
          </div>

          {/* Interaction Area */}
          <div className="lg:col-span-2">
            <div className="h-full min-h-[600px] rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-white/10 p-2">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`flex-1 py-4 px-6 rounded-2xl text-sm font-medium uppercase tracking-widest transition-all ${
                    activeTab === 'form' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Message Us
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-4 px-6 rounded-2xl text-sm font-medium uppercase tracking-widest transition-all ${
                    activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Live Chat
                </button>
              </div>

              <div className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'form' ? (
                  <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
                    {success && (
                      <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">Message sent successfully! Redirecting to chat...</span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] ml-2">Full Name</label>
                        <input
                          required
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-white/30 transition-colors"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] ml-2">Email Address</label>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-white/30 transition-colors"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] ml-2">Subject</label>
                      <input
                        required
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-white/30 transition-colors"
                        placeholder="Inquiry about my order"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] ml-2">Message</label>
                      <textarea
                        required
                        rows={6}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-white/30 transition-colors resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full py-5 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send Message</>}
                    </button>
                  </form>
                ) : (
                  <div className="h-full flex flex-col">
                    {!ticketId ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                          <MessageSquare className="w-8 h-8 text-white/40" />
                        </div>
                        <h3 className="text-xl font-medium">Start a Conversation</h3>
                        <p className="text-white/40 max-w-sm mx-auto">
                          Please submit the message form first so we can route your inquiry to the right agent.
                        </p>
                        <button
                          onClick={() => setActiveTab('form')}
                          className="mt-4 px-8 py-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all text-sm uppercase tracking-widest"
                        >
                          Go to Form
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col">
                        <div className="flex-1 space-y-6 pb-4">
                          {chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] p-4 rounded-3xl ${
                                  msg.senderType === 'USER'
                                    ? 'bg-white/10 text-white border border-white/10 rounded-tr-none'
                                    : 'bg-white text-black rounded-tl-none'
                                }`}
                              >
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-[8px] mt-2 uppercase tracking-tighter opacity-50`}>
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="mt-4 relative">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-16 py-5 focus:outline-none focus:border-white/30 transition-colors"
                          />
                          <button
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all active:scale-95"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-2xl font-black tracking-[0.4em]">ZICA BELLA</div>
          <p className="text-white/20 text-[10px] uppercase tracking-[0.3em]">
            © 2025 Zica Bella Private Limited. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
