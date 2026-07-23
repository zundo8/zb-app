'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Clock, CheckCircle2, AlertCircle, Search, Loader2, ArrowUpRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SupportDashboard() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zicaAiEnabled, setZicaAiEnabled] = useState(true);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/support/tickets');
      const data = await res.json();
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    try {
      const res = await fetch('/api/admin/ai/settings');
      const data = await res.json();
      if (res.ok && typeof data.zicaAiSupportEnabled === 'boolean') {
        setZicaAiEnabled(data.zicaAiSupportEnabled);
      }
    } catch (err) {
      console.error('Failed to fetch AI settings:', err);
    }
  };

  const handleToggleGlobalAi = async () => {
    const nextVal = !zicaAiEnabled;
    setZicaAiEnabled(nextVal);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zicaAiSupportEnabled: nextVal })
      });
      if (!res.ok) setZicaAiEnabled(!nextVal);
    } catch (err) {
      setZicaAiEnabled(!nextVal);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchAiSettings();
  }, []);

  const filteredTickets = tickets.filter(t => 
    ((t.subject || '').toLowerCase().includes(search.toLowerCase())) ||
    ((t.guestName || '').toLowerCase().includes(search.toLowerCase())) ||
    ((t.guestEmail || '').toLowerCase().includes(search.toLowerCase())) ||
    (t.id && t.id.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'RESOLVED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/40">Loading Tickets...</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-20 space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter leading-none">
            Support Center
          </h1>
          <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.3em]">
            Manage customer inquiries and live chat requests.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleToggleGlobalAi}
            className={`px-4 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 transition-all ${
              zicaAiEnabled
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                : 'bg-foreground/[0.03] border-foreground/[0.1] text-foreground/40 hover:bg-foreground/[0.08]'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${zicaAiEnabled ? 'text-purple-400 animate-pulse' : 'text-foreground/30'}`} />
            <span>Global Zica AI Support: {zicaAiEnabled ? 'ENABLED' : 'DISABLED'}</span>
          </button>

          <div className="relative group w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20 group-focus-within:text-foreground/60 transition-colors" />
            <input
              type="text"
              placeholder="SEARCH TICKETS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl pl-12 pr-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] focus:outline-none focus:border-foreground/20 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01]">
          <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em] mb-4">Total Tickets</p>
          <p className="text-4xl font-bold text-foreground tracking-tighter">{tickets.length}</p>
        </div>
        <div className="glass-card p-8 rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01]">
          <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em] mb-4">Open Tickets</p>
          <p className="text-4xl font-bold text-rose-500 tracking-tighter">{tickets.filter(t => t.status === 'OPEN').length}</p>
        </div>
        <div className="glass-card p-8 rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01]">
          <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em] mb-4">Resolved</p>
          <p className="text-4xl font-bold text-emerald-500 tracking-tighter">{tickets.filter(t => t.status === 'RESOLVED').length}</p>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] border border-foreground/[0.05] bg-foreground/[0.01] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-foreground/[0.05] bg-foreground/[0.02]">
              <th className="px-8 py-5 text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">Customer</th>
              <th className="px-8 py-5 text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">Subject</th>
              <th className="px-8 py-5 text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">Status</th>
              <th className="px-8 py-5 text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">AI Auto-Reply</th>
              <th className="px-8 py-5 text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em]">Last Activity</th>
              <th className="px-8 py-5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {filteredTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-foreground/[0.01] transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-[12px] font-bold">
                      {(ticket.guestName || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground uppercase leading-none mb-1.5">{ticket.guestName || 'Anonymous'}</p>
                      <p className="text-[10px] text-foreground/40 font-medium lowercase tracking-wider">{ticket.guestEmail || 'Logged-in User'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <p className="text-[13px] font-bold text-foreground truncate max-w-[200px] uppercase leading-none mb-1.5">{ticket.subject}</p>
                  <p className="text-[10px] text-foreground/40 font-medium truncate max-w-[200px] uppercase tracking-wider">
                    {ticket.messages[ticket.messages.length - 1]?.content}
                  </p>
                </td>
                <td className="px-8 py-6">
                  <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 w-fit ${
                    ticket.aiAutoReply !== false ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-foreground/5 text-foreground/30 border-foreground/10'
                  }`}>
                    <Sparkles className="w-3 h-3" />
                    <span>{ticket.aiAutoReply !== false ? 'ON' : 'OFF'}</span>
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-foreground/40">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {new Date(ticket.updatedAt).toLocaleDateString()} {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <Link 
                    href={`/dashboard/support/${ticket.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/5"
                  >
                    Manage <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTickets.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-12 h-12 text-foreground/5 mb-4" />
            <p className="text-[12px] font-bold text-foreground/20 uppercase tracking-[0.3em]">No tickets found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
