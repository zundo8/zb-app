"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Plus,
  X,
  Edit2,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LineItem {
  id: number;
  title: string;
  name?: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title?: string | null;
}

interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  deliveryStatus?: string;
  note: string | null;
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  line_items: LineItem[];
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    company?: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone?: string | null;
  };
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: {
    id: number;
    title: string;
    price: string;
    inventory_quantity: number;
  }[];
}

const SHOPIFY_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com";

type StatusFilter = "any" | "unfulfilled" | "fulfilled" | "refunded";
type OrdersSource = "shopify" | "mobile-app";

function StatusBadge({ status, type }: { status: string | null; type: "payment" | "fulfillment" | "delivery" }) {
  const label = status || (type === "fulfillment" ? "unfulfilled" : type === "delivery" ? "pending" : "pending");
  const colors: Record<string, string> = {
    paid: "bg-green-500/10 text-green-600 dark:text-green-400",
    refunded: "bg-red-500/10 text-red-600 dark:text-red-400",
    partially_refunded: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    fulfilled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    delivered: "bg-green-500/10 text-green-600 dark:text-green-400",
    partial: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    unfulfilled: "bg-foreground/[0.05] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50",
    pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    authorized: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest ${colors[label] || "bg-foreground/[0.05] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50"}`}>
      {label}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [mobileOrders, setMobileOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fulfilling, setFulfilling] = useState<number | null>(null);
  const [delivering, setDelivering] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [source, setSource] = useState<OrdersSource>("shopify");
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [razorpayReady, setRazorpayReady] = useState<boolean | null>(null);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ShopifyOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const syncLogistics = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/logistics/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setToast(`Successfully synced ${data.syncedCount} orders.`);
        fetchOrders();
      } else {
        setToast("Sync failed: " + data.error);
      }
    } catch (err) {
      setToast("Sync error");
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Forms
  const [createForm, setCreateForm] = useState({
    email: "", firstName: "", lastName: "", variantId: "", quantity: 1, address1: "", city: "", zip: "", country: ""
  });
  const [editForm, setEditForm] = useState({ note: "", email: "" });
  
  // Product Selection State
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  useEffect(() => {
    if (isCreateModalOpen && products.length === 0) {
      const loadProducts = async () => {
        setIsProductsLoading(true);
        try {
          const res = await fetch("/api/shopify/products");
          const data = await res.json();
          setProducts(data.products || []);
        } catch (err) {
          console.error("Failed to fetch products", err);
        } finally {
          setIsProductsLoading(false);
        }
      };
      loadProducts();
    }
  }, [isCreateModalOpen, products.length]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      if (source === "mobile-app") {
        const res = await fetch(`/api/admin/mobile-orders?limit=50`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch mobile orders");
        setMobileOrders(data.orders || []);
      } else {
        const res = await fetch(
          `/api/shopify/orders?limit=50&status=${statusFilter === "any" ? "any" : "open"}`
        );
        const data = await res.json();
        setOrders(data.orders || []);
        if (data.error) setError(`Shopify API: ${data.error}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, source]);

  useEffect(() => {
    fetch("/api/admin/payment-status")
      .then((r) => r.json())
      .then((d: { razorpayReady?: boolean }) => setRazorpayReady(!!d.razorpayReady))
      .catch(() => setRazorpayReady(false));
  }, []);

  const handleFulfill = async (order: ShopifyOrder) => {
    setFulfilling(order.id);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fulfillment failed");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, fulfillment_status: "fulfilled" } : o
        )
      );
      showToast(`Order ${order.name} fulfilled`);
    } catch (err: unknown) {
      showToast(`Error: ${err instanceof Error ? err.message : "Fulfillment failed"}`);
    } finally {
      setFulfilling(null);
    }
  };

  const handleDeliver = async (order: ShopifyOrder) => {
    setDelivering(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delivery update failed");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, deliveryStatus: "delivered" } : o
        )
      );
      showToast(`Order ${order.name} delivered`);
    } catch (err: unknown) {
      showToast(`Error: ${err instanceof Error ? err.message : "Delivery update failed"}`);
    } finally {
      setDelivering(null);
    }
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/shopify/orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editForm.note, email: editForm.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, note: editForm.note, email: editForm.email } : o));
      showToast("Order updated");
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      showToast(`Error: ${err instanceof Error ? err.message : "Update failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.variantId) {
      showToast("Select a product variant");
      return;
    }
    
    setActionLoading(true);
    try {
      const payload = {
        customer: { email: createForm.email, first_name: createForm.firstName, last_name: createForm.lastName },
        line_items: [{ variant_id: parseInt(createForm.variantId, 10), quantity: createForm.quantity }],
        shipping_address: { address1: createForm.address1, city: createForm.city, zip: createForm.zip, country: createForm.country, first_name: createForm.firstName, last_name: createForm.lastName },
        financial_status: 'pending'
      };

      const res = await fetch(`/api/shopify/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      
      setOrders(prev => [data.order, ...prev]);
      showToast("Order created");
      setIsCreateModalOpen(false);
      setCreateForm({ email: "", firstName: "", lastName: "", variantId: "", quantity: 1, address1: "", city: "", zip: "", country: "" });
      setSelectedProductId("");
    } catch (err: unknown) {
      showToast(`Error: ${err instanceof Error ? err.message : "Create failed"}`);
    } finally {
        setActionLoading(false);
    }
  };

  const displayedOrders = orders.filter((o) => {
    if (statusFilter === "unfulfilled" && o.fulfillment_status === "fulfilled") return false;
    if (statusFilter === "fulfilled" && o.fulfillment_status !== "fulfilled") return false;
    if (statusFilter === "refunded" && o.financial_status !== "refunded") return false;
    if (search) {
      const term = search.toLowerCase();
      const customerName = o.customer
        ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.toLowerCase()
        : "";
      return o.name.toLowerCase().includes(term) || customerName.includes(term) ||
        o.customer?.email?.toLowerCase().includes(term);
    }
    return true;
  });

  const displayedMobileOrders = mobileOrders.filter((o: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      String(o.orderNumber || "").toLowerCase().includes(term) ||
      String(o.id || "").toLowerCase().includes(term) ||
      String(o.shippingAddress?.name || "").toLowerCase().includes(term) ||
      String(o.customer?.email || "").toLowerCase().includes(term) ||
      String(o.customer?.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20 relative z-10"
    >
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-8 left-1/2 z-50 bg-background border border-foreground/[0.05] rounded-md px-4 py-2 text-[10px] font-medium text-foreground shadow-sm flex items-center gap-2 uppercase tracking-wide"
          >
            <Check className="w-3 h-3 text-green-500" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 relative z-10">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Orders
          </h1>
          <p className="text-[11px] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 tracking-wide max-w-xl">
            Manage fulfillment, payments, and order details.
          </p>
        </div>
        
         <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-foreground/[0.05] text-foreground rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-foreground/[0.02] transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Order
          </button>
          <button
            onClick={syncLogistics}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {syncing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {syncing ? "Syncing..." : "Sync Shiprocket"}
          </button>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-foreground/[0.05] text-foreground rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-foreground/[0.08] disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters & Search */}
       <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40" />
          <input
            className="w-full bg-background border border-foreground/[0.05] rounded-md pl-9 pr-4 py-2 text-[11px] font-medium text-foreground placeholder:text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 focus:outline-none focus:border-foreground/20 transition-colors uppercase tracking-widest"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center bg-background border border-foreground/[0.05] rounded-md p-1">
          {(["shopify", "mobile-app"] as OrdersSource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1.5 rounded-[4px] text-[9px] font-medium uppercase tracking-[0.15em] transition-colors ${
                source === s ? "bg-foreground text-background" : "text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 hover:bg-foreground/[0.03]"
              }`}
            >
              {s === "shopify" ? "Shopify" : "Mobile App"}
            </button>
          ))}
        </div>
        {source === "shopify" && (
          <div className="flex items-center bg-background border border-foreground/[0.05] rounded-md p-1">
            {(["any", "unfulfilled", "fulfilled", "refunded"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-[4px] text-[9px] font-medium uppercase tracking-[0.15em] transition-colors ${
                  statusFilter === s ? "bg-foreground text-background" : "text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 hover:bg-foreground/[0.03]"
                }`}
              >
                {s === "any" ? "All" : s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-[10px] font-medium uppercase tracking-widest text-red-600 dark:text-red-400 mb-6">
          Error: {error}
        </div>
      )}

      {/* Razorpay readiness (server-checked: dashboard DB or env, both ID + secret) */}
      {razorpayReady === false && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Razorpay not configured</h4>
            <p className="text-[10px] text-amber-600/80 mt-1 leading-relaxed">
              Add your Razorpay Key ID and Key Secret under{" "}
              <Link href="/dashboard/settings" className="underline font-semibold">
                Settings → Payment Gateways
              </Link>{" "}
              and save, or set{" "}
              <code className="bg-amber-500/10 px-1 rounded">RAZORPAY_KEY_ID</code> and{" "}
              <code className="bg-amber-500/10 px-1 rounded">RAZORPAY_KEY_SECRET</code> on the server. Then open the{" "}
              <Link href="/dashboard/payments/razorpay" className="underline font-semibold">
                Razorpay setup page
              </Link>{" "}
              for webhooks and mobile app notes.
            </p>
          </div>
        </div>
      )}

      {/* Orders Table */}
       <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
              <tr>
                <th className="px-5 py-3 w-8"></th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">Order</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">Customer</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">Payment</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">Fulfillment</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">Delivery</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest text-right">Total</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest text-center">Date</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.05]">
              {loading && ((source === "shopify" && orders.length === 0) || (source === "mobile-app" && mobileOrders.length === 0)) ? (
                 <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-[10px] font-medium uppercase tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : (source === "shopify" ? displayedOrders.length === 0 : displayedMobileOrders.length === 0) ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40">
                    <p className="text-[10px] font-medium uppercase tracking-widest">No orders found</p>
                  </td>
                </tr>
              ) : (
                source === "shopify"
                  ? displayedOrders.map((order) => {
                  const rawName = order.customer
                    ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
                    : "";
                  const customerName = rawName || (order.customer ? "Guest" : "Unknown");
                  const isExpanded = expanded === order.id;
                  const isFulfilling = fulfilling === order.id;
                  const isDelivering = delivering === order.id;
                  const canFulfill = !order.fulfillment_status || order.fulfillment_status === "unfulfilled";
                  const canDeliver = order.fulfillment_status === "fulfilled" && order.deliveryStatus !== "delivered";

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-foreground/[0.01]' : 'hover:bg-foreground/[0.02]'}`}
                        onClick={() => setExpanded(isExpanded ? null : order.id)}
                      >
                         <td className="px-5 py-3 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/orders/${order.id}`} className="text-[12px] font-semibold text-foreground hover:text-foreground/70 transition-colors" onClick={(e) => e.stopPropagation()}>
                            {order.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className={`text-[11px] font-medium ${rawName ? "text-foreground" : "text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 italic"}`}>{customerName}</div>
                          {order.customer?.email && <div className="text-[9px] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mt-0.5">{order.customer.email}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.financial_status} type="payment" />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.fulfillment_status} type="fulfillment" />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.deliveryStatus || 'pending'} type="delivery" />
                        </td>
                        <td className="px-5 py-3 text-[12px] font-medium text-foreground text-right">
                          ₹{parseFloat(order.total_price).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-3 text-[10px] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest text-center">
                          {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                             {canFulfill && (
                               <button
                                 onClick={() => handleFulfill(order)}
                                 disabled={isFulfilling}
                                 className="px-2 py-1 bg-foreground text-background rounded-sm text-[9px] font-medium uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                               >
                                 {isFulfilling ? "..." : "Fulfill"}
                               </button>
                             )}
                             {canDeliver && (
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleDeliver(order); }}
                                 disabled={isDelivering}
                                 className="px-2 py-1 bg-background border border-foreground/[0.05] text-foreground rounded-sm text-[9px] font-medium uppercase tracking-widest hover:bg-foreground/[0.02] transition-colors disabled:opacity-50"
                               >
                                 {isDelivering ? "..." : "Deliver"}
                               </button>
                             )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOrder(order);
                                setEditForm({ note: order.note || "", email: order.customer?.email || "" });
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 hover:text-foreground transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`https://${SHOPIFY_DOMAIN}/admin/orders/${order.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr 
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             exit={{ opacity: 0, height: 0 }}
                             className="bg-foreground/[0.01] border-b border-foreground/[0.05] overflow-hidden"
                          >
                            <td colSpan={9} className="p-0">
                               <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                  {/* Line Items */}
                                  <div>
                                    <h4 className="text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-3 border-b border-foreground/[0.05] pb-2">
                                      Items ({order.line_items.length})
                                    </h4>
                                    <div className="space-y-3">
                                      {order.line_items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start text-sm">
                                          <div className="max-w-[70%]">
                                            <p className="text-[11px] font-medium text-foreground break-words">{item.name || item.title}</p>
                                            {item.sku && <p className="text-[9px] font-mono text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 mt-0.5">SKU: {item.sku}</p>}
                                          </div>
                                          <div className="text-[11px] font-medium text-foreground text-right">
                                            {item.quantity} × ₹{parseFloat(item.price).toLocaleString("en-IN")}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Details */}
                                  <div className="space-y-6">
                                    {order.shipping_address && (
                                      <div>
                                        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-3 border-b border-foreground/[0.05] pb-2">
                                          Shipping Address
                                        </h4>
                                        <div className="text-[11px] text-foreground/80 space-y-0.5">
                                          <p className="font-medium text-foreground">{order.shipping_address.first_name} {order.shipping_address.last_name}</p>
                                          {order.shipping_address.company && <p>{order.shipping_address.company}</p>}
                                          <p>{order.shipping_address.address1}</p>
                                          {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                                          <p>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}</p>
                                          <p className="text-[9px] uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mt-1">{order.shipping_address.country}</p>
                                          {order.shipping_address.phone && <p className="mt-2 font-mono text-[9px]">{order.shipping_address.phone}</p>}
                                        </div>
                                      </div>
                                    )}
                                    {order.note && (
                                       <div>
                                        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-3 border-b border-foreground/[0.05] pb-2">
                                          Order Note
                                        </h4>
                                        <p className="text-[11px] text-foreground/80 bg-background border border-foreground/[0.05] p-3 rounded-md">{order.note}</p>
                                       </div>
                                    )}
                                  </div>
                               </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
                  : displayedMobileOrders.map((order: any) => {
                      const isAwaiting = String(order.status || "").toLowerCase() === "awaiting_approval";
                      const isCOD = String(order.paymentMethod || "").toUpperCase() === "COD";
                      const paymentLabel = order.paymentStatus === "paid" ? "paid" : "pending";
                      return (
                        <tr key={order.id} className="hover:bg-foreground/[0.02] transition-colors">
                          <td className="px-5 py-3" />
                          <td className="px-5 py-3">
                            <Link href={`/dashboard/orders/${order.id}`} className="text-[12px] font-semibold text-foreground hover:text-foreground/70 transition-colors">
                              #{order.orderNumber}
                            </Link>
                            {isAwaiting && (
                              <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-widest text-foreground/50">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                awaiting approval
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="text-[11px] font-medium text-foreground">{order.shippingAddress?.name || order.customer?.name || "N/A"}</div>
                            <div className="text-[9px] text-foreground/50 mt-0.5">{order.customer?.email || ""}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {isCOD ? (
                                <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  COD
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest bg-foreground/[0.05] text-foreground/70">
                                  PREPAID
                                </span>
                              )}
                              <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest ${paymentLabel === "paid" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}>
                                {paymentLabel}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest bg-foreground/[0.05] text-foreground/70">
                              {String(order.fulfillmentStatus || "unfulfilled")}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest bg-foreground/[0.05] text-foreground/70">
                              {String(order.deliveryStatus || "pending")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[12px] font-medium text-foreground text-right">
                            ₹{Number(order.totalPrice || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-3 text-[10px] text-foreground/50 uppercase tracking-widest text-center">
                            {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="px-2 py-1 bg-foreground text-background rounded-sm text-[9px] font-medium uppercase tracking-widest hover:opacity-90 transition-opacity inline-block"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
           <div className="absolute inset-0 z-0" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-background w-full max-w-sm rounded-xl p-6 border border-foreground/[0.05] shadow-lg relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[12px] font-semibold text-foreground tracking-widest uppercase">Edit Order</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateOrder} className="space-y-4">
               <div>
                <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Note</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none resize-none h-24"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2 bg-foreground text-background rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
           <div className="absolute inset-0 z-0 h-[150vh]" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="bg-background w-full max-w-lg rounded-xl p-6 border border-foreground/[0.05] shadow-lg relative z-10 my-8">
            <div className="flex justify-between items-center mb-6 border-b border-foreground/[0.05] pb-4">
              <h2 className="text-[12px] font-semibold text-foreground tracking-widest uppercase">Create Draft Order</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="space-y-5">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">First Name</label>
                   <input required value={createForm.firstName} onChange={(e) => setCreateForm(p => ({...p, firstName: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                 </div>
                 <div>
                   <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Last Name</label>
                   <input required value={createForm.lastName} onChange={(e) => setCreateForm(p => ({...p, lastName: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                 </div>
               </div>
               <div>
                 <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Email</label>
                 <input required type="email" value={createForm.email} onChange={(e) => setCreateForm(p => ({...p, email: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
               </div>

               <div className="pt-2">
                 <h3 className="text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest mb-3 border-b border-foreground/[0.05] pb-2">Line Item</h3>
                 <div className="space-y-3 relative">
                   {isProductsLoading && (
                     <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                       <Loader2 className="w-4 h-4 animate-spin text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50" />
                     </div>
                   )}
                   <div>
                     <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Product</label>
                     <select
                       required
                       value={selectedProductId}
                       onChange={(e) => {
                         setSelectedProductId(e.target.value);
                         setCreateForm((p) => ({ ...p, variantId: "" }));
                       }}
                       className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none appearance-none"
                     >
                       <option value="" disabled>Select Product...</option>
                       {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                     </select>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-3">
                       <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Variant</label>
                       <select
                         required
                         disabled={!selectedProductId}
                         value={createForm.variantId}
                         onChange={(e) => setCreateForm((p) => ({ ...p, variantId: e.target.value }))}
                         className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none appearance-none disabled:opacity-50"
                       >
                         <option value="" disabled>Select Variant...</option>
                         {products.find((p) => p.id.toString() === selectedProductId)?.variants.map((v) => (
                           <option key={v.id} value={v.id}>
                             {v.title !== "Default Title" ? v.title : "Default"} - ₹{v.price}
                           </option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Qty</label>
                       <input required type="number" min="1" value={createForm.quantity} onChange={(e) => setCreateForm(p => ({...p, quantity: parseInt(e.target.value) || 1}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                     </div>
                   </div>
                 </div>
               </div>

               <div className="pt-2">
                 <h3 className="text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest mb-3 border-b border-foreground/[0.05] pb-2">Shipping</h3>
                 <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Address</label>
                      <input required value={createForm.address1} onChange={(e) => setCreateForm(p => ({...p, address1: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                   </div>
                   <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">City</label>
                        <input required value={createForm.city} onChange={(e) => setCreateForm(p => ({...p, city: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Zip</label>
                        <input required value={createForm.zip} onChange={(e) => setCreateForm(p => ({...p, zip: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 mb-1.5">Country</label>
                        <input required value={createForm.country} onChange={(e) => setCreateForm(p => ({...p, country: e.target.value}))} className="w-full bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/20 rounded-md px-3 py-2 text-[11px] font-medium text-foreground outline-none" />
                      </div>
                   </div>
                 </div>
               </div>

               <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-foreground text-background rounded-md text-[10px] font-semibold uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity mt-4"
              >
                {actionLoading ? "Processing..." : "Create Order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
