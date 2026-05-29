"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const CheckoutWebView = dynamic(() => import("@/components/CheckoutWebView"), { ssr: false });
const OrderSuccess = dynamic(() => import("@/components/OrderSuccess"), { ssr: false });

export default function CartPage() {
  const router = useRouter();
  const { items, count, subtotal, remove, update, clear } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = () => {
    router.push("/checkout");
  };

  const handleOrderSuccess = () => {
    setCheckoutUrl(null);
    setShowSuccess(true);
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    clear();
  };

  return (
    <div className="min-h-screen relative">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-32">

        {/* Page Title */}
        <div className="mb-8">
          <p className="glass-label mb-0.5">Your</p>
          <h1 className="glass-heading text-[13px] flex items-center gap-2">
            Cart
            {count > 0 && (
              <span className="glass-badge">
                {count}
              </span>
            )}
          </h1>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center pt-20 pb-8">
            <div className="glass-panel inline-flex p-6 rounded-full mb-4">
              <ShoppingBag className="w-10 h-10 text-foreground/20" />
            </div>
            <p className="glass-heading text-[10px] mb-2 text-foreground/30">
              Your Cart is Empty
            </p>
          </div>
        )}

        {/* Cart Items & Summary in Split Columns on Widescreen */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-3">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -30, scale: 0.95 }}
                    transition={{ duration: 0.28 }}
                    className="glass-panel flex items-center gap-3.5 p-4"
                  >
                    {/* Product Image */}
                    <Link href={`/products/${item.handle}`} className="flex-shrink-0">
                      <div className="relative w-16 h-20 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                        <Image src={item.image} alt={item.title} fill className="object-cover" />
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-extralight uppercase tracking-[0.2em] text-foreground/70 line-clamp-2 mb-0.5 leading-snug">
                        {item.title}
                      </p>
                      {item.size && (
                        <p className="text-[7.5px] font-extralight uppercase tracking-widest text-foreground/30 mb-1.5">
                          Size: {item.size}
                        </p>
                      )}
                      <p className="text-[9.5px] font-inter font-semibold tracking-wider text-foreground/70">
                        ₹{(parseFloat(item.price) * item.quantity).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Quantity + Remove */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className="glass-button flex items-center gap-1.5 !rounded-full px-2 py-1">
                        <button
                          onClick={() => update(item.id, item.quantity - 1)}
                          className="w-5 h-5 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[9.5px] font-inter font-semibold tracking-wider text-foreground/80 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => update(item.id, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="text-foreground/20 hover:text-foreground/50 transition-colors active:scale-90 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Right Column: Order Summary sticky panel */}
            <div className="lg:col-span-4 sticky top-28">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Order Summary */}
                <div className="glass-panel p-5">
                  <h3 className="text-[9.5px] font-bold uppercase tracking-[0.3em] text-foreground/80 mb-4 border-b border-foreground/5 pb-2">Order Summary</h3>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8px] font-extralight uppercase tracking-widest text-foreground/40">Subtotal</span>
                    <span className="text-[9.5px] font-inter font-semibold tracking-wider text-foreground/70">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8px] font-extralight uppercase tracking-widest text-foreground/40">Shipping</span>
                    <span className="text-[8px] font-extralight text-foreground/30">Calculated at checkout</span>
                  </div>
                  <div className="glass-divider my-3" />
                  <div className="flex justify-between items-center">
                    <span className="glass-heading text-[10px]">Total</span>
                    <span className="font-inter font-bold text-[13px] text-foreground/85">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Error */}
                {checkoutError && (
                  <div className="px-4 py-2.5 rounded-xl" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.1)" }}>
                    <p className="text-[8.5px] text-center leading-relaxed" style={{ color: "rgba(255,120,120,0.8)" }}>{checkoutError}</p>
                  </div>
                )}

                {/* Checkout button */}
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="glass-cta w-full py-4 text-[9.5px] tracking-[0.35em] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Preparing Checkout…
                    </>
                  ) : (
                    "Proceed to Checkout"
                  )}
                </button>
                <button
                  onClick={clear}
                  className="w-full py-3 rounded-2xl text-[8.5px] font-extralight uppercase tracking-widest text-foreground/30 hover:text-foreground/60 transition-colors"
                >
                  Clear Cart
                </button>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* In-App Checkout WebView */}
      {checkoutUrl && (
        <CheckoutWebView
          checkoutUrl={checkoutUrl}
          onSuccess={handleOrderSuccess}
          onClose={() => setCheckoutUrl(null)}
        />
      )}

      {/* Order Success Screen */}
      <AnimatePresence>
        {showSuccess && <OrderSuccess onContinue={handleSuccessContinue} />}
      </AnimatePresence>
    </div>
  );
}
