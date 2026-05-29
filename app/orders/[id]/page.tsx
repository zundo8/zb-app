"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Truck, 
  ChevronLeft, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  CreditCard,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Box,
  Home
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const STEPS = [
  { id: "confirmed",   label: "Confirmed",   icon: CheckCircle2 },
  { id: "processing",  label: "Processing",  icon: Clock },
  { id: "shipped",     label: "Shipped",     icon: Package },
  { id: "in_transit",   label: "In Transit",  icon: Truck },
  { id: "out_for_delivery", label: "Out for Delivery", icon: Box },
  { id: "delivered",   label: "Delivered",   icon: Home },
];

export default function OrderDetailsPage() {
  const { id } = useParams();
  const { data: session, status } = useSession();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" && !loading) {
      router.push(`/login?callbackUrl=/orders/${id}`);
    }
  }, [status, loading, router, id]);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.status === 401) {
        router.push(`/login?callbackUrl=/orders/${id}`);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
      }
    } catch (e) {
      console.error("Error fetching order", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    // Simulate Shiprocket API sync
    await new Promise(r => setTimeout(r, 1500));
    await fetchOrder();
    setSyncing(false);
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const status = order.deliveryStatus.toLowerCase();
    switch (status) {
      case "delivered": return 5;
      case "out_for_delivery": return 4;
      case "shipped": return 3;
      case "processing": return 1;
      case "pending": return 0;
      default: return 0;
    }
  };

  const currentStepIndex = getCurrentStepIndex();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
        <p className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-[0.3em]">Locating Package</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-16 h-16 bg-muted/20 rounded-[2rem] flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500/30" />
        </div>
        <div className="space-y-1">
          <h2 className="text-[12px] font-heading uppercase tracking-widest">Order Not Found</h2>
          <p className="text-[9px] text-muted-foreground/50">The requested order could not be located in our system.</p>
        </div>
        <Link href="/orders" className="px-8 py-3 bg-foreground text-background rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-foreground/5">
             Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative pb-safe-nav">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[80vw] h-[80vw] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[80vw] h-[80vw] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-5 pt-28 pb-32">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/orders" className="group flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Orders</span>
          </Link>
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 text-blue-400 ${syncing ? 'animate-spin' : ''}`} />
            <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Sync Status</span>
          </button>
        </div>

        {/* Order Identifier */}
        <div className="mb-10 text-center">
            <p className="text-[7px] font-light uppercase tracking-[0.55em] text-muted-foreground/30 mb-2">Tracking ID</p>
            <h1 className="text-2xl font-heading tracking-widest uppercase text-foreground/80 mb-1">
              #{order.shopifyOrderId || order.id.slice(-6).toUpperCase()}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[9px] font-extralight text-muted-foreground/40 italic uppercase tracking-wider">
               <span>Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
        </div>

        {/* LIVE STATUS BAR (STEPPER) */}
        <div className="relative mb-14 px-2">
            <div className="absolute top-4 left-10 right-10 h-[2px] bg-white/5 z-0" />
            <motion.div 
               className="absolute top-4 left-10 h-[2px] bg-blue-500 z-1" 
               initial={{ width: 0 }}
               animate={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 80}%` }}
               transition={{ duration: 1, ease: "circOut" }}
            />
            
            <div className="flex justify-between relative z-10">
               {STEPS.map((step, i) => {
                 const isCompleted = i <= currentStepIndex;
                 const isActive = i === currentStepIndex;
                 const Icon = step.icon;

                 return (
                   <div key={step.id} className="flex flex-col items-center group">
                      <div 
                         className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                           isCompleted 
                            ? 'bg-blue-500 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                            : 'bg-background border-white/10'
                         }`}
                      >
                         <Icon className={`w-3.5 h-3.5 transition-colors duration-500 ${isCompleted ? 'text-white' : 'text-white/10'}`} />
                      </div>
                      <span className={`text-[6px] font-black uppercase tracking-widest mt-2 transition-colors duration-500 ${isCompleted ? 'text-white/60' : 'text-white/5'} ${isActive ? 'text-blue-400' : ''}`}>
                         {step.label}
                      </span>
                   </div>
                 );
               })}
            </div>
        </div>

        {/* SHIPMENT DETAILS CARD */}
        {order.shipments?.[0] && (
          <div className="mb-8 p-5 rounded-3xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-3xl overflow-hidden relative group">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-6">
                <div className="space-y-1">
                    <p className="text-[7px] font-black uppercase tracking-[0.3em] text-blue-400/60">Live Shipment</p>
                    <h3 className="text-[12px] font-heading tracking-widest text-foreground/80 uppercase">
                        {order.shipments[0].courier || 'Standard'} Express
                    </h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-xl">
                   <Truck className="w-4 h-4 text-blue-400" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-4">
                <div>
                   <p className="text-[6.5px] font-black uppercase tracking-widest text-white/15 mb-1.5 font-mono">Tracking No.</p>
                   <p className="text-[10px] font-mono text-white/60 font-medium uppercase">{order.shipments[0].trackingNumber}</p>
                </div>
                <div>
                   <p className="text-[6.5px] font-black uppercase tracking-widest text-white/15 mb-1.5 font-mono">Current Station</p>
                   <p className="text-[10px] text-white/60 font-medium italic">Transit Hub · Delhi</p>
                </div>
            </div>

            <button 
                onClick={() => window.open(`https://www.shiprocket.in/shipment-tracking/?awb=${order.shipments[0].trackingNumber}`, '_blank')}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-[8px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
            >
                External Track <ExternalLink className="w-3 h-3 opacity-30" />
            </button>
          </div>
        )}

        {/* ORDER ITEMS */}
        <div className="mb-10">
           <h4 className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 mb-6 flex items-center gap-2">
              <ShoppingBag className="w-3 h-3" /> Package Contents
           </h4>
           <div className="space-y-3">
              {order.items.map((item: any) => (
                <div 
                   key={item.id} 
                   className="flex items-center gap-4 p-3 rounded-2xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                >
                   <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/5 flex-shrink-0">
                      {item.product?.featuredImage ? (
                        <img src={item.product.featuredImage} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-foreground/5 text-foreground/40 dark:text-foreground/20 font-black text-lg uppercase">{item.title[0]}</div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h5 className="text-[10px] font-bold text-foreground/80 truncate uppercase tracking-tight">{item.title}</h5>
                      <p className="text-[8px] font-extralight text-muted-foreground/40 mt-0.5 font-mono">Qty: {item.quantity} · INR {(item.price).toLocaleString('en-IN')}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-inter font-bold text-white/60">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* SUMMARY & DETAILS */}
        <div className="grid grid-cols-1 gap-4 mb-20">
           {/* Summary */}
           <div className="p-6 rounded-3xl border border-white/[0.03] bg-white/[0.01] space-y-4">
               <h4 className="text-[7px] font-black uppercase tracking-[0.3em] text-white/10 mb-2">Payment Summary</h4>
               <div className="space-y-2.5">
                  <div className="flex justify-between text-[9px] font-extralight text-white/40">
                     <span>Subtotal</span>
                     <span>₹{(order.totalPrice).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-extralight text-white/40">
                     <span>Shipping</span>
                     <span className="text-green-500/60 uppercase text-[7px] font-black tracking-widest">Free</span>
                  </div>
                  <div className="pt-2.5 mt-2.5 border-t border-white/5 flex justify-between items-center">
                     <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Total Amount</span>
                     <span className="text-sm font-heading tracking-widest text-foreground/90">₹{(order.totalPrice).toLocaleString('en-IN')}</span>
                  </div>
               </div>
           </div>

           {/* Address */}
           <div className="p-6 rounded-3xl border border-white/[0.03] bg-white/[0.01]">
              <h4 className="text-[7px] font-black uppercase tracking-[0.3em] text-white/10 mb-4 flex items-center gap-2">
                 <MapPin className="w-2.5 h-2.5" /> Shipping Destination
              </h4>
              <p className="text-[10px] font-extralight text-white/50 leading-relaxed italic">
                 {(() => {
                   if (!order.shippingAddress) return 'No address provided in system records.';
                   try {
                     const addr = JSON.parse(order.shippingAddress);
                     const parts = [
                       addr.name,
                       addr.address1 || addr.line1,
                       addr.address2 || addr.line2,
                       [addr.city, addr.province || addr.state].filter(Boolean).join(', '),
                       [addr.zip || addr.pincode, addr.country].filter(Boolean).join(' '),
                       addr.phone ? `Phone: ${addr.phone}` : null,
                     ].filter(Boolean);
                     return parts.join(' · ') || order.shippingAddress;
                   } catch {
                     return order.shippingAddress;
                   }
                 })()}
              </p>
           </div>
        </div>
      </main>

    </div>
  );
}
