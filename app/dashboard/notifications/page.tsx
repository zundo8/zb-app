"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, Send, Smartphone, Users, Zap, Image as ImageIcon, 
  Link as LinkIcon, Clock, ShieldCheck, Sparkles, AlertCircle,
  History, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PushNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [deepLinkType, setDeepLinkType] = useState("none");
  const [deepLinkId, setDeepLinkId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInstant, setIsInstant] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ activeDevices: 0, vipCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch("/api/notifications/stats");
      const data = await res.json();
      if (data.success) {
        setStats({
          activeDevices: data.activeDevices || 0,
          vipCount: data.vipCount || 0
        });
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/notifications/history?limit=10");
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/notifications/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          imageUrl,
          targetType,
          targetValue: targetType === 'segment' ? 'all' : targetValue,
          deepLinkType,
          deepLinkId,
          priority: isInstant ? 'high' : 'normal'
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Push notification dispatched successfully!");
        setTitle("");
        setBody("");
        setImageUrl("");
        fetchHistory(); // Refresh history
      } else {
        toast.error(data.error || "Failed to send notification");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Global Broadcast Active</span>
          </div>
          <h1 className="text-5xl font-bold text-foreground uppercase tracking-tighter leading-none">
            Neural <span className="text-foreground/30">Dispatch</span>
          </h1>
          <p className="text-[11px] text-foreground/50 font-bold uppercase tracking-[0.4em] max-w-xl leading-relaxed">
            Instantaneous engagement engine. Send rich media notifications to your entire user base with millisecond latency.
          </p>
        </div>

        <div className="flex gap-4">
            <div className="glass-card px-6 py-3 rounded-2xl flex items-center gap-4">
                <div className="flex -space-x-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full bg-foreground/10 border-2 border-background flex items-center justify-center">
                            <Users className="w-3 h-3 opacity-50" />
                        </div>
                    ))}
                </div>
                <div className="flex flex-col">
                    <span className="text-[14px] font-bold">{statsLoading ? '...' : (stats.activeDevices / 1000).toFixed(1) + 'k'}</span>
                    <span className="text-[9px] uppercase tracking-widest text-foreground/40 font-bold">Active Targets</span>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Composer Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-7 space-y-8"
        >
          <div className="glass-card p-10 rounded-[3rem] relative overflow-hidden border-foreground/[0.03]">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Zap className="w-32 h-32" />
            </div>

            <form onSubmit={handleSend} className="space-y-8 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                    Campaign Heading
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Midnight Drop"
                    className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                    Image Asset URL
                  </label>
                  <div className="relative">
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl pl-12 pr-6 py-4 text-[13px] font-bold outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20 font-mono"
                    />
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                  Message Payload
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Draft your message here..."
                  rows={4}
                  className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-[2rem] px-8 py-6 text-[14px] font-medium outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20 resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                    Target Layer
                  </label>
                  <div className="relative">
                    <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[11px] font-bold outline-none focus:border-foreground/20 transition-all appearance-none uppercase tracking-widest"
                    >
                        <option value="all">Global Broadcast</option>
                        <option value="segment">VIP Segment</option>
                        <option value="user">Individual</option>
                    </select>
                    <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                    Deep Link Action
                  </label>
                  <div className="relative">
                    <select
                        value={deepLinkType}
                        onChange={(e) => setDeepLinkType(e.target.value)}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[11px] font-bold outline-none focus:border-foreground/20 transition-all appearance-none uppercase tracking-widest"
                    >
                        <option value="none">Open App</option>
                        <option value="product">Product Page</option>
                        <option value="collection">Collection</option>
                        <option value="orders">Order History</option>
                    </select>
                    <LinkIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                    Priority Logic
                  </label>
                  <div className="flex items-center justify-between bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">{isInstant ? 'High / Flash' : 'Normal'}</span>
                     <button 
                        type="button"
                        onClick={() => setIsInstant(!isInstant)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${isInstant ? 'bg-emerald-500' : 'bg-foreground/10'}`}
                     >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-foreground transition-all ${isInstant ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>
                </div>
              </div>

              {targetType !== 'all' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                     <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">
                        {targetType === 'user' ? 'User Identifier' : 'Segment Parameter'}
                     </label>
                     <input
                        type="text"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder={targetType === 'user' ? "Enter User ID or Phone..." : "e.g., min_orders:5"}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20"
                     />
                  </motion.div>
              )}

              {deepLinkType !== 'none' && deepLinkType !== 'orders' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                     <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">Deep Link Identifier</label>
                     <input
                        type="text"
                        value={deepLinkId}
                        onChange={(e) => setDeepLinkId(e.target.value)}
                        placeholder={`Enter ${deepLinkType} ID or handle...`}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20"
                        required
                     />
                  </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-10 bg-foreground text-background font-bold h-16 rounded-[1.5rem] hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.4em]"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Dispatching Packets...</span>
                  </div>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    <span>Execute Global Dispatch</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-4 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
             <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
             <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80 leading-relaxed">
                Caution: {targetType === 'all' 
                  ? `Global broadcast will affect all ${stats.activeDevices.toLocaleString()} active devices instantly.` 
                  : targetType === 'segment' 
                  ? `Segment dispatch will affect approximately ${stats.vipCount.toLocaleString()} targets.` 
                  : 'Individual dispatch targets a single user device.'} This action is irreversible once committed.
             </p>
          </div>
        </motion.div>

        {/* Device Preview Overlay */}
        <div className="lg:col-span-5 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="sticky top-10 flex flex-col items-center"
          >
            <div className="relative group">
                {/* Dynamic Aura */}
                <div className="absolute -inset-10 bg-blue-500/10 blur-[100px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
                
                {/* iPhone 15 Pro Max Mockup */}
                <div className="w-[320px] h-[650px] border-[10px] border-foreground/90 rounded-[4rem] relative bg-background shadow-[0_0_80px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden ring-4 ring-foreground/10">
                    <div className="absolute top-0 inset-x-0 h-8 bg-foreground/10 z-10" />
                    
                    {/* Dynamic Island */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-[1rem] z-30 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-blue-500/50 absolute right-4" />
                    </div>

                    {/* Lock Screen UI */}
                    <div className="flex-1 bg-gradient-to-b from-blue-900/30 via-background to-background pt-20 px-6 relative">
                        <div className="flex flex-col items-center mb-16 space-y-2 opacity-80">
                            <span className="text-6xl font-thin tracking-tighter">9:41</span>
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">Thursday, May 7</span>
                        </div>

                        {/* Notification Stack */}
                        <AnimatePresence>
                            {(title || body) && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0, scale: 0.9 }}
                                    animate={{ y: 0, opacity: 1, scale: 1 }}
                                    exit={{ y: 20, opacity: 0, scale: 0.9 }}
                                    className="bg-foreground/5 backdrop-blur-2xl border border-foreground/10 p-5 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 ring-1 ring-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center shadow-lg">
                                            <Sparkles className="w-5 h-5 text-background" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Zica Bella App</span>
                                                <span className="text-[9px] font-bold opacity-30">now</span>
                                            </div>
                                            <h3 className="text-[14px] font-bold leading-tight truncate">{title || "Notification Preview"}</h3>
                                        </div>
                                    </div>
                                    
                                    <p className="text-[12px] leading-snug text-foreground/70 font-medium line-clamp-2">
                                        {body || "Compose your message to see how it will appear on customer lock screens."}
                                    </p>

                                    {imageUrl && (
                                        <div className="w-full aspect-[2/1] rounded-2xl bg-foreground/5 overflow-hidden mt-1 border border-foreground/5">
                                            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Bottom Actions */}
                        <div className="absolute bottom-10 inset-x-0 flex justify-between px-10 opacity-30">
                            <div className="w-12 h-12 rounded-full bg-foreground/10 backdrop-blur-md flex items-center justify-center">
                                <ImageIcon className="w-5 h-5" />
                            </div>
                            <div className="w-12 h-12 rounded-full bg-foreground/10 backdrop-blur-md flex items-center justify-center">
                                <Smartphone className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                    
                    {/* Home Indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full" />
                </div>
            </div>

            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/30">
               Apple Liquid Glass Morphism Simulation
            </p>
          </motion.div>
        </div>
      </div>

      {/* History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-4 space-y-8"
      >
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                 <History className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                 <h2 className="text-2xl font-bold uppercase tracking-tight">Neural History</h2>
                 <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-1">Audit log of all dispatched engagement packets</p>
              </div>
           </div>
           
           <button 
             onClick={fetchHistory}
             disabled={historyLoading}
             className="flex items-center gap-2 px-6 py-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-all border border-foreground/[0.05]"
           >
              <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">Refresh Registry</span>
           </button>
        </div>

        <div className="glass-card rounded-[2.5rem] overflow-hidden border-foreground/[0.03]">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="border-b border-foreground/[0.05] bg-foreground/[0.02]">
                       <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Timestamp</th>
                       <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Campaign Details</th>
                       <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Targeting</th>
                       <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Reach Metrics</th>
                       <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-foreground/[0.03]">
                    {historyLoading && history.length === 0 ? (
                       <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                             <div className="flex flex-col items-center gap-4 opacity-20">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Accessing Neural Database...</span>
                             </div>
                          </td>
                       </tr>
                    ) : history.length === 0 ? (
                       <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                             <div className="flex flex-col items-center gap-4 opacity-20">
                                <Bell className="w-8 h-8" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">No dispatch records found</span>
                             </div>
                          </td>
                       </tr>
                    ) : (
                       history.map((record) => (
                          <tr key={record.id} className="hover:bg-foreground/[0.02] transition-colors group">
                             <td className="px-8 py-8">
                                <div className="flex flex-col gap-1">
                                   <span className="text-[11px] font-bold text-foreground/80">
                                      {format(new Date(record.createdAt), "MMM d, HH:mm")}
                                   </span>
                                   <span className="text-[9px] font-medium text-foreground/30 uppercase tracking-widest">
                                      {format(new Date(record.createdAt), "yyyy")}
                                   </span>
                                </div>
                             </td>
                             <td className="px-8 py-8">
                                <div className="flex items-start gap-4">
                                   {record.imageUrl && (
                                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/5 border border-foreground/10 shrink-0">
                                         <img src={record.imageUrl} alt="" className="w-full h-full object-cover" />
                                      </div>
                                   )}
                                   <div className="flex flex-col gap-1.5 max-w-xs">
                                      <span className="text-[13px] font-bold tracking-tight leading-none">{record.title}</span>
                                      <p className="text-[11px] text-foreground/50 line-clamp-1 leading-relaxed">{record.body}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-8">
                                <div className="flex flex-col gap-2">
                                   <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">
                                         {record.targetType === 'all' ? 'Global' : record.targetType}
                                      </span>
                                   </div>
                                   {record.deepLinkType !== 'none' && (
                                      <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.15em]">
                                         Route: {record.deepLinkType}
                                      </span>
                                   )}
                                </div>
                             </td>
                             <td className="px-8 py-8">
                                <div className="flex items-center gap-8">
                                   <div className="flex flex-col gap-1">
                                      <span className="text-[14px] font-black leading-none">{record.sentCount}</span>
                                      <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">Dispatched</span>
                                   </div>
                                   <div className="flex flex-col gap-1">
                                      <span className="text-[14px] font-black text-emerald-500 leading-none">{record.deliveredCount}</span>
                                      <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">Resolved</span>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-8 text-right">
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${
                                   record.status === 'sent' 
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                      : 'bg-foreground/5 border-foreground/10 text-foreground/40'
                                }`}>
                                   {record.status === 'sent' ? (
                                      <CheckCircle2 className="w-3 h-3" />
                                   ) : (
                                      <Clock className="w-3 h-3" />
                                   )}
                                   <span className="text-[9px] font-black uppercase tracking-widest">
                                      {record.status === 'sent' ? 'Success' : record.status}
                                   </span>
                                </div>
                             </td>
                          </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        <div className="flex items-center justify-between p-8 glass-card rounded-3xl border-foreground/[0.03]">
           <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">
              Showing {history.length} of {total} Dispatch Operations
           </p>
           <div className="flex gap-4">
              <button disabled className="px-6 py-2 rounded-xl border border-foreground/[0.05] text-[9px] font-bold opacity-30 uppercase tracking-widest">Previous</button>
              <button disabled={total <= history.length} className="px-6 py-2 rounded-xl border border-foreground/[0.05] text-[9px] font-bold uppercase tracking-widest hover:bg-foreground/5 transition-all">Next Cluster</button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
