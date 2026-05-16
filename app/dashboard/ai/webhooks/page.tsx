"use client";

import { useState, useEffect } from "react";
import { 
  Activity, ArrowLeft, RefreshCw, CheckCircle, 
  Clock, Server, Terminal, ExternalLink, ShieldCheck, 
  AlertCircle, ChevronRight, Zap
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface WebhookEvent {
  id: string;
  source: string;
  eventType: string;
  payload: string;
  processed: boolean;
  createdAt: string;
}

export default function AIWebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const fetchEvents = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/webhooks/zica-ai");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhooks/zica-ai`);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Webhook URL copied to clipboard!");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto pb-20 space-y-8 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 pt-10">
        <div className="space-y-4">
          <Link href="/dashboard/ai" className="flex items-center gap-2 text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em] hover:text-foreground/60 transition-all group">
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
            Back to Command Center
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-400 border border-violet-500/20 shadow-2xl">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground uppercase tracking-tighter leading-none">
                AI Webhooks
              </h1>
              <p className="text-[11px] text-foreground/30 font-bold uppercase tracking-[0.4em] mt-2">
                Event Notifications & Updates
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={fetchEvents}
          disabled={refreshing}
          className="flex items-center justify-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-bold tracking-[0.3em] uppercase bg-foreground/5 text-foreground/60 border border-foreground/10 hover:bg-foreground/10 transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {/* Connection Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center gap-3 pb-6 border-b border-foreground/5">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Webhook Endpoint Configuration</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-[12px] text-foreground/60 leading-relaxed">
                Use this endpoint to send external notifications to Zica AI. This allows the AI to react to real-time events like Shopify order creations, delivery status changes, or inventory updates.
              </p>
              
              <div className="bg-foreground/5 rounded-2xl p-6 border border-foreground/10 space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.2em]">Live Webhook URL</label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={webhookUrl}
                      className="flex-1 bg-transparent border-0 text-[13px] font-mono text-foreground/80 focus:ring-0"
                    />
                    <button 
                      onClick={() => copyToClipboard(webhookUrl)}
                      className="px-4 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-foreground/[0.02] border border-foreground/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-violet-400" />
                    <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">Supported Headers</span>
                  </div>
                  <ul className="text-[10px] text-foreground/40 space-y-1 ml-6 list-disc">
                    <li>Content-Type: application/json</li>
                    <li>x-webhook-source: [service_name]</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-foreground/[0.02] border border-foreground/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">Expected Payload</span>
                  </div>
                  <ul className="text-[10px] text-foreground/40 space-y-1 ml-6 list-disc">
                    <li>type: string (e.g. &quot;order_update&quot;)</li>
                    <li>data: object (raw payload)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-[2rem] p-8 bg-violet-500/[0.02]">
            <h3 className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-6">System Status</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">Receiver Online</p>
                  <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Listening for events</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">Auto-Ingestion</p>
                  <p className="text-[10px] text-foreground/30 uppercase tracking-wider">AI analysis active</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-8 border-rose-500/10 bg-rose-500/[0.01]">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5" />
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Security Notice</p>
                <p className="text-[10px] text-rose-400/60 leading-relaxed">
                  Authentication headers are currently optional for development. Ensure source verification is enabled in production settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-6">
          <h3 className="text-[10px] font-bold text-foreground/25 uppercase tracking-[0.4em]">Live Event Feed</h3>
          <span className="text-[10px] font-bold text-foreground/20 bg-foreground/5 px-3 py-1 rounded-full">{events.length} Events Logged</span>
        </div>
        
        <div className="glass-card rounded-[2rem] overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="w-6 h-6 animate-spin text-foreground/10" />
              <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">Loading event stream...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-foreground/[0.02] flex items-center justify-center border border-foreground/5">
                <Clock className="w-6 h-6 text-foreground/10" />
              </div>
              <div className="space-y-1">
                <p className="text-[13px] font-bold text-foreground/40">No events captured yet</p>
                <p className="text-[10px] text-foreground/20 uppercase tracking-widest">Send a POST request to start receiving updates</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-foreground/5">
              {events.map((event, i) => (
                <div key={event.id} className="p-6 hover:bg-foreground/[0.01] transition-all group">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-violet-500/10 group-hover:text-violet-400 transition-all border border-foreground/5 group-hover:border-violet-500/20">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] font-bold text-foreground">{event.eventType}</span>
                          <span className="px-2 py-0.5 rounded bg-foreground/10 text-[8px] font-bold uppercase tracking-wider text-foreground/40">{event.source}</span>
                        </div>
                        <p className="text-[10px] text-foreground/30 font-mono">ID: {event.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-foreground/60">{new Date(event.createdAt).toLocaleDateString()}</p>
                        <p className="text-[10px] text-foreground/20 font-mono">{new Date(event.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <button className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
