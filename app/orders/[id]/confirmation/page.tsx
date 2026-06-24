"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Package, Truck, Calendar, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMetaEvents } from "@/hooks/useMetaEvents";
import { trackStorefrontEvent } from "@/lib/track-client";

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedPixel, setPurchasedPixel] = useState(false);
  const { trackPurchase } = useMetaEvents();

  useEffect(() => {
    if (order) {
      const storageKey = `meta_purchase_fired_${order.id}`;
      const hasFired = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
      if (!hasFired) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
        }

        const val = parseFloat(order.totalPrice || "0");
        const contentIds = order.items?.map((item: any) => item.variantId || item.productId) || [];

        let userData: any = undefined;
        try {
          const addr = order.shippingAddress
            ? (typeof order.shippingAddress === 'string'
              ? JSON.parse(order.shippingAddress)
              : order.shippingAddress)
            : null;

          const cust = order.customer || {};
          const nameToUse = cust.name || addr?.name || "";
          const nameParts = nameToUse.trim().split(/\s+/);
          const fn = nameParts[0] || undefined;
          const ln = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

          userData = {
            country: addr?.country || undefined,
            st: addr?.state || undefined,
            ct: addr?.city || undefined,
            zp: addr?.zip || undefined,
            fn,
            ln,
            em: cust.email || undefined,
            ph: cust.phone || addr?.phone || undefined,
          };
        } catch (e) {
          console.error("Error parsing shippingAddress in confirmation page", e);
        }

        let storedCategory = undefined;
        if (typeof window !== 'undefined') {
          storedCategory = sessionStorage.getItem(`order_categories_${order.id}`) || undefined;
        }

        const contents = order.items?.map((item: any) => ({
          id: item.variantId || item.productId,
          quantity: item.quantity || 1,
          item_price: parseFloat(item.price || "0")
        })) || [];

        trackPurchase(order.id, val, 'INR', contentIds, userData, storedCategory, contents);
      }

      if (!purchasedPixel) {
        setPurchasedPixel(true);

        const val = parseFloat(order.totalPrice || "0");

        // Track server-side event
        const isCod = order.paymentMethod === "COD";
        const eventName = isCod ? "COD Order Placed" : "Purchase Completed";

        trackStorefrontEvent(eventName, {
          customerId: order.customerId || null,
          customerPhone: order.customerPhone || order.customer?.phone || null,
          orderId: order.id,
          metadata: {
            value: val,
            currency: "INR",
            content_ids: order.items?.map((item: any) => item.productId || item.variantId) || [],
            num_items: order.items?.length || 0,
            paymentMethod: order.paymentMethod
          }
        });
      }
    }
  }, [order, purchasedPixel]);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const lastPlacedId = typeof window !== "undefined" ? sessionStorage.getItem("last_placed_order_id") : null;
        const url = lastPlacedId === id 
          ? `/api/orders/${id}?bypass_auth=true` 
          : `/api/orders/${id}`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
          // API returns { order: ... } wrapper — extract the order object
          setOrder(data.order || data);
        }
      } catch (e) {
        console.error("Error fetching order", e);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40 dark:text-foreground/20" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Order not found</h1>
        <Link href="/" className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors underline">Return Home</Link>
      </div>
    );
  }

  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 5);

  return (
    <div className="min-h-screen bg-background text-foreground px-6 pt-28 pb-12 font-sans">
      <div className="max-w-md mx-auto space-y-10">
        {/* Hero Success */}
        <div className="text-center space-y-5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "backOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-green-500/10 text-green-500 mb-1 border border-green-500/20 shadow-lg shadow-green-500/5"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black tracking-tight">Confirmed</h1>
             <p className="text-muted-foreground text-[10px] font-bold tracking-[0.1em] uppercase opacity-50">
              Order {order.orderNumber 
                ? (order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`)
                : (order.shopifyOrderId && !order.shopifyOrderId.startsWith('app_pending_') 
                    ? (order.shopifyOrderId.startsWith('#') ? order.shopifyOrderId : `#${order.shopifyOrderId}`)
                    : `#ZB${order.id.slice(-6).toUpperCase()}`)}
            </p>
          </div>
          <p className="text-muted-foreground text-[13px] font-medium leading-relaxed max-w-[240px] mx-auto">
            Your pieces are being prepared. Confirmation sent to email.
          </p>
        </div>

        {/* ETA Section */}
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-muted/10 rounded-[2rem] border border-border/5 flex items-center gap-5 shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-background border border-border/10 flex items-center justify-center shadow-md">
            <Calendar className="w-5 h-5 text-muted-foreground/30" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/40 font-black mb-0.5">Estimated Arrival</p>
            <p className="font-bold text-[14px] tracking-tight">{arrivalDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</p>
          </div>
        </motion.div>

        {/* Order Details */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-border/5 pb-3">
            <h2 className="text-[11px] font-black uppercase tracking-[0.1em]">Details</h2>
            <Link href="/orders" className="text-[9px] text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest underline underline-offset-4">History</Link>
          </div>
          
          <div className="space-y-3">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[12px] font-medium">
                <span className="text-muted-foreground truncate max-w-[200px]">{item.quantity}x {item.title}</span>
                <span className="font-bold opacity-30">₹{item.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-border/5 flex justify-between items-center">
              <span className="font-black text-[11px] uppercase tracking-widest">Total</span>
              <span className="text-xl font-black tracking-tight">₹{order.totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 space-y-3">
          <Link 
            href="/"
            className="block w-full py-4 bg-foreground text-background text-center rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.15em] shadow-xl hover:opacity-90 active:scale-[0.98] transition-all border border-foreground"
          >
            Continue
          </Link>
          <button 
            onClick={() => router.push("/orders")}
            className="w-full py-4 border border-border/10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
          >
            Track Order
          </button>
        </div>
      </div>
    </div>
  );
}
