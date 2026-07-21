"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Truck, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  RotateCcw,
  ArrowLeftRight,
  Sparkles,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" && !loading) {
      router.push("/login?callbackUrl=/orders");
    }
  }, [status, loading, router]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/orders");
      if (res.status === 401) {
        router.push("/login?callbackUrl=/orders");
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Error fetching orders", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getEligibilityInfo = (order: any) => {
    const ds = (order?.deliveryStatus || '').toLowerCase();
    const s = (order?.status || '').toLowerCase();
    const isDelivered = ds === 'delivered' || s === 'delivered';

    const activeReturn = order.returnRequests?.find((r: any) => r.status !== 'cancelled');
    const activeExchange = order.exchangeRequests?.find((e: any) => e.status !== 'cancelled');
    const hasActiveRequest = !!(activeReturn || activeExchange);

    if (!isDelivered) {
      return { isDelivered: false, isEligible: false, remainingDays: 0, hasActiveRequest, activeReturn, activeExchange };
    }

    const timelineArr = Array.isArray(order?.statusTimeline) ? order.statusTimeline : [];
    const deliveredEntry = timelineArr.find((t: any) => t.step === 'delivered');
    const deliveredAt = deliveredEntry?.completedAt || order?.updatedAt || order?.createdAt;
    const diffDays = Math.ceil(Math.abs(Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24));

    const isWithin15Days = diffDays <= 15;
    const isEligible = isWithin15Days && !hasActiveRequest;
    const remainingDays = Math.max(0, 15 - diffDays);

    return { 
      isDelivered: true, 
      isEligible, 
      remainingDays, 
      hasActiveRequest, 
      activeReturn, 
      activeExchange 
    };
  };

  const eligibleOrders = useMemo(() => {
    return orders.filter(o => getEligibilityInfo(o).isEligible);
  }, [orders]);

  const activeRequestOrders = useMemo(() => {
    return orders.filter(o => getEligibilityInfo(o).hasActiveRequest);
  }, [orders]);

  const displayedOrders = useMemo(() => {
    if (activeTab === 'eligible') return eligibleOrders;
    if (activeTab === 'returns' || activeTab === 'exchanges') return activeRequestOrders;
    return orders;
  }, [activeTab, orders, eligibleOrders, activeRequestOrders]);

  const getStatusConfig = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', label: 'Cancelled' };
    if (s === 'delivered') return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Delivered' };
    if (s === 'shipped' || s === 'out_for_delivery') return { icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Shipped' };
    if (s.includes('return') || s.includes('exchange')) return { icon: RotateCcw, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Return/Exchange' };
    if (s === 'processing' || s === 'confirmed') return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Processing' };
    return { icon: Clock, color: 'text-foreground/50', bg: 'bg-foreground/5 border-foreground/10', label: status || 'Pending' };
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-32">
        {/* Page Title & Refresh */}
        <div className="mb-6">
          <p className="text-[7px] font-extralight uppercase tracking-[0.55em] text-foreground/20 mb-0.5 ml-0.5">Your Account</p>
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-[15px] uppercase tracking-widest text-foreground/90 flex items-center gap-2">
              Orders & Returns
            </h1>
            <button 
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-button text-[8px] font-bold uppercase tracking-wider disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Status
            </button>
          </div>
        </div>

        {/* 15-Day Policy Banner */}
        <div className="mb-8 p-4 rounded-2xl glass-panel border border-foreground/5 bg-foreground/[0.01] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/70 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">15-Day Return & Exchange Policy</p>
              <p className="text-[9px] text-foreground/50 mt-0.5">Delivered orders are eligible for return or exchange within 15 days of delivery date.</p>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-foreground text-background shadow-lg'
                : 'glass-button text-foreground/60 hover:text-foreground'
            }`}
          >
            All Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('eligible')}
            className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'eligible'
                ? 'bg-foreground text-background shadow-lg'
                : 'glass-button text-foreground/60 hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Eligible for Return ({eligibleOrders.length})
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'returns' || activeTab === 'exchanges'
                ? 'bg-foreground text-background shadow-lg'
                : 'glass-button text-foreground/60 hover:text-foreground'
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            Active Requests ({activeRequestOrders.length})
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-5 h-5 animate-spin text-foreground/20" />
            <p className="text-[7px] text-foreground/25 font-black uppercase tracking-[0.3em]">Loading Orders</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center animate-in fade-in duration-700">
            <div className="w-16 h-16 bg-foreground/[0.02] rounded-[2rem] flex items-center justify-center border border-foreground/5">
              <Package className="w-6 h-6 text-foreground/20" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[11px] font-heading uppercase tracking-widest text-foreground/60">
                {activeTab === 'eligible' ? 'No Orders Eligible for Return' : activeTab === 'returns' ? 'No Active Return Requests' : 'No Orders Found'}
              </h2>
              <p className="text-[9px] text-foreground/30 font-medium">
                {activeTab === 'eligible' ? 'Only orders delivered within the last 15 days can be returned or exchanged.' : 'Your order history will appear here.'}
              </p>
            </div>
            <Link href="/collections" className="glass-cta px-8 py-3 text-[9px]">
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {displayedOrders.map((order, idx) => {
              const statusConfig = getStatusConfig(order.deliveryStatus || order.status || 'pending');
              const StatusIcon = statusConfig.icon;
              const orderItems = order.items || [];
              const eligibility = getEligibilityInfo(order);

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative rounded-3xl p-5 transition-all duration-500 overflow-hidden glass-panel hover:translate-y-[-1px] shadow-xl border border-foreground/5"
                >
                  {/* Header Info */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-foreground/40 flex items-center gap-1.5">
                        <Clock className="w-2.5 h-2.5 opacity-30" />
                        {order.orderNumber 
                          ? (order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`)
                          : (order.shopifyOrderId && !order.shopifyOrderId.startsWith('app_pending_') 
                              ? (order.shopifyOrderId.startsWith('#') ? order.shopifyOrderId : `#${order.shopifyOrderId}`)
                              : `#ZB${order.id.slice(-6).toUpperCase()}`)}
                      </p>
                      <p className="text-[9px] text-foreground/30 font-bold">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[7px] font-black uppercase tracking-widest ${statusConfig.bg}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color}`} />
                        <span className={statusConfig.color}>{statusConfig.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex -space-x-3.5 shrink-0">
                      {orderItems.slice(0, 3).map((item: any, i: number) => {
                        const imageSrc = item.image || item.product?.featuredImage || (item.product?.images?.[0] as any)?.src || (item.product?.images?.[0] as any) || "";
                        return (
                          <div key={i} className="h-12 w-12 rounded-xl ring-2 ring-background bg-foreground/[0.02] flex items-center justify-center overflow-hidden border border-foreground/10 shadow-sm relative group-hover:scale-105 transition-transform">
                            {imageSrc ? (
                              <img src={imageSrc} alt="" className="object-cover w-full h-full opacity-90" />
                            ) : (
                              <span className="text-[10px] font-black text-foreground/20">{(item.title || 'ZB')[0]}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold truncate tracking-tight text-foreground/90 leading-snug">
                        {orderItems[0]?.title || 'Order Items'}
                      </p>
                      <p className="text-[8px] text-foreground/40 font-medium mt-0.5 uppercase tracking-widest">
                        {orderItems.length > 1 ? `+ ${orderItems.length - 1} more items` : `1 item`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-inter font-bold tracking-tight text-foreground">₹{order.totalPrice.toLocaleString('en-IN')}</p>
                      <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold uppercase tracking-wider text-foreground/40 hover:text-foreground transition-colors">
                        Details <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Active Return/Exchange Badge */}
                  {eligibility.hasActiveRequest && (
                    <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
                          {eligibility.activeReturn ? 'Return Request Active' : 'Exchange Request Active'} ({eligibility.activeReturn?.status || eligibility.activeExchange?.status})
                        </span>
                      </div>
                      <Link href={`/orders/${order.id}`} className="px-3 py-1 rounded-xl bg-amber-500 text-black text-[8px] font-bold uppercase tracking-wider">
                        View Status
                      </Link>
                    </div>
                  )}

                  {/* Eligible 15-Day Return & Exchange Actions */}
                  {eligibility.isEligible && (
                    <div className="mt-4 pt-3 border-t border-foreground/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Eligible for Return / Exchange ({eligibility.remainingDays} days left in 15-day window)</span>
                      </div>

                      <div className="flex gap-2 relative z-10">
                        <Link
                          href={`/orders/${order.id}/return`}
                          className="px-4 py-2 rounded-xl glass-button text-[8px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Return
                        </Link>
                        <Link
                          href={`/orders/${order.id}/exchange`}
                          className="px-4 py-2 rounded-xl glass-cta text-[8px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Exchange
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Tracking link if shipped */}
                  {!eligibility.isEligible && !eligibility.hasActiveRequest && order.shipments?.[0]?.trackingNumber && (
                    <div className="mt-3 pt-3 border-t border-foreground/5 flex items-center justify-between text-[8px]">
                      <span className="text-foreground/40 font-mono">AWB: {order.shipments[0].trackingNumber}</span>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`https://www.shiprocket.in/shipment-tracking/?awb=${order.shipments[0].trackingNumber}`, '_blank'); }}
                        className="relative z-10 px-3 py-1.5 rounded-lg glass-button font-bold uppercase tracking-widest"
                      >
                        Track Shipment
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
