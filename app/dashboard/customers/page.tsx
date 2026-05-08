"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Mail,
  Phone,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  ShoppingCart,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomerOrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string | null;
}

interface CustomerOrder {
  id: string;
  shopifyOrderId: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  items: CustomerOrderItem[];
}

interface AdminCustomer {
  id: string;
  shopifyId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastLoginAt: string | null;
  orders: CustomerOrder[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/customers?${params.toString()}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      if (data.error) setError(data.error);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const totalPages = Math.ceil(total / limit);

  const safeCurrency = (val: any) => {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return "₹0";
    return `₹${num.toLocaleString("en-IN")}`;
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/40">Loading Customers...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20 space-y-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 relative z-10">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Customers
          </h1>
          <p className="text-[11px] text-foreground/50 tracking-wide max-w-xl">
            {total > 0 ? `${total} registered customers` : "Manage customer identities and monitor purchase logic."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/admin/customers?format=csv"
            className="flex items-center gap-2 px-4 py-2 bg-background border border-foreground/[0.05] text-foreground rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-foreground/[0.02] transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </a>
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
          <input
            className="w-full bg-background border border-foreground/[0.05] rounded-md pl-9 pr-4 py-2 text-[11px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-foreground/20 transition-colors"
            placeholder="Search by name, email, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            className="px-3 py-2 bg-foreground/5 text-foreground/60 rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-foreground/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-[10px] font-medium uppercase tracking-widest text-red-600 dark:text-red-400 mb-6">
          Error: {error}
        </div>
      )}

      <div className="space-y-3 relative z-10">
        {customers.length === 0 ? (
          <div className="bg-background border border-foreground/[0.05] rounded-xl p-12 text-center shadow-sm">
            <Users className="w-8 h-8 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-[12px] font-medium text-foreground tracking-tight">
              {search ? "No customers match your search" : "No Customers Found"}
            </h3>
          </div>
        ) : (
          customers.map((customer) => {
            const fullName = customer.name || customer.email || "Guest";
            const isExpanded = expandedId === customer.id;

            return (
              <motion.div
                key={customer.id}
                initial={false}
                className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm transition-all"
              >
                <div
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 cursor-pointer hover:bg-foreground/[0.01] transition-colors ${
                    isExpanded ? "border-b border-foreground/[0.05] bg-foreground/[0.01]" : ""
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-foreground/[0.03] flex items-center justify-center text-[11px] font-semibold text-foreground">
                      {fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-foreground tracking-tight">
                        {fullName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-foreground/50">
                        {customer.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 px-2 md:px-0">
                    <div className="text-right">
                      <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Orders</p>
                      <p className="text-[12px] font-semibold text-foreground">{customer.totalOrders || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Lifetime</p>
                      <p className="text-[12px] font-semibold text-foreground">{safeCurrency(customer.totalSpent)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Joined</p>
                      <p className="text-[11px] font-medium text-foreground/60">{new Date(customer.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Last Login</p>
                      <p className="text-[11px] font-medium text-foreground/60">
                        {customer.lastLoginAt ? new Date(customer.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}
                      </p>
                    </div>
                    <div className="pl-2 text-foreground/40">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && customer.orders.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-5 bg-foreground/[0.01]"
                    >
                      <div className="space-y-3">
                        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-foreground/40 mb-2">Order History</h4>
                        {customer.orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between gap-4 bg-background border border-foreground/[0.05] rounded-md px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <ShoppingCart className="w-3.5 h-3.5 text-foreground/40" />
                              <p className="text-[11px] font-semibold text-foreground">
                                #{order.shopifyOrderId}
                              </p>
                              <span className={`px-2 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-widest ${
                                order.fulfillmentStatus === 'fulfilled'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                              }`}>
                                {order.fulfillmentStatus || 'unfulfilled'}
                              </span>
                            </div>

                            <div className="flex items-center gap-6">
                              <p className="text-[10px] font-medium text-foreground/50 hidden sm:block">
                                {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                              <div className="flex items-center gap-4 border-l border-foreground/[0.05] pl-6">
                                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-sm uppercase tracking-widest ${
                                  order.paymentStatus === 'paid'
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}>
                                  {order.paymentStatus}
                                </span>
                                <p className="text-[12px] font-semibold text-foreground">
                                  {safeCurrency(order.totalPrice)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {isExpanded && customer.orders.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-5 bg-foreground/[0.01]"
                    >
                      <p className="text-[10px] text-foreground/40 uppercase tracking-widest text-center py-4">No orders found</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-[10px] text-foreground/40 font-medium uppercase tracking-widest">
            Page {page} of {totalPages} · {total} customers
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-foreground/5 rounded-md text-[10px] font-medium text-foreground/60 uppercase tracking-[0.15em] hover:bg-foreground/10 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-foreground/5 rounded-md text-[10px] font-medium text-foreground/60 uppercase tracking-[0.15em] hover:bg-foreground/10 disabled:opacity-30 transition-all"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
