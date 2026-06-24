"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History, User, Phone, Mail, Search, Calendar, ShoppingBag, 
  Eye, ShoppingCart, Heart, ArrowRight, ChevronRight, AlertCircle, 
  CheckCircle2, MapPin, Sparkles, RefreshCcw, Send, MessageSquare, 
  MousePointer, CreditCard, ShieldCheck, X
} from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

interface WhatsAppEvent {
  id: string;
  eventName: string;
  customerId: string | null;
  customerPhone: string | null;
  orderId: string | null;
  productId: string | null;
  eventSource: string;
  metadataJson: string | null;
  status: string;
  createdAt: string;
}

function CustomerJourneysContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<WhatsAppEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auto load customer from search params if present
  useEffect(() => {
    const customerIdParam = searchParams.get("customerId");
    const phoneParam = searchParams.get("phone");

    if (customerIdParam || phoneParam) {
      loadJourney(customerIdParam, phoneParam);
    }
  }, [searchParams, refreshTrigger]);

  // Handle customer search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/customers?limit=6&search=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (res.ok && data.customers) {
          setSearchResults(data.customers);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Error searching customers:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadJourney = async (customerId?: string | null, phone?: string | null) => {
    setLoadingEvents(true);
    try {
      const params = new URLSearchParams();
      if (customerId) params.set("customerId", customerId);
      if (phone) params.set("phone", phone);

      const res = await fetch(`/api/whatsapp-events/journey?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setEvents(data.events || []);
        if (data.customer) {
          setSelectedCustomer(data.customer);
          setSearchQuery(data.customer.name || data.customer.phone || "");
        } else if (phone) {
          setSelectedCustomer({
            id: "",
            name: "Unregistered Visitor",
            phone: phone,
            email: null,
            createdAt: new Date().toISOString()
          });
        }
      } else {
        toast.error(data.error || "Failed to load customer journey.");
      }
    } catch (err) {
      toast.error("Network error loading journey timeline.");
      console.error(err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name || customer.phone || "");
    setShowDropdown(false);
    
    // Update url search params
    const newParams = new URLSearchParams();
    newParams.set("customerId", customer.id);
    router.push(`/dashboard/whatsapp-events/customer-journeys?${newParams.toString()}`);
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    setEvents([]);
    setSearchQuery("");
    setSearchResults([]);
    router.push(`/dashboard/whatsapp-events/customer-journeys`);
  };

  const getEventConfig = (name: string) => {
    switch (name) {
      case "Product Viewed":
        return { icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
      case "Add To Cart":
        return { icon: ShoppingCart, color: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20" };
      case "Remove From Cart":
        return { icon: X, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
      case "Add To Wishlist":
        return { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" };
      case "Lead Created":
      case "User Registered":
        return { icon: User, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
      case "User Login":
        return { icon: ShieldCheck, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" };
      case "Checkout Started":
      case "Payment Initiated":
        return { icon: CreditCard, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" };
      case "Purchase Completed":
      case "COD Order Placed":
        return { icon: ShoppingBag, color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20" };
      default:
        return { icon: MessageSquare, color: "text-foreground/70", bg: "bg-foreground/5", border: "border-foreground/10" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Journey Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze customer touchpoints, Click-to-WhatsApp campaign attributions, and storefront flows.
          </p>
        </div>

        {selectedCustomer && (
          <button 
            onClick={() => setRefreshTrigger(p => p + 1)}
            disabled={loadingEvents}
            className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10 rounded-xl transition-all text-sm font-semibold"
          >
            <RefreshCcw className={`w-4 h-4 ${loadingEvents ? "animate-spin text-emerald-500" : ""}`} />
            <span>Refresh Journey</span>
          </button>
        )}
      </div>

      {/* Customer Search Panel */}
      <div className="glass-card p-6 relative z-30">
        <div className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/60 uppercase block">Search Customer</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name, phone (+91...), email, or Shopify ID..."
                className="glass-input pl-10 w-full"
              />
              {searchQuery && (
                <button
                  onClick={handleClear}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showDropdown && (searchQuery.trim().length > 0 || searching) && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-6 right-6 mt-1 bg-background/95 border border-foreground/15 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl max-h-72 overflow-y-auto custom-scrollbar"
              >
                {searching ? (
                  <div className="p-4 flex justify-center items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCcw className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Searching database...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No customers found matching &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="divide-y divide-foreground/5">
                    {searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-5 py-3 text-left hover:bg-foreground/5 flex items-center justify-between transition-colors"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-sm text-foreground/90 block">
                            {customer.name || "Unnamed Customer"}
                          </span>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {customer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </span>
                            )}
                            {customer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected Customer Card Details */}
        {selectedCustomer && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-foreground/5 mt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <User className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Name</span>
                <p className="text-sm font-bold text-foreground/90">{selectedCustomer.name || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Phone className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Phone</span>
                <p className="text-sm font-bold text-foreground/90">{selectedCustomer.phone || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-violet-500/10 text-violet-500 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Member Since</span>
                <p className="text-sm font-bold text-foreground/90">
                  {new Date(selectedCustomer.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-500" />
          <span>Interactive Timeline</span>
        </h2>

        {loadingEvents ? (
          <div className="glass-card p-12 flex flex-col justify-center items-center gap-3 text-muted-foreground">
            <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-sm font-medium">Fetching event timeline...</span>
          </div>
        ) : !selectedCustomer ? (
          <div className="glass-card p-12 text-center text-muted-foreground space-y-3">
            <Search className="w-8 h-8 mx-auto text-foreground/20" />
            <p className="text-sm font-medium">Please search and select a customer to view their journey timeline.</p>
          </div>
        ) : events.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-500/60 animate-pulse" />
            <p className="text-sm font-medium">No event records found for this customer.</p>
            <p className="text-xs">Interaction history is logged once the user takes action on the storefront or receives template campaigns.</p>
          </div>
        ) : (
          <div className="relative pl-6 md:pl-10 space-y-8 before:absolute before:left-[19px] md:before:left-[29px] before:top-2 before:bottom-2 before:w-[2px] before:bg-foreground/10">
            {events.map((event, idx) => {
              const config = getEventConfig(event.eventName);
              const EventIcon = config.icon;
              const metadata = event.metadataJson ? JSON.parse(event.metadataJson) : null;
              const hasClid = metadata && (metadata.ctwa_clid || metadata.click_id || metadata.fbclid);
              const clidValue = metadata?.ctwa_clid || metadata?.click_id || metadata?.fbclid;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group"
                >
                  {/* Timeline Node Ring */}
                  <div className={`absolute -left-[35px] md:-left-[45px] top-1.5 p-2 rounded-full border ${config.bg} ${config.color} ${config.border} shadow-lg transition-transform duration-300 group-hover:scale-110 z-10`}>
                    <EventIcon className="w-4 h-4" />
                  </div>

                  {/* Timeline Card */}
                  <div className="glass-card p-5 space-y-3 hover:border-foreground/15 transition-all">
                    {/* Top title and timestamp */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-foreground/5 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-foreground/90">{event.eventName}</h3>
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full capitalize ${
                          event.eventSource === "web" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          event.eventSource === "whatsapp" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}>
                          {event.eventSource}
                        </span>
                        
                        {event.status === "forwarded" && (
                          <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Meta Synced
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(event.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    {/* Metadata JSON visual rendering */}
                    {metadata && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {metadata.title && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Product Title</span>
                              <span className="font-semibold text-foreground/80">{metadata.title}</span>
                            </div>
                          )}
                          {metadata.price && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Unit Price</span>
                              <span className="font-semibold text-foreground/80">₹{metadata.price}</span>
                            </div>
                          )}
                          {metadata.value && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Total Value</span>
                              <span className="font-semibold text-emerald-400 font-bold">₹{metadata.value}</span>
                            </div>
                          )}
                          {metadata.paymentMethod && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Payment</span>
                              <span className="font-semibold text-foreground/80">{metadata.paymentMethod}</span>
                            </div>
                          )}
                          {metadata.quantity && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Quantity</span>
                              <span className="font-semibold text-foreground/80">{metadata.quantity}</span>
                            </div>
                          )}
                          {event.orderId && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Order ID</span>
                              <span className="font-mono text-foreground/80 font-bold">{event.orderId}</span>
                            </div>
                          )}
                          {event.productId && (
                            <div className="bg-foreground/[0.02] p-2 rounded-lg border border-foreground/5">
                              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Product ID</span>
                              <span className="font-mono text-foreground/80">{event.productId}</span>
                            </div>
                          )}
                        </div>

                        {/* Special Click-to-WhatsApp Attribution Card */}
                        {hasClid && (
                          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-3.5 space-y-2 flex items-start gap-3">
                            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                                Meta Click-to-WhatsApp Ad Attribution
                              </span>
                              <p className="text-xs text-foreground/80">
                                Customer originated from WhatsApp ad click. System captured Meta Ad Click ID (CLID) for attribution mapping.
                              </p>
                              <div className="flex items-center gap-1.5 font-mono text-[10px] bg-black/35 text-emerald-300 py-1 px-2.5 rounded border border-emerald-500/20 w-fit mt-1">
                                <span className="text-muted-foreground uppercase">Ad Click ID:</span>
                                <span>{String(clidValue)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerJourneysPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    }>
      <CustomerJourneysContent />
    </Suspense>
  );
}
