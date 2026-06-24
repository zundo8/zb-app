"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Activity, Copy, Calendar, AlertTriangle, RefreshCw, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

export default function MetaPixelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/meta/event-stats');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || 'Failed to fetch Meta Pixel details');
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error connecting to Meta API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Pixel ID copied to clipboard");
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/20" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meta Pixel & Dataset Status</h1>
            <p className="text-sm text-muted-foreground mt-1">Direct integration diagnostics from Meta Graph API</p>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl px-4 py-2 text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>

        <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-xl mx-auto mt-12 border-red-500/20 bg-red-500/[0.02]">
          <div className="p-4 bg-red-500/10 rounded-full text-red-500">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold text-lg">Failed to Connect with Meta</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {error || "Make sure NEXT_PUBLIC_META_PIXEL_ID and META_CAPI_ACCESS_TOKEN are properly configured in your environment variables."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const creationDate = data.creation_time ? new Date(data.creation_time).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'N/A';

  const lastFiredDate = data.last_fired_time ? new Date(data.last_fired_time * 1000).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'N/A';

  // Extract stats arrays safely
  const eventStats = data.stats?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meta Pixel & Dataset</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time tracking and server-side integration quality logs</p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl px-4 py-2 text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Main Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">Dataset Name</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">{data.name || "Zica Bella Pixel"}</h3>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground font-mono">
              <span>ID: {data.id}</span>
              <button 
                onClick={() => handleCopy(data.id)}
                className="hover:text-foreground transition-colors p-0.5"
                title="Copy ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">Last Event Received</span>
            <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{lastFiredDate}</h3>
            <span className="text-xs text-muted-foreground mt-2 block">Source: Browser/Server direct sync</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">Created On</span>
            <Calendar className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{creationDate}</h3>
            <span className="text-xs text-muted-foreground mt-2 block">Direct integration Dataset API</span>
          </div>
        </motion.div>
      </div>

      {/* Dataset Event Stats / Event Match Quality */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight mt-8">Active Event Metrics</h2>
        
        {eventStats.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No active event history returned within the Meta attribution window. Keep testing client actions to populate stats.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventStats.map((event: any, i: number) => {
              const qualityScore = event.match_quality || 100;
              const qualityColor = qualityScore >= 90 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10";
              
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="glass-card p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-foreground/5 text-foreground/75">
                        <Database className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-md">{event.event_type}</h3>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${qualityColor}`}>
                      {qualityScore}% Match Quality
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-foreground/5 font-mono">
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">Browser Events</div>
                      <div className="text-lg font-bold mt-1">{event.browser_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">Server Events</div>
                      <div className="text-lg font-bold mt-1">{event.server_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">Deduplicated</div>
                      <div className="text-lg font-bold mt-1">{event.deduplicated_count || 0}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
