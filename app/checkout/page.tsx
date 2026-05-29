"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import * as fp from "@/lib/meta-pixel";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  CreditCard, 
  Truck, 
  ShieldCheck, 
  Plus, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  X
} from "lucide-react";
import Link from "next/link";


type Address = {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type PaymentMethod = "UPI" | "CARD" | "COD";

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items, subtotal, clear } = useCart();
  const router = useRouter();

  const [step, setStep] = useState(1); // 1: Address, 2: Payment
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initiatedPixel, setInitiatedPixel] = useState(false);

  useEffect(() => {
    if (items.length > 0 && !initiatedPixel) {
      setInitiatedPixel(true);
      fp.event("InitiateCheckout", {
        num_items: items.length,
        value: subtotal,
        currency: "INR",
        content_ids: items.map(item => item.productId)
      });
    }
  }, [items, subtotal, initiatedPixel]);
  
  const [address, setAddress] = useState<Address>({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    phone: (session as any)?.customer?.phone || "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const codFee = 99;
  const shipping = 0;

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponValid, setCouponValid] = useState(false);
  
  const total = subtotal - couponDiscount + (paymentMethod === "COD" ? codFee : 0) + shipping;

  useEffect(() => {
    if (status === "unauthenticated") {
       router.push(`/login?callbackUrl=/checkout`);
    } else if (items.length === 0 && step !== 4) {
      router.push("/cart");
    }
  }, [items, step, router, status, session]);

  // Auto-fetch previous order address if available
  useEffect(() => {
    if (session) {
      const customer = (session as any).customer;
      if (customer?.defaultAddress) {
        try {
          const savedAddr = JSON.parse(customer.defaultAddress);
          setAddress(prev => ({ ...prev, ...savedAddr }));
        } catch (e) {
          console.error("Error parsing saved address", e);
        }
      }
    }
  }, [session]);

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMessage("");
    
    try {
      const res = await fetch("/api/storefront/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      const data = await res.json();
      
      setCouponMessage(data.message);
      if (data.valid) {
        setCouponDiscount(data.discount);
        setCouponValid(true);
      } else {
        setCouponDiscount(0);
        setCouponValid(false);
      }
    } catch {
      setCouponMessage("Unable to validate coupon.");
      setCouponValid(false);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMessage("");
    setCouponValid(false);
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError("");

    try {
      if (paymentMethod === "COD") {
        const res = await fetch("/api/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            paymentMethod,
            items,
            total,
            subtotal,
            codFee,
            couponCode: couponValid ? couponCode : null,
            couponDiscount: couponDiscount,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          clear();
          router.push(`/orders/${data.orderId}/confirmation`);
        } else {
          setError(data.error || "Failed to place order");
        }
      } else {
        const res = await fetch("/api/checkout/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: total }),
        });

        const orderData = await res.json();
        
        if (!res.ok) throw new Error(orderData.error || "Failed to initiate payment");

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: "INR",
          name: "Zica Bella",
          description: "Order Checkout",
          order_id: orderData.id,
          handler: async function (response: any) {
            const verifyRes = await fetch("/api/checkout/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address,
                paymentMethod,
                items,
                total,
                subtotal,
                razorpay: response,
                couponCode: couponValid ? couponCode : null,
                couponDiscount: couponDiscount,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              clear();
              router.push(`/orders/${verifyData.orderId}/confirmation`);
            } else {
              setError(verifyData.error || "Payment verification failed");
            }
          },
          prefill: {
            name: address.name,
            email: address.email,
            contact: address.phone,
          },
          theme: {
            color: "#000000",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-28 pb-32">
        {/* Page Title */}
        <div className="mb-8">
          <p className="glass-label mb-0.5 ml-0.5">Your</p>
          <div className="flex items-center justify-between">
            <h1 className="glass-heading text-[13px] flex items-center gap-2">
              Checkout
              <span className="glass-badge">
                Step {step}/2
              </span>
            </h1>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-10">
          {[1, 2].map((s) => (
            <div 
              key={s}
              className={`h-1 rounded-full transition-all duration-500 ${
                s <= step ? "w-8 bg-white" : "w-2 bg-white/10"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="address"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Delivery</h2>
                <p className="text-foreground/40 text-[11px] font-medium">Where should we send your pieces?</p>
              </div>

              <form onSubmit={handleAddressSubmit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={address.name}
                    onChange={(e) => setAddress({...address, name: e.target.value})}
                    className="glass-input w-full px-4 py-3 text-[13px]"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                        type="email"
                        placeholder="Email"
                        required
                        value={address.email}
                        onChange={(e) => setAddress({...address, email: e.target.value})}
                        className="glass-input w-full px-4 py-3 text-[13px]"
                    />
                    <input
                        type="tel"
                        placeholder="Phone"
                        required
                        value={address.phone}
                        onChange={(e) => setAddress({...address, phone: e.target.value})}
                        className="glass-input w-full px-4 py-3 text-[13px]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Street Address, Area, Landmark"
                    required
                    value={address.street}
                    onChange={(e) => setAddress({...address, street: e.target.value})}
                    className="glass-input w-full px-4 py-3 text-[13px]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City"
                      required
                      value={address.city}
                      onChange={(e) => setAddress({...address, city: e.target.value})}
                      className="glass-input w-full px-4 py-3 text-[13px]"
                    />
                    <input
                      type="text"
                      placeholder="ZIP Code"
                      required
                      value={address.zip}
                      onChange={(e) => setAddress({...address, zip: e.target.value})}
                      className="glass-input w-full px-4 py-3 text-[13px]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="State"
                    required
                    value={address.state}
                    onChange={(e) => setAddress({...address, state: e.target.value})}
                    className="glass-input w-full px-4 py-3 text-[13px]"
                  />
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="glass-cta w-full py-4 text-[10px] flex items-center justify-center gap-2"
                  >
                    Select Payment
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Payment</h2>
                <p className="text-foreground/40 text-[11px] font-medium">Choose how you'd like to pay.</p>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: "UPI", label: "UPI (Google Pay, PhonePe)", description: "Instant, safe, and secure" },
                  { id: "CARD", label: "Credit / Debit Card", description: "Visa, Mastercard, RuPay" },
                  { id: "COD", label: "Cash on Delivery", description: "Pay when you receive. ₹99 fee applies." },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={`w-full p-4 text-left rounded-2xl transition-all flex items-center justify-between ${
                      paymentMethod === method.id 
                        ? "bg-foreground text-background shadow-[0_0_30px_rgba(var(--foreground),0.1)] scale-[1.01]" 
                        : "glass-panel text-foreground hover:bg-foreground/[0.06]"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-[13px]">{method.label}</p>
                      <p className={`text-[10px] font-medium ${paymentMethod === method.id ? "opacity-50" : "text-foreground/35"}`}>
                        {method.description}
                      </p>
                    </div>
                    {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>

              {/* ═══ Coupon Code ═══ */}
              <div className="glass-panel p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-foreground/40" />
                  <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">Coupon Code</span>
                </div>
                
                {couponValid ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.06] border border-foreground/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-foreground/70" />
                      <span className="text-[11px] font-bold text-foreground/80">{couponCode.toUpperCase()}</span>
                      <span className="text-[9px] text-foreground/40">— {couponMessage}</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-foreground/30 hover:text-foreground/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="glass-input flex-1 px-3 py-2.5 text-[12px] uppercase tracking-wider"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="glass-button px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider disabled:opacity-30"
                    >
                      {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}
                
                {couponMessage && !couponValid && (
                  <p className="text-[10px] text-foreground/40 font-medium">{couponMessage}</p>
                )}
              </div>

              {/* ═══ Order Summary ═══ */}
              <div className="glass-panel p-6 space-y-3">
                <div className="flex justify-between items-center text-[13px] font-medium">
                  <span className="text-foreground/50">Subtotal</span>
                  <span className="text-foreground/80">₹{subtotal.toLocaleString()}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between items-center text-[13px] font-medium">
                    <span className="text-foreground/50">Coupon Discount</span>
                    <span className="text-foreground/70">- ₹{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                {paymentMethod === "COD" && (
                  <div className="flex justify-between items-center text-[13px] font-medium">
                    <span className="text-foreground/50">COD Fee</span>
                    <span className="text-foreground/60">+ ₹{codFee}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[13px] font-medium">
                  <span className="text-foreground/50">Shipping</span>
                  <span className="text-foreground/70">Free</span>
                </div>
                <div className="glass-divider" />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-[13px] text-foreground/80">Total</span>
                  <span className="text-lg font-black tracking-tight text-foreground">₹{total.toLocaleString()}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl text-[10px] font-bold" style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.15)", color: "rgba(255,120,120,0.9)" }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}

              <div className="pt-6">
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="glass-cta w-full py-4 text-[10px] flex items-center justify-center gap-2.5 disabled:opacity-30"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {paymentMethod === "COD" ? "Place COD Order" : "Complete Order"}
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <p className="text-center text-[8px] text-foreground/20 mt-4 uppercase tracking-[0.2em] font-bold">
                  Secure Checkout
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
