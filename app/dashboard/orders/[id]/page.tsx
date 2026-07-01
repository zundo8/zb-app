"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  ArrowRight,
  ScanLine
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
  shopifyOrderId: string | null;
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
  internalOrderNumber?: string | null;
  shopifyOrderName?: string | null;
  shopifySyncStatus?: string | null;
  shopifySyncError?: string | null;
  refundStatus?: string | null;
  refundError?: string | null;
  refundAttempts?: number;
}

function isCustomSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  return /^ZB\d{2}[A-Z]{2}\d{2}[A-Z]{2}(XS|S|M|L|XL|XXL)\d+$/i.test(sku);
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
  const { data: session } = useSession();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delhiveryLoading, setDelhiveryLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
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

  const handleShopifySync = async () => {
    if (syncing) return;
    setSyncing(true);
    setToast("Initiating Shopify Sync...");
    try {
      const res = await fetch(`/api/admin/orders/${id}/sync-shopify`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setToast("Shopify Sync Complete");
        fetchOrder(true);
      } else {
        setToast(data.error || "Sync Failed");
        fetchOrder(true);
      }
    } catch (err: any) {
      setToast(err.message || "Sync Failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRetryRefund = async () => {
    if (refunding) return;
    setRefunding(true);
    setToast("Initiating Razorpay Refund...");
    try {
      const res = await fetch(`/api/admin/orders/${id}/retry-refund`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setToast("Refund Completed");
        fetchOrder(true);
      } else {
        setToast(data.error || "Refund Failed");
        fetchOrder(true);
      }
    } catch (err: any) {
      setToast(err.message || "Refund Failed");
    } finally {
      setRefunding(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleCancelOrder = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'cancelled' })
      });
      const data = await res.json();
      if (data.success) {
        setToast("Order Cancelled");
        setShowCancelModal(false);
        fetchOrder(true);
      } else {
        setToast(data.error || "Cancellation Failed");
      }
    } catch (err: any) {
      setToast(err.message || "Cancellation Failed");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
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

  const handleUpdateItemSku = async (itemId: string, sku: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: itemId, sku: sku.trim() }]
        })
      });
      const data = await res.json();
      if (data.success) {
        setToast("SKU Assigned");
        fetchOrder(true);
      } else {
        setToast(data.error || "Update Failed");
      }
    } catch (err: any) {
      setToast(err.message || "Update Failed");
    } finally {
      setSaving(false);
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
            className={`fixed top-8 left-1/2 z-[100] px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-2xl ${
              /failed|error|mismatch|invalid|sold/i.test(toast) 
                ? 'bg-rose-500 text-white' 
                : 'bg-foreground text-background'
            }`}
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
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Order {order.internalOrderNumber || (order.orderNumber && `#${order.orderNumber}`) || `#${order.id.slice(-6).toUpperCase()}`}</h1>
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
                <div className="flex justify-between items-center text-[9px] font-bold text-foreground/50 dark:text-foreground/30 uppercase tracking-widest">
                  {s.label}
                  <s.icon className={`w-3.5 h-3.5 ${isEditing ? 'text-foreground/60 dark:text-foreground/40' : 'opacity-20'}`} />
                </div>
                
                {isEditing && s.key !== 'network' ? (
                  <select
                    value={s.value}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    className="w-full bg-transparent text-[11px] font-bold text-foreground outline-none uppercase tracking-widest cursor-pointer"
                  >
                    {s.options?.map(opt => (
                      <option key={opt} value={opt} className="dark:bg-[#0A0A0A] bg-white text-foreground">{opt.replace('_', ' ')}</option>
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
              <h3 className="text-[10px] font-bold text-foreground/50 dark:text-foreground/30 uppercase tracking-[0.4em]">Inventory Manifest</h3>
              <span className="text-[10px] font-bold text-foreground/60 dark:text-foreground/40 uppercase">{order.items.length} Elements</span>
            </div>
            
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-[24px] bg-foreground/[0.02] border border-foreground/5 group hover:bg-foreground/[0.04] transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-xl bg-foreground/5 border border-foreground/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Box className="w-6 h-6 text-foreground/10 mx-auto mt-5" />}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[14px] font-semibold text-foreground tracking-tight">{item.title}</h4>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] text-foreground/60 dark:text-foreground/45 font-bold uppercase tracking-widest">
                          QTY: {item.quantity}
                        </span>
                        <span className="text-foreground/20">|</span>
                        {isCustomSku(item.sku) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">
                              SKU: {item.sku}
                            </span>
                            <button
                              onClick={() => handleUpdateItemSku(item.id, '')}
                              title="Clear SKU"
                              className="text-rose-500 hover:text-rose-700 p-0.5 hover:bg-rose-500/10 rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                            {item.sku && (
                              <span className="text-[9px] text-foreground/50 dark:text-foreground/45 font-semibold uppercase tracking-wider bg-foreground/5 px-2 py-0.5 rounded">
                                Variant: {item.sku}
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="relative flex items-center">
                                <ScanLine className="absolute left-2.5 w-3.5 h-3.5 text-foreground/45 dark:text-foreground/35" />
                                <input
                                  id={`sku-input-${item.id}`}
                                  type="text"
                                  placeholder="Scan SKU to dispatch..."
                                  defaultValue=""
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value;
                                      if (val.trim()) {
                                        handleUpdateItemSku(item.id, val);
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  className="bg-foreground/5 border border-foreground/10 rounded-lg pl-8 pr-2.5 py-1 text-[10px] font-mono w-40 focus:outline-none focus:border-[#007AFF]/50 placeholder:text-foreground/30 text-foreground transition-all"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const inputEl = document.getElementById(`sku-input-${item.id}`) as HTMLInputElement;
                                  if (inputEl && inputEl.value.trim()) {
                                    handleUpdateItemSku(item.id, inputEl.value);
                                    inputEl.value = '';
                                  }
                                }}
                                className="px-3 py-1 bg-foreground text-background dark:bg-foreground dark:text-background rounded-lg text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
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

            <DelhiveryActions order={order as any} onRefresh={() => fetchOrder(true)} />
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
            
            {shippingAddr && (
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
            )}
          </div>

          {/* Operations Control Card */}
          <div className="p-10 rounded-[40px] bg-foreground/[0.02] border border-foreground/5 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-blue-500/5 blur-[80px] rounded-full" />
            
            <h3 className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em] relative z-10">Operations Control</h3>
            
            {/* Shopify Sync Status Row */}
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">Shopify Status</span>
                {order.shopifySyncStatus === 'synced' ? (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">Synced</span>
                ) : order.shopifySyncStatus === 'failed' ? (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/10">Failed</span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/10">Pending</span>
                )}
              </div>
              
              {order.shopifySyncError && (
                <p className="text-[10px] text-rose-500/70 font-mono leading-tight bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 break-all">
                  Error: {order.shopifySyncError}
                </p>
              )}

              {order.shopifySyncStatus !== 'synced' && (
                <button
                  onClick={handleShopifySync}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync with Shopify
                </button>
              )}
            </div>

            <div className="h-[1px] bg-foreground/5 relative z-10" />

            {/* Refund Status Row (only if cancelled) */}
            {order.status === 'cancelled' && (
              <>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">Refund Status</span>
                    {order.refundStatus === 'completed' ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">Completed</span>
                    ) : order.refundStatus === 'failed' ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/10">Failed</span>
                    ) : order.refundStatus === 'processing' ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/10">Processing</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/30 bg-foreground/5 px-2.5 py-1 rounded-lg border border-foreground/10">N/A</span>
                    )}
                  </div>

                  {order.refundError && (
                    <p className="text-[10px] text-rose-500/70 font-mono leading-tight bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 break-all">
                      Error: {order.refundError} (Attempts: {order.refundAttempts})
                    </p>
                  )}

                  {order.refundStatus === 'failed' && (
                    <button
                      onClick={handleRetryRefund}
                      disabled={refunding}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      {refunding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Retry Refund
                    </button>
                  )}
                </div>
                <div className="h-[1px] bg-foreground/5 relative z-10" />
              </>
            )}

            {/* Cancel Action Row */}
            {order.status !== 'cancelled' && (
              <div className="space-y-4 relative z-10">
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={['shipped', 'delivered', 'in transit', 'out for delivery'].includes((order.deliveryStatus || '').toLowerCase())}
                  className="w-full py-3.5 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500/20 text-rose-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.98]"
                >
                  Cancel Order
                </button>
                {['shipped', 'delivered', 'in transit', 'out for delivery'].includes((order.deliveryStatus || '').toLowerCase()) && (
                  <p className="text-[8px] text-foreground/30 uppercase tracking-widest text-center leading-normal">
                    Cancellation blocked — Order has already left terminal
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Custom Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelModal(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card p-10 rounded-[36px] border border-foreground/10 shadow-2xl space-y-8 bg-[#0C0C0C]/95 text-left z-10"
            >
              <div className="flex items-center gap-4 text-rose-500">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight leading-none">Terminate Process</h3>
                  <p className="text-[10px] text-rose-500/50 uppercase tracking-[0.2em] mt-1.5 font-bold">Zica Bella D2C Protocol</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[13px] text-foreground/75 leading-relaxed font-medium">
                  Are you absolutely certain you want to cancel order <strong className="text-foreground">{order?.internalOrderNumber || order?.id}</strong>?
                </p>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-2 text-[11px] text-rose-500/70 font-medium">
                  <p>• Online payments (prepaid/upfront COD fees) will be automatically refunded via Razorpay.</p>
                  <p>• All downstream logistics, shipments, and Delhivery waybills will be terminated.</p>
                  <p>• Shopify catalog allocations will be released and restocked.</p>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground/60 hover:text-foreground text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={saving}
                  className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-rose-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
                  Terminate Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
