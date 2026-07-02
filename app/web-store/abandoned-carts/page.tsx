"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ShoppingCart, Users, Clock, ShoppingBag, 
  RefreshCw, Loader2, Search, User, 
  ExternalLink, Calendar, Trash2, ArrowRight,
  TrendingUp, Activity, Smartphone, Monitor,
  Zap, ChevronRight, Filter, MessageSquare,
  ChevronLeft, ArrowLeftRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

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
  customerId: string | null;
  sessionToken: string | null;
  source: string;
  status: string;
  computedStatus: string;
  phone: string | null;
  email: string | null;
  subtotal: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  abandonedAt: string | null;
  convertedOrderId: string | null;
  customer?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
  } | null;
  items: CartItem[];
  convertedOrder?: {
    id: string;
    internalOrderNumber: string;
    totalPrice: number;
    createdAt: string;
  } | null;
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`glass-card rounded-[2.5rem] overflow-hidden relative z-10 border border-foreground/5 shadow-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "abandoned" | "converted" | "expired">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "webstore" | "app">("all");
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCarts, setTotalCarts] = useState(0);

  const fetchCarts = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        source: sourceFilter,
        search: searchQuery,
        page: String(page),
        limit: "15"
      });
      const res = await fetch(`/api/admin/abandoned-carts?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setCarts(data.carts || []);
        setTotalCarts(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch abandoned carts:", error);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, sourceFilter, searchQuery, page]);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  // Search debounce or clear pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter, searchQuery]);

  const handleSendWhatsApp = async (cart: Cart) => {
    const phone = cart.phone || cart.customer?.phone;
    if (!phone) {
      toast.error("No phone number captured for this cart.");
      return;
    }

    const toastId = toast.loading(`Sending WhatsApp recovery to ${cart.customer?.name || "Guest"}...`);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "abandoned_cart",
          to: phone,
          payload: {
            phone,
            customerName: cart.customer?.name || "there",
            checkoutUrl: `https://zicabella.com/checkout?recover=${cart.id}`
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("WhatsApp recovery template triggered successfully!", { id: toastId });
        fetchCarts();
      } else {
        toast.error(data.error || "Failed to trigger WhatsApp message.", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error triggering WhatsApp recovery.", { id: toastId });
    }
  };

  const getStatusBadge = (computedStatus: string, lastActivity: string) => {
    const isLive = new Date().getTime() - new Date(lastActivity).getTime() < 5 * 60 * 1000;
    
    if (computedStatus === "converted") {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/10 italic">
          Converted
        </span>
      );
    }
    if (computedStatus === "expired") {
      return (
        <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest border border-red-500/10 italic">
          Expired
        </span>
      );
    }
    if (isLive) {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1.5 italic">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Carts
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/10 italic">
        Abandoned
      </span>
    );
  };

  const getCartAge = (lastActivity: string) => {
    const diff = new Date().getTime() - new Date(lastActivity).getTime();
    if (diff < 60000) return "Active now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(lastActivity).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-20 pt-10 px-4 sm:px-6 lg:px-10 animate-in fade-in duration-1000">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[2rem] bg-foreground text-background flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.2)] rotate-3">
              <ShoppingCart className="w-8 h-8 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/80">Abandoned Recovery System</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black text-foreground uppercase tracking-tighter leading-none italic">
                ABANDONED<span className="text-foreground/20 not-italic">CARTS</span>
              </h1>
            </div>
          </div>
          <p className="text-[12px] text-foreground/40 font-bold uppercase tracking-[0.5em] max-w-xl leading-relaxed">
            Natively tracking and recovering checkout sessions across webstore and app channels.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={fetchCarts}
            disabled={refreshing}
            className="flex items-center justify-center gap-4 px-10 py-5 rounded-[2rem] text-[11px] font-black tracking-[0.3em] uppercase bg-foreground text-background hover:scale-105 transition-all active:scale-95 disabled:opacity-50 shadow-2xl"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating sessions..." : "Refresh list"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
        {/* Search */}
        <div className="lg:col-span-2 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20 group-focus-within:text-foreground/50 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by customer phone, email, or name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-[2rem] pl-16 pr-6 py-5 text-[13px] font-bold focus:outline-none focus:bg-foreground/[0.05] focus:border-foreground/20 transition-all shadow-sm placeholder:text-foreground/20"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Status</span>
          <select 
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="flex-1 bg-foreground/[0.03] border border-foreground/[0.08] rounded-[1.5rem] px-5 py-4 text-[11px] font-black uppercase tracking-widest text-foreground/75 focus:outline-none focus:border-foreground/20 transition-all"
          >
            <option value="all">All Carts</option>
            <option value="live">Live Only</option>
            <option value="abandoned">Abandoned Only</option>
            <option value="converted">Converted Only</option>
            <option value="expired">Expired Only</option>
          </select>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Source</span>
          <select 
            value={sourceFilter}
            onChange={(e: any) => setSourceFilter(e.target.value)}
            className="flex-1 bg-foreground/[0.03] border border-foreground/[0.08] rounded-[1.5rem] px-5 py-4 text-[11px] font-black uppercase tracking-widest text-foreground/75 focus:outline-none focus:border-foreground/20 transition-all"
          >
            <option value="all">All Channels</option>
            <option value="webstore">Web Store</option>
            <option value="app">Mobile App</option>
          </select>
        </div>
      </div>

      {/* Carts Table/List */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-32 flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 animate-spin text-foreground/20" />
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-foreground/20">Loading cart database...</p>
          </div>
        ) : carts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {carts.map((cart) => {
              const displayName = cart.customer?.name || "Guest Customer";
              const displayContact = cart.phone || cart.customer?.phone || cart.email || cart.customer?.email || "No contact info";
              const isLive = new Date().getTime() - new Date(cart.lastActivityAt).getTime() < 5 * 60 * 1000;

              return (
                <GlassCard key={cart.id} className="group hover:border-foreground/10 transition-all duration-500">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-8 gap-8">
                    {/* Customer Signature & Channel Info */}
                    <div className="flex items-center gap-5 min-w-[280px]">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/10 overflow-hidden relative">
                          {cart.customer?.image ? (
                            <img src={cart.customer.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-foreground/20" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-foreground/5 border-2 border-background flex items-center justify-center">
                          {cart.source === "app" ? (
                            <Smartphone className="w-3 h-3 text-foreground/60" />
                          ) : (
                            <Monitor className="w-3 h-3 text-foreground/60" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black italic text-foreground tracking-tight leading-none">
                          {displayName}
                        </h3>
                        <p className="text-[10px] text-foreground/40 font-mono">
                          {displayContact}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-foreground/30 px-2 py-0.5 rounded-full bg-foreground/[0.04] border border-foreground/5">
                            {cart.source === "app" ? "Mobile App" : "Web Store"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thumbnail Stack & Items Summary */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex -space-x-4 overflow-hidden py-1">
                        {cart.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="w-12 h-15 rounded-xl border border-background bg-foreground/5 overflow-hidden shadow-md shrink-0">
                            {item.image ? (
                              <img src={item.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px]">📦</div>
                            )}
                          </div>
                        ))}
                        {cart.items.length > 3 && (
                          <div className="w-12 h-15 rounded-xl border border-background bg-foreground flex items-center justify-center text-[10px] font-bold text-background shrink-0">
                            +{cart.items.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block">Items</span>
                        <span className="text-[12px] font-black text-foreground/75 block">
                          {cart.items.length} {cart.items.length === 1 ? "Product" : "Products"} ({cart.items.reduce((acc, i) => acc + i.quantity, 0)} Units)
                        </span>
                      </div>
                    </div>

                    {/* Financial value */}
                    <div className="min-w-[120px]">
                      <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block">Subtotal</span>
                      <span className="text-[18px] font-black text-foreground italic leading-tight block">
                        ₹{(cart.subtotal || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Age / Time telemetry */}
                    <div className="min-w-[130px]">
                      <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block">Activity</span>
                      <span className="text-[13px] font-bold text-foreground/70 block">
                        {getCartAge(cart.lastActivityAt)}
                      </span>
                      <span className="text-[9.5px] text-foreground/30 block">
                        Last Active: {new Date(cart.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex items-center gap-4 min-w-[260px] justify-end">
                      {getStatusBadge(cart.computedStatus, cart.lastActivityAt)}

                      <button
                        onClick={() => setSelectedCart(cart)}
                        className="p-3 rounded-2xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground/60 transition-all hover:scale-105 active:scale-95"
                        title="View Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {cart.computedStatus === "abandoned" && (cart.phone || cart.customer?.phone) && (
                        <button
                          onClick={() => handleSendWhatsApp(cart)}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 transition-all hover:scale-105 active:scale-95 font-bold uppercase tracking-widest text-[9px]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Recover
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <div className="py-48 flex flex-col items-center justify-center gap-8">
            <div className="w-20 h-20 rounded-[2rem] bg-foreground/5 flex items-center justify-center text-foreground/20 border border-foreground/5">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-[15px] font-black text-foreground/30 uppercase tracking-[0.4em] italic">No Cart Sessions Found</h3>
              <p className="text-[11px] text-foreground/20 font-bold uppercase tracking-[0.2em]">Try matching other filters or query strings.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 pt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 text-foreground disabled:opacity-30 hover:bg-foreground/10 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground/50">
            Page {page} of {totalPages} ({totalCarts} Total Carts)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 text-foreground disabled:opacity-30 hover:bg-foreground/10 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Expandable Cart Details Slide-over/Panel */}
      <AnimatePresence>
        {selectedCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCart(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[95%] max-w-xl bg-neutral-950 border-l border-foreground/10 p-8 md:p-12 overflow-y-auto space-y-10"
            >
              {/* Slide-over header */}
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic text-foreground tracking-tighter uppercase">Cart detail</h2>
                <button
                  onClick={() => setSelectedCart(null)}
                  className="w-10 h-10 rounded-full border border-foreground/10 flex items-center justify-center text-foreground/45 hover:bg-foreground/5 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Customer summary */}
              <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-foreground/[0.06] space-y-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block border-b border-foreground/5 pb-2">Customer Signature</span>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-foreground italic">{selectedCart.customer?.name || "Guest Customer"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px] font-mono text-foreground/50">
                    <p>Phone: {selectedCart.phone || selectedCart.customer?.phone || "No phone signature"}</p>
                    <p>Email: {selectedCart.email || selectedCart.customer?.email || "No email signature"}</p>
                    <p>Session ID: {selectedCart.id.slice(0, 16)}...</p>
                    <p>Channel: {selectedCart.source === "app" ? "Mobile App" : "Web Store"}</p>
                  </div>
                </div>
                
                {selectedCart.customer && (
                  <div className="pt-2">
                    <Link
                      href={`/dashboard/customers/${selectedCart.customer.id}`}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/50 hover:text-foreground transition-colors border-b border-foreground/10 pb-0.5"
                    >
                      View profile details <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Conversion order details */}
              {selectedCart.computedStatus === "converted" && selectedCart.convertedOrder && (
                <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block border-b border-emerald-500/10 pb-2">Converted Order Link</span>
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-md font-black text-foreground italic">{selectedCart.convertedOrder.internalOrderNumber}</h4>
                      <p className="text-[10px] text-foreground/45 font-mono">Value: ₹{selectedCart.convertedOrder.totalPrice.toLocaleString()}</p>
                    </div>
                    <Link
                      href={`/dashboard/orders?search=${selectedCart.convertedOrder.internalOrderNumber}`}
                      className="px-5 py-3 rounded-2xl bg-foreground text-background text-[9px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                    >
                      View Order
                    </Link>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block border-b border-foreground/5 pb-2">Cart Payload</span>
                <div className="space-y-4">
                  {selectedCart.items.map((item) => (
                    <div key={item.id} className="flex gap-5 p-4 rounded-2xl bg-foreground/[0.01] border border-foreground/[0.04]">
                      <div className="w-16 h-20 rounded-xl overflow-hidden bg-foreground/5 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px]">📦</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                        <div>
                          <h4 className="text-[13.5px] font-black text-foreground leading-tight italic truncate">{item.title}</h4>
                          <p className="text-[9px] font-mono text-foreground/40 mt-1">ID: {item.productId.slice(-8)}</p>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-[12px] font-black text-foreground/75">
                            ₹{(item.price || 0).toLocaleString()} <span className="text-[10px] text-foreground/30 font-normal">x{item.quantity}</span>
                          </span>
                          {item.size && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-foreground/50 px-2 py-0.5 rounded bg-foreground/5 border border-foreground/5">
                              Size: {item.size}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Value summary and recover action */}
              <div className="pt-6 border-t border-foreground/10 space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Total accumulated value</span>
                  <span className="text-3xl font-black text-foreground italic leading-none">₹{(selectedCart.subtotal || 0).toLocaleString()}</span>
                </div>

                <div className="flex gap-4">
                  {selectedCart.computedStatus === "abandoned" && (selectedCart.phone || selectedCart.customer?.phone) && (
                    <button
                      onClick={() => handleSendWhatsApp(selectedCart)}
                      className="flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] bg-emerald-500 hover:opacity-90 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" /> Send recovery template
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedCart(null)}
                    className="flex-1 py-5 rounded-[2rem] bg-foreground/5 border border-foreground/10 text-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:bg-foreground/10 active:scale-95 transition-all"
                  >
                    Close panel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
