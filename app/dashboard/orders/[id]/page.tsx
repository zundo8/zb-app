"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  ShoppingCart,
  MapPin,
  Mail,
  Phone,
  Tag,
  Truck,
  ExternalLink,
  Clock,
  RefreshCw,
  Package,
  CreditCard,
  ShieldCheck,
  Calendar,
  ChevronRight,
  AlertCircle,
  FileText,
  Printer,
  X,
  User,
  Activity,
  Box,
  CornerDownRight,
  Zap,
  Globe,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string | null;
  image: string | null;
}

interface Shipment {
  id: string;
  awb: string | null;
  courier: string | null;
  status: string;
  trackingUrl: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  shopifyOrderId: string;
  status: string;
  totalPrice: number;
  subtotalPrice: number | null;
  totalTax: number | null;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  fulfillmentStatus: string;
  deliveryStatus: string;
  shippingAddress: string | null;
  billingAddress: string | null;
  note: string | null;
  tags: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  items: OrderItem[];
  shipments: Shipment[];
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  paid: { label: "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  pending: { label: "Awaiting", color: "text-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  fulfilled: { label: "Dispatched", color: "text-blue-500", bg: "bg-blue-500/10", dot: "bg-blue-500" },
  unfulfilled: { label: "Draft", color: "text-white/40", bg: "bg-white/5", dot: "bg-white/20" },
  delivered: { label: "Arrived", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  cancelled: { label: "Terminated", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delhiveryLoading, setDelhiveryLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchOrder = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const data = await res.json();
      if (data.success) setOrder(data.order);
      else setError(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchOrder();
  }, [id, fetchOrder]);

  const handleAction = async (action: string) => {
    setDelhiveryLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/delhivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, weight: "500", shippingMode: "Surface" })
      });
      const data = await res.json();
      if (data.success) {
        setToast("Protocol Executed");
        fetchOrder(true);
      }
    } finally {
      setDelhiveryLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <Loader2 className="w-6 h-6 animate-spin text-white/10" />
      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20">Decrypting Profile...</p>
    </div>
  );

  if (error || !order) return (
    <div className="max-w-xl mx-auto py-24 text-center space-y-6">
      <AlertCircle className="w-8 h-8 text-rose-500/40 mx-auto" />
      <h1 className="text-xl font-semibold text-white tracking-tight">Access Denied</h1>
      <p className="text-sm text-white/40 leading-relaxed">{error || "Signal lost."}</p>
      <button onClick={() => router.back()} className="text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">Return</button>
    </div>
  );

  const shippingAddr = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
  const latestShipment = order.shipments?.[0];

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-32 pt-4 relative">
       <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-[100] bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ArrowLeft className="w-4 h-4 text-white/40" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white">Order #{order.shopifyOrderId.replace('#', '')}</h1>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            </div>
            <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => fetchOrder(true)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all">
             <RefreshCw className={`w-4 h-4 text-white/40 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button className="flex items-center gap-2.5 px-6 py-2.5 bg-white text-black rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
            <Printer className="w-4 h-4" />
            Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-12">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Payment", value: order.paymentStatus, icon: CreditCard },
              { label: "Inventory", value: order.fulfillmentStatus, icon: Box },
              { label: "Logistics", value: order.deliveryStatus || 'Awaiting', icon: Truck },
              { label: "Network", value: order.shopifyOrderId.startsWith('ZB71') ? 'Mobile' : 'Web', icon: Activity },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  {s.label}
                  <s.icon className="w-3.5 h-3.5 opacity-20" />
                </div>
                <StatusBadge status={s.value} />
              </div>
            ))}
          </div>

          {/* Line Items */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Inventory Manifest</h3>
              <span className="text-[10px] font-bold text-white/40 uppercase">{order.items.length} Elements</span>
            </div>
            
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-[24px] bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Box className="w-6 h-6 text-white/10 mx-auto mt-5" />}
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-white tracking-tight">{item.title}</h4>
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">QTY: {item.quantity} | SKU: {item.sku || "N/A"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-white tracking-tight">₹{item.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Subtotal Manifest</p>
                    <p className="text-[13px] font-semibold text-white/40 tracking-tight">₹{order.subtotalPrice?.toLocaleString()}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Transaction Value</p>
                    <p className="text-4xl font-semibold text-white tracking-tighter italic">₹{order.totalPrice.toLocaleString()}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Logistics Terminal */}
          <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white tracking-tight">Logistics Command</h3>
                <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest">Delhivery B2C Fulfillment Hub</p>
              </div>
              {latestShipment?.awb && (
                <div className="px-5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[12px] font-mono font-bold text-blue-500">
                  {latestShipment.awb}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {!latestShipment?.awb ? (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-12 space-y-8 border border-dashed border-white/10 rounded-[32px]">
                   <Truck className="w-10 h-10 text-white/5" />
                   <div className="text-center space-y-2">
                     <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em]">Node Awaiting Shipment</p>
                     <p className="text-[13px] text-white/40 max-w-xs mx-auto">No active shipment record exists for this transaction profile.</p>
                   </div>
                   <button 
                    onClick={() => handleAction("create_shipment")}
                    disabled={delhiveryLoading}
                    className="flex items-center gap-3 px-10 py-4 bg-white text-black rounded-2xl text-[11px] font-bold uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                   >
                     {delhiveryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-black" />}
                     Initiate Dispatch
                   </button>
                </div>
              ) : (
                <>
                  <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5 space-y-6">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Current Status</p>
                      <p className="text-[15px] font-bold text-blue-400 uppercase tracking-tight italic">{latestShipment.status}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Courier Partner</p>
                      <p className="text-[13px] font-semibold text-white/60">{latestShipment.courier || "Delhivery"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <a href={latestShipment.trackingUrl || "#"} target="_blank" className="flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white text-black border border-white/10 rounded-[20px] text-[11px] font-bold uppercase tracking-widest transition-all group">
                       Track Signal
                       <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </a>
                    <button 
                      onClick={() => handleAction("cancel_shipment")}
                      disabled={delhiveryLoading}
                      className="py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-[20px] text-[11px] font-bold uppercase tracking-widest text-rose-500 transition-all"
                    >
                      Terminated Dispatch
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Identity Panel */}
        <div className="lg:col-span-4 space-y-12">
          {/* Customer Card */}
          <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-10 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Identity Profile</h3>
              <div className="flex items-center gap-5 pt-4">
                 <div className="w-14 h-14 rounded-[20px] bg-white/5 flex items-center justify-center border border-white/10 text-xl font-bold text-white/40">
                   {order.customer.name?.charAt(0) || "U"}
                 </div>
                 <div>
                   <h4 className="text-[18px] font-semibold text-white tracking-tight">{order.customer.name || "Anonymous"}</h4>
                   <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">Tier-1 Entity</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-4 p-4 rounded-[20px] bg-white/[0.03] border border-white/5 group hover:border-white/20 transition-all">
                  <Mail className="w-4 h-4 text-white/20 group-hover:text-blue-500 transition-colors" />
                  <p className="text-[12px] font-medium text-white/60 truncate">{order.customer.email}</p>
               </div>
               <div className="flex items-center gap-4 p-4 rounded-[20px] bg-white/[0.03] border border-white/5 group hover:border-white/20 transition-all">
                  <Phone className="w-4 h-4 text-white/20 group-hover:text-emerald-500 transition-colors" />
                  <p className="text-[12px] font-mono font-bold text-white/60">{order.customer.phone || "No signal"}</p>
               </div>
            </div>
          </div>

          {/* Logistics Target */}
          <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-10 shadow-2xl relative overflow-hidden">
             <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-purple-500/10 blur-[80px] rounded-full" />
             
            <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em] relative z-10">Terminal Location</h3>
            
            {shippingAddr ? (
              <div className="space-y-8 relative z-10">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Primary Vector</p>
                  <p className="text-[14px] font-semibold text-white/80 leading-relaxed italic">"{shippingAddr.address1}, {shippingAddr.address2}"</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Region</p>
                      <p className="text-[12px] font-bold text-white uppercase tracking-tight">{shippingAddr.city}, {shippingAddr.province}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Post Code</p>
                      <p className="text-[16px] font-mono font-bold text-blue-500 tracking-tighter">{shippingAddr.zip || shippingAddr.pincode}</p>
                   </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Globe className="w-3.5 h-3.5 text-white/20" />
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{shippingAddr.country || "INDIA"}</span>
                   </div>
                   <ShieldCheck className="w-4 h-4 text-emerald-500/40" />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest italic relative z-10">Terminal data undefined.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const theme = STATUS_THEME[status.toLowerCase()] || { 
    label: status.replace('_', ' '), 
    color: "text-white/40", 
    bg: "bg-white/5", 
    dot: "bg-white/20" 
  };
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-white/5 ${theme.bg}`}>
      <div className={`w-1 h-1 rounded-full ${theme.dot}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>
        {theme.label}
      </span>
    </div>
  );
}
