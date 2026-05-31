"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  CheckCircle,
  Truck,
  Clock,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Sparkles,
  Calendar,
  X,
  ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentStatus: string;
  createdAt: string;
}

export default function WebStoreOrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("query", search);
      if (paymentStatus !== "all") params.append("payment_status", paymentStatus);
      if (fulfillmentStatus !== "all") params.append("fulfillment_status", fulfillmentStatus);
      if (paymentMethod !== "all") params.append("payment_method", paymentMethod);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await fetch(`/api/web-store/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timeout);
  }, [search, paymentStatus, fulfillmentStatus, paymentMethod, startDate, endDate]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(orders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBulkUpdate = async (statusField: "paymentStatus" | "fulfillmentStatus", value: string) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/web-store/orders/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: selectedIds,
          [statusField]: value,
        }),
      });

      if (!res.ok) throw new Error("Failed to perform bulk update");
      const result = await res.json();
      toast.success(`Successfully updated ${result.updatedCount} orders`);
      setSelectedIds([]);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error performing bulk action");
    } finally {
      setBulkActionLoading(false);
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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3 h-3" /> Delivered</span>;
      case "shipped":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20"><Truck className="w-3 h-3" /> Shipped</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Processing</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3 h-3" /> Unfulfilled</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span>;
      case "failed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Failed</span>;
      case "refunded":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Refunded</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
    }
  };

  const clearFilters = () => {
    setSearch("");
    setPaymentStatus("all");
    setFulfillmentStatus("all");
    setPaymentMethod("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-inter flex items-center gap-2">
          Web Store Orders <Sparkles className="w-5 h-5 text-amber-500" />
        </h1>
        <p className="text-[12px] text-foreground/50 mt-1">
          Review, ship, and update customer orders made on the zicabella.com storefront.
        </p>
      </div>

      {/* Filters bar */}
      <div className="glass rounded-[2rem] border border-foreground/5 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35" />
            <input
              type="text"
              placeholder="Search order #, customer, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all font-medium"
            />
          </div>

          {/* Payment status filter */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all font-medium appearance-none"
            >
              <option value="all" className="bg-[#0e0e0e]">All Payment Statuses</option>
              <option value="pending" className="bg-[#0e0e0e]">Pending</option>
              <option value="paid" className="bg-[#0e0e0e]">Paid</option>
              <option value="failed" className="bg-[#0e0e0e]">Failed</option>
              <option value="refunded" className="bg-[#0e0e0e]">Refunded</option>
            </select>
          </div>

          {/* Fulfillment filter */}
          <div>
            <select
              value={fulfillmentStatus}
              onChange={(e) => setFulfillmentStatus(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all font-medium appearance-none"
            >
              <option value="all" className="bg-[#0e0e0e]">All Fulfillment Statuses</option>
              <option value="unfulfilled" className="bg-[#0e0e0e]">Unfulfilled</option>
              <option value="processing" className="bg-[#0e0e0e]">Processing</option>
              <option value="shipped" className="bg-[#0e0e0e]">Shipped</option>
              <option value="delivered" className="bg-[#0e0e0e]">Delivered</option>
              <option value="returned" className="bg-[#0e0e0e]">Returned</option>
            </select>
          </div>

          {/* Payment Method filter */}
          <div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all font-medium appearance-none"
            >
              <option value="all" className="bg-[#0e0e0e]">All Payment Methods</option>
              <option value="razorpay" className="bg-[#0e0e0e]">Razorpay</option>
              <option value="cod" className="bg-[#0e0e0e]">Cash On Delivery (COD)</option>
            </select>
          </div>
        </div>

        {/* Extended filters (dates + clear) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-foreground/[0.03]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date Range
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-foreground/[0.03] border border-foreground/5 rounded-xl px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
            />
            <span className="text-xs text-foreground/30 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-foreground/[0.03] border border-foreground/5 rounded-xl px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
            />
          </div>

          {(search || paymentStatus !== "all" || fulfillmentStatus !== "all" || paymentMethod !== "all" || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="glass rounded-[2rem] border border-foreground/5 overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4 animate-pulse">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="h-10 bg-foreground/5 rounded-xl w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <ShoppingBag className="w-16 h-16 text-foreground/15 mb-4" />
            <h3 className="text-sm font-bold text-foreground mb-1">No Orders Found</h3>
            <p className="text-xs text-foreground/45 max-w-xs">No web orders matched your filter conditions. Try loosening filters or search queries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-foreground/5 text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                  <th className="py-4 px-6 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-foreground/15 bg-transparent text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                    />
                  </th>
                  <th className="py-4 px-3">Order Number</th>
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-4">Customer</th>
                  <th className="py-4 px-4">Payment</th>
                  <th className="py-4 px-4">Fulfillment</th>
                  <th className="py-4 px-4">Method</th>
                  <th className="py-4 px-4 text-right">Total</th>
                  <th className="py-4 px-6 w-12 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {orders.map((order) => {
                  const isChecked = selectedIds.includes(order.id);
                  return (
                    <tr
                      key={order.id}
                      className={`group hover:bg-foreground/[0.01] transition-colors ${isChecked ? "bg-amber-500/[0.02]" : ""}`}
                    >
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(order.id, e.target.checked)}
                          className="rounded border-foreground/15 bg-transparent text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-3 font-mono text-[12px] font-bold text-foreground group-hover:text-amber-500 transition-colors">
                        <Link href={`/web-store/orders/${order.id}`}>
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-[11px] text-foreground/60">{formatDate(order.createdAt)}</td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] font-semibold text-foreground truncate">{order.customerName}</span>
                          <span className="text-[9px] text-foreground/40 mt-0.5 truncate">{order.customerEmail}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getPaymentBadge(order.paymentStatus)}</td>
                      <td className="py-4 px-4">{getFulfillmentBadge(order.fulfillmentStatus)}</td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-foreground/60 bg-foreground/5 px-2 py-0.5 rounded border border-foreground/5">
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-[12px] font-bold text-foreground">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          href={`/web-store/orders/${order.id}`}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-foreground/5 text-foreground/50 hover:bg-foreground/10 hover:text-foreground transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4"
          >
            <div className="glass rounded-[2rem] border border-amber-500/20 shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-bold">
                  {selectedIds.length}
                </div>
                <span className="text-[11px] font-semibold text-foreground/80 font-inter">Orders Selected</span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] text-foreground/40 hover:text-foreground underline transition-colors"
                >
                  Deselect all
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk Payment status */}
                <select
                  disabled={bulkActionLoading}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate("paymentStatus", e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-foreground/5 border border-foreground/5 rounded-xl px-3 py-1.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Mark Payment...</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>

                {/* Bulk Fulfillment status */}
                <select
                  disabled={bulkActionLoading}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate("fulfillmentStatus", e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-foreground/5 border border-foreground/5 rounded-xl px-3 py-1.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Mark Fulfillment...</option>
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
