"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Truck,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Save,
  Sparkles,
  ExternalLink,
  Settings
} from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  product_id: string;
  variant_id: string;
  title: string;
  image_url: string;
  quantity: number;
  price: number;
}

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Address;
  items: LineItem[];
  subtotal: number;
  shippingCharge: number;
  discountCode?: string;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  fulfillmentStatus: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export default function WebStoreOrderDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Editable fields states
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/web-store/orders/${params.id}`);
      if (!res.ok) throw new Error("Order not found");
      const data = await res.json();
      setOrder(data.order);
      
      // Initialize states
      setPaymentStatus(data.order.paymentStatus);
      setFulfillmentStatus(data.order.fulfillmentStatus);
      setTrackingNumber(data.order.trackingNumber || "");
      setTrackingUrl(data.order.trackingUrl || "");
      setNotes(data.order.notes || "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load order detail");
      router.push("/web-store/orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [params.id]);

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await fetch(`/api/web-store/orders/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentStatus,
          fulfillmentStatus,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update order");
      const result = await res.json();
      setOrder(result.order);
      toast.success("Order updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Error updating order");
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Delivered</span>;
      case "shipped":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20"><Truck className="w-3.5 h-3.5" /> Shipped</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Processing</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3.5 h-3.5" /> Unfulfilled</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span>;
      case "failed":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Failed</span>;
      case "refunded":
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Refunded</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-foreground/10 rounded-lg" />
        <div className="h-32 bg-foreground/5 rounded-[2rem]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 lg:col-span-2 bg-foreground/5 rounded-[2rem]" />
          <div className="h-96 bg-foreground/5 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-8">
      {/* Back button & Page title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/web-store/orders"
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-foreground/5 text-foreground/60 border border-foreground/10 hover:bg-foreground/10 hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-inter flex items-center gap-2">
              Order {order.orderNumber} <Sparkles className="w-5 h-5 text-amber-500" />
            </h1>
            <p className="text-[12px] text-foreground/50 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Placed on {formatDate(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getPaymentBadge(order.paymentStatus)}
          {getFulfillmentBadge(order.fulfillmentStatus)}
        </div>
      </div>

      {/* Main Grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Order items & Summary */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Order items list */}
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-6">
            <h3 className="text-base font-bold text-foreground font-inter flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" /> Line Items ({order.items.length})
            </h3>
            
            <div className="divide-y divide-foreground/5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-16 h-20 rounded-xl bg-foreground/5 border border-foreground/10 relative overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-foreground/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[12px] font-bold text-foreground truncate">{item.title}</h4>
                      <p className="text-[10px] text-foreground/40 mt-1 font-mono uppercase tracking-wider">
                        Variant: {item.variant_id || "default"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground/50 font-medium">
                        Qty: {item.quantity}
                      </span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(item.price)} each
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing summary */}
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-4">
            <h3 className="text-base font-bold text-foreground font-inter flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" /> Payment & Billing Summary
            </h3>
            
            <div className="space-y-2 text-[12px] pt-2">
              <div className="flex justify-between text-foreground/60 font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-foreground/60 font-medium">
                <span>Shipping Charges</span>
                <span>{formatCurrency(order.shippingCharge)}</span>
              </div>
              {order.discountCode && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1">Discount Code ({order.discountCode})</span>
                  <span>-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="h-[1px] bg-foreground/5 my-2" />
              <div className="flex justify-between text-[14px] font-extrabold text-foreground">
                <span>Grand Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer Details */}
            <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-4">
              <h3 className="text-base font-bold text-foreground font-inter flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" /> Customer Profile
              </h3>
              <div className="space-y-3 text-[12px] pt-2">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-foreground/30 shrink-0" />
                  <span className="font-semibold text-foreground">{order.customerName}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-foreground/30 shrink-0" />
                  <a href={`mailto:${order.customerEmail}`} className="text-foreground/70 hover:text-amber-500 transition-colors truncate">
                    {order.customerEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-foreground/30 shrink-0" />
                  <a href={`tel:${order.customerPhone}`} className="text-foreground/70 hover:text-amber-500 transition-colors">
                    {order.customerPhone || "Not provided"}
                  </a>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-4">
              <h3 className="text-base font-bold text-foreground font-inter flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" /> Shipping Destination
              </h3>
              <div className="space-y-1.5 text-[12px] pt-2 text-foreground/75 font-medium">
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Admin Controls & Modifiers */}
        <div className="space-y-8">
          
          {/* Form container */}
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-6">
            <h3 className="text-base font-bold text-foreground font-inter flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" /> Order Operations
            </h3>

            <form onSubmit={handleUpdateOrder} className="space-y-4 text-xs font-medium">
              
              {/* Payment status */}
              <div className="space-y-2">
                <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="pending" className="bg-[#0e0e0e]">Pending</option>
                  <option value="paid" className="bg-[#0e0e0e]">Paid</option>
                  <option value="failed" className="bg-[#0e0e0e]">Failed</option>
                  <option value="refunded" className="bg-[#0e0e0e]">Refunded</option>
                </select>
              </div>

              {/* Fulfillment status */}
              <div className="space-y-2">
                <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Fulfillment Status</label>
                <select
                  value={fulfillmentStatus}
                  onChange={(e) => setFulfillmentStatus(e.target.value)}
                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="unfulfilled" className="bg-[#0e0e0e]">Unfulfilled</option>
                  <option value="processing" className="bg-[#0e0e0e]">Processing</option>
                  <option value="shipped" className="bg-[#0e0e0e]">Shipped</option>
                  <option value="delivered" className="bg-[#0e0e0e]">Delivered</option>
                  <option value="returned" className="bg-[#0e0e0e]">Returned</option>
                </select>
              </div>

              {/* Tracking number */}
              <div className="space-y-2">
                <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g. AWB10293847"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                />
              </div>

              {/* Tracking URL */}
              <div className="space-y-2">
                <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">
                  Tracking URL 
                  {order.trackingUrl && (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-amber-500 hover:text-amber-400">
                      (Open <ExternalLink className="w-2.5 h-2.5" />)
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://delhivery.com/track..."
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                />
              </div>

              {/* Internal Notes */}
              <div className="space-y-2">
                <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Internal Order Notes</label>
                <textarea
                  placeholder="Add details about packaging, special discounts, returns, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full py-3 px-4 rounded-xl font-bold bg-amber-500 text-black hover:opacity-95 transition-opacity flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-4 h-4" /> {updating ? "Saving Changes..." : "Save Order Configuration"}
              </button>
            </form>
          </div>

          {/* Integration metadata (Razorpay/web logs) */}
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 md:p-8 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-foreground font-inter flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> Integration Parameters
            </h3>
            
            <div className="space-y-2 pt-2 text-[11px] font-mono text-foreground/60 leading-relaxed break-all">
              <div>
                <span className="text-foreground/45 font-sans font-bold uppercase tracking-wider block text-[9px] mb-0.5">Order ID</span>
                {order.id}
              </div>
              <div>
                <span className="text-foreground/45 font-sans font-bold uppercase tracking-wider block text-[9px] mb-0.5">Order Source</span>
                <span className="text-amber-500 font-bold uppercase">{order.source} storefront</span>
              </div>
              {order.razorpayOrderId && (
                <div>
                  <span className="text-foreground/45 font-sans font-bold uppercase tracking-wider block text-[9px] mb-0.5">Razorpay Order ID</span>
                  {order.razorpayOrderId}
                </div>
              )}
              {order.razorpayPaymentId && (
                <div>
                  <span className="text-foreground/45 font-sans font-bold uppercase tracking-wider block text-[9px] mb-0.5">Razorpay Payment ID</span>
                  {order.razorpayPaymentId}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
