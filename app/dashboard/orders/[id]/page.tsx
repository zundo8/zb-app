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
  Smartphone,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DelhiveryActions from "@/components/orders/DelhiveryActions";

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
  orderType: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  items: OrderItem[];
  shipments: Shipment[];
  delhivery_awb: string | null;
  tracking_status: string | null;
  orderNumber?: string | null;
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  paid: { label: "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  success: { label: "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  pending: { label: "Awaiting", color: "text-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  fulfilled: { label: "Dispatched", color: "text-blue-500", bg: "bg-blue-500/10", dot: "bg-blue-500" },
  unfulfilled: { label: "Draft", color: "text-foreground/40", bg: "bg-foreground/5", dot: "bg-foreground/20" },
  delivered: { label: "Arrived", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  payment_failed: { label: "Failed", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  failed: { label: "Failed", color: "text-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  payment_pending: { label: "Unpaid", color: "text-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  awaiting_approval: { label: "Reviewing", color: "text-purple-500", bg: "bg-purple-500/10", dot: "bg-purple-500" },
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
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    status: '',
    paymentStatus: '',
    fulfillmentStatus: '',
    deliveryStatus: '',
    paymentMethod: ''
  });

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

  useEffect(() => {
    if (order) {
      setEditValues({
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        deliveryStatus: order.deliveryStatus || 'pending',
        paymentMethod: order.paymentMethod || 'PREPAID'
      });
    }
  }, [order]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues)
      });
      const data = await res.json();
      if (data.success) {
        setToast("Protocol Updated");
        setIsEditing(false);
        fetchOrder(true);
      }
    } catch (err) {
      setToast("Update Failed");
    } finally {
      setSaving(false);
    }
  };

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
      <Loader2 className="w-6 h-6 animate-spin text-foreground/10" />
      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/20">Decrypting Profile...</p>
    </div>
  );

  if (error || !order) return (
    <div className="max-w-xl mx-auto py-24 text-center space-y-6">
      <AlertCircle className="w-8 h-8 text-rose-500/40 mx-auto" />
      <h1 className="text-xl font-semibold text-foreground tracking-tight">Access Denied</h1>
      <p className="text-sm text-foreground/40 leading-relaxed">{error || "Signal lost."}</p>
      <button onClick={() => router.back()} className="text-[11px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors">Return</button>
    </div>
  );

  let shippingAddr: any = null;
  try {
    shippingAddr = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
  } catch {
    // shippingAddress may be a plain string, not JSON
    shippingAddr = typeof order.shippingAddress === 'string' ? { address1: order.shippingAddress } : null;
  }
  const latestShipment = order.shipments?.[0];

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-32 pt-4 relative">
       <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-[100] bg-foreground text-background px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-foreground/5 pb-10">
        <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button onClick={() => window.history.back()} className="w-10 h-10 island-blur rounded-xl flex items-center justify-center hover:bg-foreground hover:text-background transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Order #{order.orderNumber || order.id.slice(-6).toUpperCase()}</h1>
                <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'cancelled' || order.status === 'payment_failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {order.status}
                </div>
                {order.orderType === 'MOBILE_APP' && (
                  <div className="px-4 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-indigo-500/20 shadow-sm">
                    <Smartphone className="w-3 h-3" />
                    Mobile Ecosystem Signal
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 px-4">
              <p className="text-[11px] text-foreground/40 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {order.shopifyOrderId && !order.shopifyOrderId.startsWith('#') && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                   <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Shopify Synced: {order.shopifyOrderId}</span>
                </div>
              )}
            </div>
          </div>

        <div className="flex items-center gap-3">
          <button onClick={() => fetchOrder(true)} className="p-3 bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 rounded-xl transition-all">
             <RefreshCw className={`w-4 h-4 text-foreground/40 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 bg-foreground/5 text-foreground/40 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-foreground/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2.5 px-8 py-2.5 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-foreground/10 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="px-8 py-2.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-[11px] font-bold uppercase tracking-widest text-foreground/60 transition-all"
              >
                Edit Order
              </button>
              <button className="flex items-center gap-2.5 px-6 py-2.5 bg-foreground text-background rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                <Printer className="w-4 h-4" />
                Invoice
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-12">
          {/* Status Alert for Failed/Cancelled */}
          {(order.status === 'cancelled' || order.status === 'payment_failed') && (
            <div className="p-8 rounded-[32px] bg-rose-500/5 border border-rose-500/10 flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-rose-500 uppercase tracking-tighter">Process Terminated</h4>
                <p className="text-[12px] text-rose-500/60 font-medium mt-1">
                  This order has been {order.status === 'cancelled' ? 'cancelled by the user' : 'failed due to payment issues'}. All downstream logistics and fulfillment protocols have been suspended.
                </p>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { 
                label: "Financial", 
                key: 'paymentStatus', 
                value: isEditing ? editValues.paymentStatus : (order.status === 'cancelled' ? 'cancelled' : (order.paymentStatus === 'failed' || order.status === 'payment_failed' ? 'failed' : order.paymentStatus)), 
                icon: CreditCard,
                options: ['pending', 'paid', 'failed', 'refunded']
              },
              { 
                label: "Inventory", 
                key: 'fulfillmentStatus', 
                value: isEditing ? editValues.fulfillmentStatus : (order.status === 'cancelled' ? 'cancelled' : (order.paymentStatus === 'failed' || order.status === 'payment_failed' ? 'failed' : order.fulfillmentStatus)), 
                icon: Box,
                options: ['unfulfilled', 'fulfilled', 'cancelled']
              },
              { 
                label: "Logistics", 
                key: 'deliveryStatus', 
                value: isEditing ? editValues.deliveryStatus : (order.status === 'cancelled' ? 'cancelled' : (order.paymentStatus === 'failed' || order.status === 'payment_failed' ? 'failed' : (order.deliveryStatus || 'awaiting'))), 
                icon: Truck,
                options: ['awaiting', 'manifested', 'in transit', 'out for delivery', 'delivered']
              },
              { 
                label: "Method", 
                key: 'paymentMethod', 
                value: isEditing ? editValues.paymentMethod : (order.tags?.includes('store-credit-used') ? 'STORE CREDIT' : (order.paymentMethod || 'PREPAID')), 
                icon: Zap,
                options: ['PREPAID', 'COD', 'STORE CREDIT']
              },
              { 
                label: "Process", 
                key: 'status', 
                value: isEditing ? editValues.status : order.status, 
                icon: Activity,
                options: ['awaiting_approval', 'approved', 'cancelled', 'payment_failed']
              },
            ].map((s, i) => (
              <div key={i} className={`p-5 rounded-[24px] border transition-all ${isEditing ? 'bg-foreground/5 border-foreground/10' : 'bg-foreground/[0.02] border-foreground/5'} space-y-3`}>
                <div className="flex justify-between items-center text-[9px] font-bold text-foreground/20 uppercase tracking-widest">
                  {s.label}
                  <s.icon className={`w-3.5 h-3.5 ${isEditing ? 'text-foreground/40' : 'opacity-20'}`} />
                </div>
                
                {isEditing && s.key !== 'network' ? (
                  <select
                    value={s.value}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    className="w-full bg-transparent text-[11px] font-bold text-foreground outline-none uppercase tracking-widest cursor-pointer"
                  >
                    {s.options?.map(opt => (
                      <option key={opt} value={opt} className="bg-[#0A0A0A] text-foreground">{opt.replace('_', ' ')}</option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={s.value} />
                )}
              </div>
            ))}
          </div>

          {/* Line Items */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em]">Inventory Manifest</h3>
              <span className="text-[10px] font-bold text-foreground/40 uppercase">{order.items.length} Elements</span>
            </div>
            
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-[24px] bg-foreground/[0.02] border border-foreground/5 group hover:bg-foreground/[0.04] transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-xl bg-foreground/5 border border-foreground/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Box className="w-6 h-6 text-foreground/10 mx-auto mt-5" />}
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-foreground tracking-tight">{item.title}</h4>
                      <p className="text-[10px] text-foreground/20 font-bold uppercase tracking-widest mt-1">QTY: {item.quantity} | SKU: {item.sku || "N/A"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-foreground tracking-tight">₹{item.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 rounded-[32px] bg-foreground/[0.03] border border-foreground/5">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest">Subtotal Manifest</p>
                    <p className="text-[13px] font-semibold text-foreground/40 tracking-tight">₹{order.subtotalPrice?.toLocaleString() || order.totalPrice.toLocaleString()}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Total Transaction Value</p>
                    <p className="text-4xl font-semibold text-foreground tracking-tighter italic">₹{order.totalPrice.toLocaleString()}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Logistics Terminal */}
          <div className={`p-10 rounded-[40px] bg-foreground/[0.02] border border-foreground/5 space-y-10 ${(order.status === 'cancelled' || order.status === 'payment_failed') ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Logistics Command</h3>
                <p className="text-[11px] text-foreground/20 font-bold uppercase tracking-widest">Delhivery B2C Fulfillment Hub</p>
              </div>
              {order.delhivery_awb && (
                <div className="px-5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[12px] font-mono font-bold text-blue-500">
                  {order.delhivery_awb}
                </div>
              )}
            </div>

            <DelhiveryActions order={order} onRefresh={() => fetchOrder(true)} />
          </div>
        </div>

        {/* Identity Panel */}
        <div className="lg:col-span-4 space-y-12">
          {/* Customer Card */}
          <div className="p-10 rounded-[40px] bg-foreground/[0.02] border border-foreground/5 space-y-10 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em]">Identity Profile</h3>
              <div className="flex items-center gap-5 pt-4">
                 <div className="w-14 h-14 rounded-[20px] bg-foreground/5 flex items-center justify-center border border-foreground/10 text-xl font-bold text-foreground/40">
                   {order.customer.name?.charAt(0) || "U"}
                 </div>
                 <div>
                   <h4 className="text-[18px] font-semibold text-foreground tracking-tight">{order.customer.name || "Anonymous"}</h4>
                   <p className="text-[10px] text-foreground/20 font-bold uppercase tracking-widest mt-1">Tier-1 Entity</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-4 p-4 rounded-[20px] bg-foreground/[0.03] border border-foreground/5 group hover:border-foreground/20 transition-all">
                  <Mail className="w-4 h-4 text-foreground/20 group-hover:text-blue-500 transition-colors" />
                  <p className="text-[12px] font-medium text-foreground/60 truncate">{order.customer.email}</p>
               </div>
               <div className="flex items-center gap-4 p-4 rounded-[20px] bg-foreground/[0.03] border border-foreground/5 group hover:border-foreground/20 transition-all">
                  <Phone className="w-4 h-4 text-foreground/20 group-hover:text-emerald-500 transition-colors" />
                  <p className="text-[12px] font-mono font-bold text-foreground/60">{order.customer.phone || "No signal"}</p>
               </div>
            </div>
          </div>

          {/* Logistics Target */}
          <div className="p-10 rounded-[40px] bg-foreground/[0.02] border border-foreground/5 space-y-10 shadow-2xl relative overflow-hidden">
             <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-purple-500/10 blur-[80px] rounded-full" />
             
            <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em] relative z-10">Terminal Location</h3>
            
            {shippingAddr ? (
              <div className="space-y-8 relative z-10">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest">Primary Vector</p>
                  <p className="text-[14px] font-semibold text-foreground/80 leading-relaxed italic">"{shippingAddr.address1}, {shippingAddr.address2}"</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest">Region</p>
                      <p className="text-[12px] font-bold text-foreground uppercase tracking-tight">{shippingAddr.city}, {shippingAddr.province}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[8px] font-bold text-foreground/20 uppercase tracking-widest">Post Code</p>
                      <p className="text-[16px] font-mono font-bold text-blue-500 tracking-tighter">{shippingAddr.zip || shippingAddr.pincode}</p>
                   </div>
                </div>

                <div className="p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/5 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Globe className="w-3.5 h-3.5 text-foreground/20" />
                      <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">{shippingAddr.country || "INDIA"}</span>
                   </div>
                   <ShieldCheck className="w-4 h-4 text-emerald-500/40" />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-foreground/20 font-bold uppercase tracking-widest italic relative z-10">Terminal data undefined.</p>
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
    color: "text-foreground/40", 
    bg: "bg-foreground/5", 
    dot: "bg-foreground/20" 
  };
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-foreground/5 ${theme.bg}`}>
      <div className={`w-1 h-1 rounded-full ${theme.dot}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>
        {theme.label}
      </span>
    </div>
  );
}
