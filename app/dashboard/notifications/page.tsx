"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, Send, Smartphone, Users, Zap, Image as ImageIcon, 
  Link as LinkIcon, Clock, ShieldCheck, Sparkles, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";

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
                    <span className="text-[14px] font-bold">12.4k</span>
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
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isInstant ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>
                </div>
              </div>

              {targetType === 'user' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                     <label className="text-[10px] font-bold tracking-[0.3em] text-foreground/40 uppercase px-1">User Identifier</label>
                     <input
                        type="text"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder="Enter User ID or Phone..."
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold outline-none focus:border-foreground/20 transition-all placeholder:text-foreground/20"
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
                Caution: Global broadcast will affect all 12,400+ active devices instantly. This action is irreversible once committed.
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
                                    className="bg-foreground/5 backdrop-blur-2xl border border-white/10 p-5 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 ring-1 ring-white/5"
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
                                        <div className="w-full aspect-[2/1] rounded-2xl bg-foreground/5 overflow-hidden mt-1 border border-white/5">
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
    </div>
  );
}
  );
}
