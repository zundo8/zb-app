"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Truck, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" && !loading) {
      router.push("/login?callbackUrl=/orders");
    }
  }, [status, loading, router]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.status === 401) {
        router.push("/login?callbackUrl=/orders");
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error("Error fetching orders", e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered": return <CheckCircle2 className="w-4 h-4 text-white/90" />;
      case "shipped": return <Truck className="w-4 h-4 text-white/70" />;
      case "cancelled": return <AlertCircle className="w-4 h-4 text-white/30" />;
      default: return <Clock className="w-4 h-4 text-white/50" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-32">
        {/* Page Title - Cart Style */}
        <div className="mb-8">
          <p className="text-[7px] font-extralight uppercase tracking-[0.55em] text-white/20 mb-0.5 ml-0.5">Your</p>
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-[13px] uppercase tracking-widest text-white/90 flex items-center gap-2">
              Orders
              {orders.length > 0 && (
                <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/10 text-white/75 font-inter font-medium border border-white/5">
                  {orders.length}
                </span>
              )}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-5 h-5 animate-spin text-white/20" />
            <p className="text-[7px] text-white/25 font-black uppercase tracking-[0.3em]">Syncing History</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center animate-in fade-in duration-700">
            <div className="w-16 h-16 bg-white/[0.02] rounded-[2rem] flex items-center justify-center border border-white/5">
               <Package className="w-6 h-6 text-white/20" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[11px] font-heading uppercase tracking-widest text-white/60">No Orders Yet</h2>
              <p className="text-[9px] text-white/30 font-medium">Your purchase history will appear here.</p>
            </div>
            <Link href="/" className="px-8 py-3 bg-white text-black rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all shadow-lg">
                Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-4xl mx-auto">
            {orders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative rounded-2xl p-4 transition-all duration-500 overflow-hidden glass-panel border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 shadow-xl"
              >
                {/* Header Info */}
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/40 flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5 opacity-30" />
                      #{order.shopifyOrderId || order.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-[9px] text-white/30 font-bold">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[7px] font-black uppercase tracking-widest text-white/70`}>
                    {getStatusIcon(order.deliveryStatus)}
                    <span className="opacity-70">{order.deliveryStatus}</span>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3.5">
                    {order.items.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="h-10 w-10 rounded-xl ring-2 ring-black bg-white/[0.02] flex items-center justify-center overflow-hidden border border-white/10 shadow-sm relative group-hover:scale-105 transition-transform">
                        {item.image ? (
                          <img src={item.image} alt="" className="object-cover w-full h-full opacity-80" />
                        ) : (
                          <span className="text-[10px] font-black opacity-10">{item.title[0]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate tracking-tight text-white/90 leading-snug">
                        {order.items[0].title}
                    </p>
                    <p className="text-[8px] text-white/30 font-medium mt-0.5 uppercase tracking-widest">
                      {order.items.length > 1 ? `+ ${order.items.length - 1} more items` : `1 quantity`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-inter font-bold tracking-tight text-white/80">₹{order.totalPrice.toLocaleString('en-IN')}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[7px] font-black uppercase tracking-widest text-white/40">Details</span>
                      <ChevronRight className="w-2.5 h-2.5 text-white/40" />
                    </div>
                  </div>
                </div>

                {/* Tracking / Quick Actions */}
                {order.deliveryStatus.toLowerCase() !== "pending" && order.shipments?.[0]?.trackingNumber ? (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                        <Truck className="w-3 h-3 text-white/40" />
                      </div>
                      <div className="text-[8px]">
                        <p className="uppercase tracking-widest text-white/20 font-black">ID</p>
                        <p className="font-mono text-white/60 font-medium uppercase truncate max-w-[80px]">{order.shipments[0].trackingNumber}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => window.open(`https://www.shiprocket.in/shipment-tracking/?awb=${order.shipments[0].trackingNumber}`, '_blank')}
                      className="relative z-10 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[7px] font-black uppercase tracking-widest text-white/70 transition-colors"
                    >
                        Track Ship
                    </button>
                  </div>
                ) : (
                    <div className="mt-4 opacity-10 flex justify-end">
                         <Link href={`/orders/${order.id}`} className="text-[7px] font-black uppercase tracking-widest text-white">View Order Details</Link>
                    </div>
                )}
                
                <Link href={`/orders/${order.id}`} className="absolute inset-0 z-[1]" />
              </motion.div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
