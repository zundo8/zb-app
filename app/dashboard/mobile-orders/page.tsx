"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  CreditCard,
  Truck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string | null;
}

interface MobileOrder {
  id: string;
  shopifyOrderId: string | null;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  paymentMethod: string | null;
  shippingAddress: any;
  items: OrderItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

function StatusBadge({ status, type }: { status: string | null; type: "payment" | "fulfillment" | "delivery" }) {
  const label = (status || (type === "fulfillment" ? "unfulfilled" : "pending")).toLowerCase();
  const colors: Record<string, string> = {
    paid: "bg-green-500/10 text-green-600 dark:text-green-400",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    refunded: "bg-red-500/10 text-red-600 dark:text-red-400",
    fulfilled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    delivered: "bg-green-500/10 text-green-600 dark:text-green-400",
    pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    unfulfilled: "bg-foreground/[0.05] text-foreground/70",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest ${colors[label] || "bg-foreground/[0.05] text-foreground/70"}`}>
      {label}
    </span>
  );
}

export default function MobileOrdersPage() {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch from our specialized app orders API (GET)
      // We pass a secret header or just rely on session for admin
      const res = await fetch("/api/app/orders?all=true&limit=50", {
        headers: {
          'Authorization': 'Bearer ADMIN_SESSION_BYPASS' // Backend needs to support this
        }
      });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSyncToShopify = async (orderId: string) => {
    setSyncingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/sync-shopify`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Successfully synced to Shopify");
        fetchOrders();
      } else {
        showToast("Sync failed: " + data.error);
      }
    } catch (err) {
      showToast("Sync error");
    } finally {
      setSyncingId(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = search.toLowerCase();
    const customerName = o.shippingAddress?.name || '';
    const customerEmail = o.shippingAddress?.email || '';
    const customerPhone = o.shippingAddress?.phone || '';
    return (
      o.orderNumber?.toLowerCase().includes(term) ||
      o.id?.toLowerCase().includes(term) ||
      customerName.toLowerCase().includes(term) ||
      customerEmail.toLowerCase().includes(term) ||
      customerPhone.toLowerCase().includes(term)
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
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

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-foreground/70" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Mobile App Orders</h1>
          </div>
          <p className="text-[11px] text-foreground/50 tracking-wide">
            Real-time synchronization for orders placed via React Native application.
          </p>
        </div>
        
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh Orders
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
          <input
            className="w-full bg-background border border-foreground/[0.05] rounded-md pl-9 pr-4 py-2 text-[11px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-foreground/20 transition-colors uppercase tracking-widest"
            placeholder="Search by Name, Email or Order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-foreground/[0.01] border-b border-foreground/[0.05]">
              <tr>
                <th className="px-5 py-3 w-8"></th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Order ID</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Customer</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Method</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Payment</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest">Fulfillment</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest text-right">Total</th>
                <th className="px-5 py-3 text-[9px] font-semibold text-foreground/50 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.05]">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-foreground/40">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-[10px] font-medium uppercase tracking-widest">Syncing with database...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-foreground/40">
                    <p className="text-[10px] font-medium uppercase tracking-widest">No mobile orders found</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = expanded === order.id;
                  const isSyncing = syncingId === order.id;
                  const isSynced = !!order.shopifyOrderId;

                  return (
                    <React.Fragment key={order.id}>
                      <tr 
                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-foreground/[0.01]' : 'hover:bg-foreground/[0.02]'}`}
                        onClick={() => setExpanded(isExpanded ? null : order.id)}
                      >
                        <td className="px-5 py-4 text-foreground/40">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-foreground">
                              #{order.orderNumber || order.id.slice(-6).toUpperCase()}
                            </span>
                            {!isSynced && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[8px] font-bold uppercase tracking-tighter">Unsynced</span>
                            )}
                          </div>
                          <div className="text-[9px] text-foreground/40 mt-1 uppercase tracking-wider font-mono">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-[11px] font-medium text-foreground">{order.shippingAddress?.name || order.customer?.name || 'N/A'}</div>
                          <div className="text-[9px] text-foreground/40 mt-0.5">{order.shippingAddress?.email || order.customer?.email || ''}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3 text-foreground/30" />
                            <span className="text-[10px] font-medium text-foreground/70 uppercase">{order.paymentMethod || 'Razorpay'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={order.paymentStatus} type="payment" />
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={order.fulfillmentStatus} type="fulfillment" />
                        </td>
                        <td className="px-5 py-4 text-[12px] font-medium text-foreground text-right">
                          ₹{order.totalPrice.toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {!isSynced ? (
                              <button
                                onClick={() => handleSyncToShopify(order.id)}
                                disabled={isSyncing}
                                className="px-3 py-1 bg-foreground text-background rounded-sm text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                              >
                                {isSyncing ? "Syncing..." : "Sync to Shopify"}
                              </button>
                            ) : (
                              <a
                                href={`https://8tiahf-bk.myshopify.com/admin/orders/${order.shopifyOrderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-foreground/[0.03] rounded-md text-foreground/40 hover:text-foreground transition-colors inline-block"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-foreground/[0.005] border-b border-foreground/[0.05]"
                          >
                            <td colSpan={8} className="p-0">
                              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                                <div className="md:col-span-2">
                                  <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-6 border-b border-foreground/[0.05] pb-2">Line Items ({order.items.length})</h4>
                                  <div className="space-y-6">
                                    {order.items.map((item: any) => (
                                      <div key={item.id} className="flex gap-4 items-center">
                                        <div className="w-16 h-16 bg-foreground/[0.03] rounded-lg border border-foreground/[0.05] overflow-hidden flex-shrink-0">
                                          {item.image && (
                                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-bold text-foreground uppercase tracking-tight truncate">{item.title}</p>
                                          <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[9px] text-foreground/40 font-mono">SKU: {item.sku || 'N/A'}</span>
                                            <span className="w-1 h-1 rounded-full bg-foreground/10" />
                                            <span className="text-[9px] text-foreground/40 uppercase font-medium">QTY: {item.quantity}</span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[12px] font-bold text-foreground">₹{(item.price * item.quantity).toLocaleString()}</p>
                                          <p className="text-[9px] text-foreground/40 mt-1">₹{item.price.toLocaleString()} ea</p>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    <div className="pt-6 mt-6 border-t border-foreground/[0.05] space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/40">Subtotal</span>
                                        <span className="text-[11px] font-bold text-foreground">₹{order.totalPrice.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/40">Shipping</span>
                                        <span className="text-[10px] font-bold text-green-500 uppercase">Free</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-2 border-t border-foreground/[0.02]">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Grand Total</span>
                                        <span className="text-[14px] font-black text-foreground">₹{order.totalPrice.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-10">
                                  <div>
                                    <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-6 border-b border-foreground/[0.05] pb-2">Shipping Information</h4>
                                    <div className="bg-foreground/[0.02] p-5 rounded-xl border border-foreground/[0.05] space-y-4">
                                      <div>
                                        <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest mb-1">Customer</p>
                                        <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{order.shippingAddress?.name || order.customer?.name || 'N/A'}</p>
                                        <p className="text-[10px] font-mono text-foreground/60 mt-0.5">{order.shippingAddress?.phone || order.customer?.phone || 'No phone'}</p>
                                        <p className="text-[10px] text-foreground/60">{order.shippingAddress?.email || order.customer?.email || 'No email'}</p>
                                      </div>
                                      
                                      <div className="pt-4 border-t border-foreground/[0.05]">
                                        <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest mb-2">Address</p>
                                        <div className="text-[11px] text-foreground/70 space-y-1 leading-relaxed">
                                          <p className="font-semibold text-foreground">{order.shippingAddress?.address1 || order.shippingAddress?.street}</p>
                                          {order.shippingAddress?.address2 && <p>{order.shippingAddress?.address2}</p>}
                                          <p className="uppercase tracking-tight">
                                            {order.shippingAddress?.city}, {order.shippingAddress?.province || order.shippingAddress?.state}
                                          </p>
                                          <p className="font-mono font-bold text-foreground/80">{order.shippingAddress?.zip || order.shippingAddress?.pincode}</p>
                                          <p className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] mt-2">{order.shippingAddress?.country || 'INDIA'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-6 border-b border-foreground/[0.05] pb-2">Logistics & Tracking</h4>
                                    <div className="bg-foreground/[0.02] p-5 rounded-xl border border-foreground/[0.05]">
                                      {order.tracking ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center">
                                              <Truck className="w-4 h-4 text-foreground/40" />
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-bold text-foreground uppercase">{order.tracking.carrier || 'Standard Shipping'}</p>
                                              <p className="text-[9px] font-mono text-foreground/40 mt-0.5">{order.tracking.awb}</p>
                                            </div>
                                          </div>
                                          <button className="w-full py-2 bg-foreground/[0.05] hover:bg-foreground/[0.08] text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors">
                                            View in Shiprocket
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center py-2 text-center">
                                          <div className="w-10 h-10 rounded-full bg-foreground/[0.03] flex items-center justify-center mb-3">
                                            <Truck className="w-5 h-5 text-foreground/20" />
                                          </div>
                                          <p className="text-[10px] font-medium text-foreground/40 uppercase tracking-widest">Awaiting fulfillment</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
