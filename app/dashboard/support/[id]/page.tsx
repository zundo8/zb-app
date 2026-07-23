'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Clock, CheckCircle2, AlertCircle, Loader2, ArrowLeft, MoreHorizontal, User, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleAiAutoReply = async () => {
    if (!ticket) return;
    const nextVal = ticket.aiAutoReply === false ? true : false;
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          aiAutoReply: nextVal
        })
      });
      if (res.ok) {
        setTicket({ ...ticket, aiAutoReply: nextVal });
      }
    } catch (err) {
      console.error('Failed to toggle AI Auto-Reply:', err);
    }
  };

  const handleApproveDeletion = async () => {
    if (!ticket || !ticket.customerId) {
      alert("Error: This ticket doesn't have an associated Customer ID.");
      return;
    }
    const confirmed = confirm(
      `WARNING: Are you absolutely sure you want to approve this account deletion request?\n\nThis will permanently delete the customer "${ticket.guestName || 'Anonymous'}" and ALL of their associated data (orders, address, messages, payments). This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/admin/support/delete-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: ticket.customerId,
          ticketId: ticket.id,
        }),
      });

      if (res.ok) {
        alert('Account deletion request has been approved and user data completely purged.');
        router.push('/dashboard/support');
      } else {
        const data = await res.json();
        alert('Failed to delete customer: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/support/tickets?ticketId=${params.id}`);
      const data = await res.json();
      if (data.tickets && data.tickets[0]) {
        setTicket(data.tickets[0]);
      }
    } catch (error) {
      console.error('Failed to fetch ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 3000); // Snappy polling for live chat
    return () => clearInterval(interval);
  }, [params.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket) return;

    setSending(true);
    try {
      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          content: newMessage,
          senderType: 'AGENT',
          senderName: 'Zica Support'
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchTicket();
      }
    } catch (error) {
      console.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          status
        })
      });

      if (res.ok) {
        setTicket({ ...ticket, status });
      } else {
        const err = await res.json();
        alert('Failed to update status: ' + (err.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/40">Loading Ticket Details...</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold uppercase tracking-tighter mb-2">Ticket Not Found</h2>
        <button onClick={() => router.back()} className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest hover:text-foreground">Go Back</button>
      </div>
    );
  }

  return (
    <div className="pb-20 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="w-12 h-12 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.08] flex items-center justify-center hover:bg-foreground hover:text-background transition-all active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-tighter leading-none mb-2">
              {ticket.subject}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold px-3 py-0.5 rounded-full border border-foreground/[0.1] bg-foreground/[0.03] text-foreground/60 uppercase tracking-widest">
                ID: {ticket.id.slice(-8).toUpperCase()}
              </span>
              <span className={`text-[9px] font-bold px-3 py-0.5 rounded-full border uppercase tracking-widest ${
                ticket.status === 'OPEN' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {ticket.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleAiAutoReply}
            className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 transition-all ${
              ticket.aiAutoReply !== false
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                : 'bg-foreground/[0.03] border-foreground/[0.1] text-foreground/40 hover:bg-foreground/[0.08]'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${ticket.aiAutoReply !== false ? 'text-purple-400 animate-pulse' : 'text-foreground/30'}`} />
            <span>Zica AI Auto-Reply: {ticket.aiAutoReply !== false ? 'ON' : 'OFF'}</span>
          </button>

          <select 
            className="bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] focus:outline-none"
            value={ticket.status}
            onChange={(e) => updateStatus(e.target.value)}
          >
            <option value="OPEN">MARK AS OPEN</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-8 rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01]">
            <h3 className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-6">Customer Info</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center">
                  <User className="w-5 h-5 text-foreground/40" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground uppercase truncate">{ticket.guestName || 'Anonymous'}</p>
                  <p className="text-[9px] text-foreground/40 font-medium truncate lowercase">{ticket.guestEmail || 'Logged-in'}</p>
                </div>
              </div>
              
              <div className="pt-6 border-t border-foreground/[0.05] space-y-4">
                <div>
                  <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-[0.3em] mb-1">Created At</p>
                  <p className="text-[11px] font-bold text-foreground/60 uppercase">
                    {new Date(ticket.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-[0.3em] mb-1">Priority</p>
                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">{ticket.priority}</span>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-[0.3em] mb-1">AI Auto-Reply</p>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${ticket.aiAutoReply !== false ? 'text-purple-400' : 'text-foreground/30'}`}>
                    {ticket.aiAutoReply !== false ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Deletion approval box */}
          {ticket.subject?.startsWith('[ACCOUNT_DELETION]') && (
            <div className="glass-card p-8 rounded-[2.5rem] border border-rose-500/20 bg-rose-500/[0.02] space-y-4">
              <h3 className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.3em]">Account Deletion</h3>
              <p className="text-[11px] text-foreground/60 leading-relaxed uppercase tracking-wider">
                This is a formal request to permanently delete this customer account and purge all data.
              </p>
              <button
                disabled={deleting}
                onClick={handleApproveDeletion}
                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve & Purge Data'}
              </button>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          <div className="h-[600px] flex flex-col glass-card rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01] overflow-hidden">
            <div className="px-8 py-5 border-b border-foreground/[0.05] flex items-center justify-between bg-foreground/[0.01]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-[0.3em]">Live Support Session</span>
              </div>
              {ticket.aiAutoReply !== false && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  <span className="text-[8px] font-bold uppercase tracking-wider">Zica AI Auto-Reply Active</span>
                </div>
              )}
            </div>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-8">
              {ticket.messages.map((msg: any) => {
                const isAgent = msg.senderType === 'AGENT';
                const isAi = msg.senderType === 'ZICA_AI';

                return (
                  <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex flex-col gap-2 max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        {isAgent ? (
                          <>
                            <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">{msg.senderName || 'Support Agent'}</span>
                            <ShieldCheck className="w-3 h-3 text-blue-500" />
                          </>
                        ) : isAi ? (
                          <>
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">{msg.senderName || 'Zica AI'}</span>
                            <span className="text-[7px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase tracking-wider">AUTOREPLY</span>
                          </>
                        ) : (
                          <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">{msg.senderName || 'Customer'}</span>
                        )}
                      </div>
                      <div className={`p-4 rounded-3xl ${
                        isAgent 
                          ? 'bg-foreground text-background rounded-tr-none' 
                          : isAi
                          ? 'bg-purple-950/40 text-purple-100 border border-purple-500/20 rounded-tl-none font-medium'
                          : 'bg-foreground/[0.05] text-foreground border border-foreground/[0.05] rounded-tl-none'
                      }`}>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p className={`text-[8px] font-bold text-foreground/20 uppercase tracking-tighter ${isAgent ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="p-6 border-t border-foreground/[0.05] bg-foreground/[0.01]">
              <form onSubmit={handleSendMessage} className="relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="TYPE YOUR RESPONSE..."
                  rows={1}
                  className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-2xl pl-6 pr-20 py-5 text-[12px] font-medium focus:outline-none focus:border-foreground/20 transition-all resize-none overflow-hidden"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
