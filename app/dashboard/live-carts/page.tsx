"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCart, Users, Clock, ShoppingBag, 
  RefreshCw, Loader2, Search, User, 
  ExternalLink, Calendar, Trash2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  handle: string | null;
  title: string | null;
  price: number | null;
  image: string | null;
  quantity: number;
  size: string | null;
  createdAt: string;
}

interface Cart {
  id: string;
  customerId: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
  };
  items: CartItem[];
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`glass-card rounded-[2rem] overflow-hidden relative z-10 border border-foreground/5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function LiveCartsPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCarts = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/live-carts');
      const data = await res.json();
      if (res.ok) {
        setCarts(data);
      }
    } catch (error) {
      console.error("Failed to fetch live carts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCarts();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCarts, 30000);
    return () => clearInterval(interval);
  }, [fetchCarts]);

  const filteredCarts = carts.filter(cart => {
    if (!cart.customer) return false;
    const name = cart.customer.name?.toLowerCase() || "";
    const email = cart.customer.email?.toLowerCase() || "";
    const phone = cart.customer.phone || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query) || phone.includes(query);
  });

  const totalCartValue = carts.reduce((acc, cart) => 
    acc + cart.items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0), 0
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 px-4 pt-10 mb-16">
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center text-foreground/30 border border-foreground/5 shadow-2xl">
              <ShoppingCart className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground uppercase tracking-tighter leading-none">
                Live Carts
              </h1>
              <p className="text-[11px] text-foreground/30 font-bold uppercase tracking-[0.4em] mt-2">
                Real-time active shopper sessions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchCarts}
            disabled={refreshing}
            className="flex items-center justify-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-bold tracking-[0.3em] uppercase bg-foreground/5 text-foreground/60 border border-foreground/10 hover:bg-foreground/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30">Active Carts</span>
          </div>
          <div className="text-3xl font-bold">{carts.length}</div>
        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30">Total Value</span>
          </div>
          <div className="text-3xl font-bold">₹{totalCartValue.toLocaleString()}</div>
        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30">Last Updated</span>
          </div>
          <div className="text-3xl font-bold">{carts.length > 0 ? new Date(carts[0].updatedAt).toLocaleTimeString() : 'N/A'}</div>
        </GlassCard>
      </div>

      {/* Search & Filters */}
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20" />
        <input 
          type="text" 
          placeholder="Search by customer name, phone, or email..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-foreground/5 border border-foreground/10 rounded-[2rem] pl-16 pr-8 py-6 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all shadow-sm"
        />
      </div>

      {/* Carts List */}
      <div className="grid grid-cols-1 gap-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-foreground/10" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/20">Loading Active Sessions...</p>
          </div>
        ) : filteredCarts.length > 0 ? (
          filteredCarts.map((cart) => (
            <GlassCard key={cart.id} className="group">
              <div className="flex flex-col lg:flex-row">
                {/* Customer Info Sidebar */}
                <div className="lg:w-80 p-8 border-r border-foreground/5 bg-foreground/[0.01]">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/5 overflow-hidden">
                      {cart.customer.image ? (
                        <Image src={cart.customer.image} alt="" width={56} height={56} className="object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-foreground/20" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground tracking-tight">{cart.customer.name || 'Unknown User'}</h3>
                      <p className="text-[10px] text-foreground/30 font-medium truncate w-40">{cart.customer.email}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">Phone</span>
                      <span className="text-[11px] font-medium text-foreground/60">{cart.customer.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">Items</span>
                      <span className="text-[11px] font-bold text-foreground">{cart.items.reduce((s, i) => s + i.quantity, 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">Updated</span>
                      <span className="text-[11px] font-medium text-foreground/60">{new Date(cart.updatedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-foreground/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Cart Total</span>
                      <span className="text-xl font-bold text-foreground">
                        ₹{cart.items.reduce((s, i) => s + ((i.price || 0) * i.quantity), 0).toLocaleString()}
                      </span>
                    </div>
                    <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                      View Profile <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="flex-1 p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/5 group/item hover:bg-foreground/[0.04] transition-all duration-500">
                        <div className="w-20 h-24 rounded-xl bg-foreground/5 overflow-hidden flex-shrink-0 border border-foreground/5">
                          {item.image ? (
                            <Image src={item.image} alt="" width={80} height={96} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-foreground/10">
                              <ShoppingBag className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          <div>
                            <h4 className="text-[12px] font-bold text-foreground/80 truncate leading-tight mb-1">{item.title}</h4>
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/20">Qty:</span>
                               <span className="text-[10px] font-bold text-foreground/60">{item.quantity}</span>
                               {item.size && (
                                 <>
                                   <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                   <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/20">Size:</span>
                                   <span className="text-[10px] font-bold text-foreground/60">{item.size}</span>
                                 </>
                               )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-foreground">₹{(item.price || 0).toLocaleString()}</span>
                            <span className="text-[9px] font-mono text-foreground/20">#{item.productId.slice(-6)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 rounded-[2.5rem] bg-foreground/5 flex items-center justify-center text-foreground/10 border border-foreground/5">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="text-[14px] font-bold text-foreground/40 uppercase tracking-[0.3em] mb-2">No Active Carts</h3>
              <p className="text-[11px] text-foreground/20 font-medium">Currently there are no shoppers with items in their carts.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
