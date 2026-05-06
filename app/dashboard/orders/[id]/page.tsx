"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";

interface LineItem {
  id: number;
  title: string;
  name?: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title?: string | null;
}

interface ShopifyOrderDetail {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  note: string | null;
  tags: string;
  email: string | null;
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
  line_items: LineItem[];
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone?: string | null;
  };
  billing_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
}

interface TrackingInfo {
  status: string;
  location: string | null;
  estimatedDelivery: string | null;
  trackingUrl: string | null;
  trackingNumber: string;
  courier: string | null;
  events: {
    status: string;
    location: string;
    timestamp: string;
    description: string;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  packed: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  shipped: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  in_transit: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  out_for_delivery: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  delivered: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  cancelled: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  label_created: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<ShopifyOrderDetail | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [mobile, setMobile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [awb, setAwb] = useState("");
  const [carrier, setCarrier] = useState("Delhivery");

  const isMobileOrderId = id && !/^\d+$/.test(id);

  const fetchOrder = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      if (isMobileOrderId) {
        const res = await fetch(`/api/admin/mobile-orders/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load mobile order");
        setMobile(data.order);
        setOrder(null);
        setTracking(null);
        setAwb(data.order?.shipment?.awb || "");
        setCarrier(data.order?.shipment?.courier || "Delhivery");
      } else {
        const res = await fetch(`/api/shopify/orders/${id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load order");
        }
        setOrder(data.order);
        setTracking(data.tracking);
        setMobile(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load order";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/20" />
      </div>
    );
  }

  if (error || (!order && !mobile)) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-3 h-3 mr-2" />
          Back
        </button>
        <div className="glass-card rounded-2xl p-6 text-rose-500 text-[10px] font-bold uppercase tracking-widest">
          {error || "Order not found"}
        </div>
      </div>
    );
  }

  if (mobile) {
    const isAwaiting = String(mobile.status || "").toLowerCase() === "awaiting_approval";
    const isCOD = String(mobile.paymentMethod || "").toUpperCase().includes("COD");
    const canApprove = isAwaiting && isCOD;
    const hasAwb = !!mobile.shipment?.awb;

    const approve = async () => {
      setActionLoading("approve");
      try {
        const res = await fetch(`/api/admin/mobile-orders/${mobile.id}/approve`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Approve failed");
        await fetchOrder(true);
      } catch (e: any) {
        setError(e.message || "Approve failed");
      } finally {
        setActionLoading(null);
      }
    };

    const saveTracking = async () => {
      setActionLoading("tracking");
      try {
        const res = await fetch(`/api/admin/mobile-orders/${mobile.id}/set-tracking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ awb, carrier }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save tracking failed");
        await fetchOrder(true);
      } catch (e: any) {
        setError(e.message || "Save tracking failed");
      } finally {
        setActionLoading(null);
      }
    };

    const markDelivered = async () => {
      setActionLoading("delivered");
      try {
        const res = await fetch(`/api/admin/mobile-orders/${mobile.id}/mark-delivered`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Mark delivered failed");
        await fetchOrder(true);
      } catch (e: any) {
        setError(e.message || "Mark delivered failed");
      } finally {
        setActionLoading(null);
      }
    };

    return (
      <div className="space-y-6 pb-20 max-w-5xl mx-auto relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            Back to Orders
          </button>
          <button
            onClick={() => fetchOrder(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-foreground/60 hover:bg-foreground/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Sync Status
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
              <ShoppingCart className="w-5 h-5 text-foreground/60" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Mobile Order #{mobile.orderNumber}</h1>
              <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-1">
                Placed {new Date(mobile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/5 text-[9px] font-bold uppercase tracking-widest text-foreground/60">
              {mobile.paymentStatus || "pending"}
            </span>
            <span className="px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/5 text-[9px] font-bold uppercase tracking-widest text-foreground/60">
              {mobile.status}
            </span>
            <span className="px-3 py-1 rounded-full bg-foreground text-background text-[9px] font-bold uppercase tracking-widest">
              ₹{Number(mobile.totalPrice || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Admin Actions</h3>
            {mobile.shopifyOrderId && (
              <a
                href={`https://8tiahf-bk.myshopify.com/admin/orders/${mobile.shopifyOrderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground"
              >
                Shopify <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {canApprove && (
            <button
              onClick={approve}
              disabled={actionLoading === "approve"}
              className="w-full py-2.5 bg-foreground text-background rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {actionLoading === "approve" ? "Approving..." : "Approve Order (Sync to Shopify)"}
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/50 mb-1.5">AWB Number</label>
              <input
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                placeholder="Enter AWB"
                className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/50 mb-1.5">Carrier</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none appearance-none"
              >
                {["Delhivery", "Shiprocket", "BlueDart", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={saveTracking}
              disabled={actionLoading === "tracking"}
              className="flex-1 py-2.5 bg-background border border-foreground/[0.05] text-foreground rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all"
            >
              {actionLoading === "tracking" ? "Saving..." : "Save AWB (Mark Shipped)"}
            </button>
            <button
              onClick={markDelivered}
              disabled={actionLoading === "delivered"}
              className="flex-1 py-2.5 bg-foreground text-background rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {actionLoading === "delivered" ? "Updating..." : "Mark as Delivered"}
            </button>
          </div>

          {hasAwb && (
            <div className="text-[10px] text-foreground/40 font-medium uppercase tracking-widest">
              Tracking saved: {mobile.shipment?.courier} • {mobile.shipment?.awb}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-foreground/5 flex items-center justify-between bg-foreground/[0.01]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Line Items</h2>
            <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">{mobile.items?.length || 0} positions</span>
          </div>
          <div className="divide-y divide-foreground/[0.03]">
            {(mobile.items || []).map((item: any) => (
              <div key={item.id} className="px-6 py-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-foreground tracking-wide">{item.title}</p>
                  {item.sku && <p className="text-[9px] text-foreground/40 font-mono">SKU: {item.sku}</p>}
                  <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest">Qty: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-foreground tracking-tight">₹{Number(item.price).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/30">Shipping Destination</label>
            <MapPin className="w-3.5 h-3.5 text-foreground/20" />
          </div>
          {mobile.shippingAddress ? (
            <address className="not-italic space-y-1">
              <p className="text-[13px] font-bold text-foreground">{mobile.shippingAddress.name}</p>
              <div className="text-[11px] text-foreground/60 font-medium leading-relaxed">
                <p>{mobile.shippingAddress.line1}</p>
                {mobile.shippingAddress.line2 && <p>{mobile.shippingAddress.line2}</p>}
                <p>
                  {mobile.shippingAddress.city}, {mobile.shippingAddress.state} {mobile.shippingAddress.pincode}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/30 mt-2">{mobile.shippingAddress.country}</p>
              </div>
            </address>
          ) : (
            <p className="text-[10px] text-foreground/20 italic font-medium">No shipping information available.</p>
          )}
        </div>
      </div>
    );
  }

  const customerName = order.customer
    ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
    : "";

  const displayCustomerName = customerName || (order.customer ? "Name Redacted" : "Anonymous");

  const tags = order.tags
    ? order.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto relative z-10">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-2" />
          Back to Orders
        </button>
        <button
          onClick={() => fetchOrder(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-foreground/60 hover:bg-foreground/10 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Sync Status
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner">
            <ShoppingCart className="w-5 h-5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Order {order.name}
            </h1>
            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-1">
              Placed {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/5 text-[9px] font-bold uppercase tracking-widest text-foreground/60">
            {order.financial_status || "pending"}
          </span>
          <span className="px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/5 text-[9px] font-bold uppercase tracking-widest text-foreground/60">
            {order.fulfillment_status || "unfulfilled"}
          </span>
          <span className="px-3 py-1 rounded-full bg-foreground text-background text-[9px] font-bold uppercase tracking-widest">
            ₹{parseFloat(order.total_price).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tracking & Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tracking Card */}
          {tracking ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-foreground/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Delivery Tracking</h3>
                    <p className="text-[9px] text-foreground/40 uppercase tracking-widest mt-0.5">{tracking.courier || 'Logistics Partner'}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border ${STATUS_COLORS[tracking.status] || 'text-foreground/50 bg-foreground/5 border-foreground/10'}`}>
                  {tracking.status}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                     <label className="block text-[8px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-2">Tracking Number</label>
                     <div className="flex items-center gap-2">
                       <span className="text-[14px] font-mono font-medium text-foreground">{tracking.trackingNumber}</span>
                       {tracking.trackingUrl && (
                         <a href={tracking.trackingUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-foreground/5 rounded-lg hover:bg-foreground/10 transition-colors">
                           <ExternalLink className="w-3 h-3 text-foreground/40" />
                         </a>
                       )}
                     </div>
                   </div>

                   {tracking.estimatedDelivery && (
                     <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                       <Clock className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-600/60">Estimated Delivery</p>
                         <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                           {new Date(tracking.estimatedDelivery).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                         </p>
                       </div>
                     </div>
                   )}
                </div>

                <div className="space-y-4">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-2">Tracking History</label>
                  <div className="space-y-0 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                    {tracking.events?.length > 0 ? (
                      tracking.events.map((event, i) => (
                        <div key={i} className="flex gap-4 relative">
                          <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-foreground/20'} z-10 mt-1`} />
                            {i < tracking.events.length - 1 && <div className="w-px flex-1 bg-foreground/5 my-1" />}
                          </div>
                          <div className="pb-5">
                            <p className="text-[10px] font-bold text-foreground leading-tight">{event.description || event.status}</p>
                            <p className="text-[9px] text-foreground/40 mt-1 uppercase tracking-wide">
                              {event.location && `${event.location} · `}
                              {new Date(event.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-foreground/30 italic">No events recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Truck className="w-8 h-8 text-foreground/10 mx-auto mb-3" />
              <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Shipment not yet initiated</p>
              <p className="text-[9px] text-foreground/20 mt-1 uppercase tracking-widest">Tracking info will appear here once fulfilled</p>
            </div>
          )}

          {/* Line Items */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-foreground/5 flex items-center justify-between bg-foreground/[0.01]">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Order Inventory</h2>
              <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">{order.line_items.length} positions</span>
            </div>
            <div className="divide-y divide-foreground/[0.03]">
              {order.line_items.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between group hover:bg-foreground/[0.01] transition-colors">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-foreground tracking-wide">{item.name || item.title}</p>
                    <div className="flex items-center gap-3 text-[9px] text-foreground/40 font-bold uppercase tracking-widest">
                      {item.variant_title && <span className="text-foreground/60 border-r border-foreground/10 pr-3">Size: {item.variant_title}</span>}
                      {item.sku && <span className="text-foreground/30">SKU: {item.sku}</span>}
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-foreground tracking-tight">₹{parseFloat(item.price).toLocaleString("en-IN")}</p>
                    <p className="text-[9px] text-foreground/20 uppercase font-bold tracking-widest mt-0.5">{order.currency}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-foreground/[0.02] border-t border-foreground/5 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/30">Order Total</span>
              <span className="text-[16px] font-bold text-foreground tracking-tight">₹{parseFloat(order.total_price).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Address */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/30 mb-3">Customer Entity</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center border border-foreground/5 font-bold text-foreground/60 text-[12px]">
                  {displayCustomerName.charAt(0)}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">{displayCustomerName}</p>
                  <div className="space-y-0.5 mt-1">
                    {order.customer?.email && (
                      <p className="flex items-center gap-2 text-[10px] text-foreground/40 font-medium">
                        <Mail className="w-3 h-3" /> {order.customer.email}
                      </p>
                    )}
                    {order.customer?.phone && (
                      <p className="flex items-center gap-2 text-[10px] text-foreground/40 font-medium">
                        <Phone className="w-3 h-3" /> {order.customer.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {tags.length > 0 && (
              <div className="pt-4 border-t border-foreground/5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/30 mb-3 flex items-center gap-2">
                  <Tag className="w-3 h-3" /> Classification Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-md bg-foreground/5 text-[9px] font-bold uppercase tracking-widest text-foreground/50 border border-foreground/5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.note && (
              <div className="pt-4 border-t border-foreground/5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/30 mb-2">Order Intelligence</label>
                <div className="p-3 bg-amber-500/[0.03] border border-amber-500/10 rounded-xl">
                  <p className="text-[10px] text-amber-900/70 dark:text-amber-400 font-medium leading-relaxed italic">"{order.note}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Logistics Address Card */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/30">Shipping Destination</label>
              <MapPin className="w-3.5 h-3.5 text-foreground/20" />
            </div>
            
            {order.shipping_address ? (
              <address className="not-italic space-y-1">
                <p className="text-[13px] font-bold text-foreground">
                  {order.shipping_address.first_name} {order.shipping_address.last_name}
                </p>
                <div className="text-[11px] text-foreground/60 font-medium leading-relaxed">
                  <p>{order.shipping_address.address1}</p>
                  {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                  <p>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/30 mt-2">{order.shipping_address.country}</p>
                </div>
                {order.shipping_address.phone && (
                  <p className="flex items-center gap-2 text-[10px] text-foreground/40 font-bold mt-4 bg-foreground/5 p-2 rounded-lg inline-block">
                    <Phone className="w-3 h-3" /> {order.shipping_address.phone}
                  </p>
                )}
              </address>
            ) : (
              <p className="text-[10px] text-foreground/20 italic font-medium">No shipping information available.</p>
            )}

            {order.billing_address && (
              <div className="mt-8 pt-6 border-t border-foreground/5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/30 mb-4">Billing Information</label>
                <div className="text-[10px] text-foreground/40 font-medium leading-relaxed">
                  <p className="font-bold text-foreground/60">{order.billing_address.first_name} {order.billing_address.last_name}</p>
                  <p>{order.billing_address.address1}</p>
                  <p>{order.billing_address.city}, {order.billing_address.province} {order.billing_address.zip}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
