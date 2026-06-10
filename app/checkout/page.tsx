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
  X,
  ShoppingBag,
  ChevronRight,
  ChevronLeft
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

type DBAddress = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
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
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  
  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<DBAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");

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

  const [addressError, setAddressError] = useState("");
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
    const fetchZipDetails = async () => {
      const cleanZip = address.zip.trim();
      if (/^\d{6}$/.test(cleanZip)) {
        setZipLoading(true);
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${cleanZip}`);
          const data = await res.json();
          if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice[0]) {
            const firstOffice = data[0].PostOffice[0];
            setAddress(prev => ({
              ...prev,
              city: firstOffice.District || firstOffice.Block || firstOffice.Name || prev.city,
              state: firstOffice.State || prev.state,
            }));
          }
        } catch (err) {
          console.error("Error fetching pincode details:", err);
        } finally {
          setZipLoading(false);
        }
      }
    };
    fetchZipDetails();
  }, [address.zip]);

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
    } else if (items.length === 0 && !isOrderPlaced) {
      router.push("/cart");
    }
  }, [items, isOrderPlaced, router, status]);

  // Fetch saved addresses
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/customer/addresses")
        .then(res => res.json())
        .then(data => {
          if (data.addresses) {
            setSavedAddresses(data.addresses);
            const def = data.addresses.find((a: DBAddress) => a.isDefault);
            if (def) {
              setSelectedSavedId(def.id);
              setAddress({
                name: def.name || "",
                email: def.email || "",
                phone: def.phone || "",
                street: def.address2 ? `${def.address1}, ${def.address2}` : def.address1,
                city: def.city || "",
                state: def.state || "",
                zip: def.zip || "",
                country: def.country || "India",
              });
            }
          }
        })
        .catch(err => console.error("Error loading addresses:", err));
    }
  }, [status]);

  const handleSelectSavedAddress = (addr: DBAddress) => {
    setSelectedSavedId(addr.id);
    setAddress({
      name: addr.name || "",
      email: addr.email || "",
      phone: addr.phone || "",
      street: addr.address2 ? `${addr.address1}, ${addr.address2}` : addr.address1,
      city: addr.city || "",
      state: addr.state || "",
      zip: addr.zip || "",
      country: addr.country || "India",
    });
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError("");

    // Clean phone number
    const digits = address.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) {
      baseNumber = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      baseNumber = digits.slice(1);
    }

    if (baseNumber.length !== 10) {
      setAddressError("Please enter a valid 10-digit mobile number.");
      return;
    }

    const formattedPhone = `+91${baseNumber}`;
    setAddress(prev => ({ ...prev, phone: formattedPhone }));
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
      // Ensure Razorpay SDK is loaded (from layout.tsx beforeInteractive script)
      if (!(window as any).Razorpay) {
        setError("Payment gateway is loading. Please try again in a moment.");
        setLoading(false);
        return;
      }

      // If COD, amount to pay upfront is codFee (99), otherwise it is total
      const paymentAmount = paymentMethod === "COD" ? codFee : total;

      const res = await fetch("/api/checkout/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: paymentAmount }),
      });

      const orderData = await res.json();
      
      if (!res.ok) throw new Error(orderData.error || "Failed to initiate payment");

      const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

      const options: any = {
        key: orderData.keyId || orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Zica Bella",
        description: paymentMethod === "COD" ? "COD Upfront Fee" : "Order Checkout",
        order_id: orderData.id || orderData.razorpay_order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/checkout/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address,
                paymentMethod,
                items,
                total,
                subtotal,
                codFee: paymentMethod === "COD" ? codFee : 0,
                razorpay: response,
                couponCode: couponValid ? couponCode : null,
                couponDiscount: couponDiscount,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setIsOrderPlaced(true);
              clear();
              if (typeof window !== "undefined") {
                sessionStorage.setItem("last_placed_order_id", verifyData.orderId);
              }
              router.push(`/orders/${verifyData.orderId}/confirmation`);
            } else {
              setError(verifyData.error || "Payment verification failed");
            }
          } catch (verifyErr: any) {
            setError(verifyErr.message || "Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: address.name,
          email: address.email,
          contact: address.phone,
          method: (paymentMethod === "UPI" || paymentMethod === "COD") ? "upi" : "card",
        },
        theme: {
          color: "#000000",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
          confirm_close: true,
        },
      };

      // Configure display blocks for UPI or Card. For COD, use the same UPI configuration block.
      if (paymentMethod === "UPI" || paymentMethod === "COD") {
        options.config = {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [
                  {
                    method: "upi",
                    flows: isMobile ? ["intent", "collect"] : ["qr", "collect"],
                    apps: isMobile ? ["google_pay", "phonepe", "paytm"] : undefined,
                    block: "upi"
                  }
                ]
              }
            },
            sequence: ["block.upi"],
            preferences: {
              show_default_blocks: false
            }
          }
        };
      } else if (paymentMethod === "CARD") {
        options.config = {
          display: {
            blocks: {
              card: {
                name: "Pay via Card",
                instruments: [
                  {
                    method: "card"
                  }
                ]
              }
            },
            sequence: ["block.card"],
            preferences: {
              show_default_blocks: false
            }
          }
        };
      }

      const rzp = new (window as any).Razorpay(options);
      
      // Handle payment failure
      rzp.on('payment.failed', function (response: any) {
        const errorDesc = response?.error?.description || "Payment failed. Please try again.";
        const errorCode = response?.error?.code || "";
        console.error('[Razorpay] Payment failed:', response?.error);
        setError(`${errorDesc}${errorCode ? ` (${errorCode})` : ''}`);
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-background text-foreground font-sans">
      {/* Razorpay SDK loaded via layout.tsx beforeInteractive — no duplicate script needed */}
      
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-20 md:pt-28 pb-32" style={{ paddingBottom: 'max(8rem, env(safe-area-inset-bottom, 8rem))' }}>
        {/* Page Title */}
        <div className="mb-6">
          <p className="text-[7px] font-semibold uppercase tracking-[0.4em] text-foreground/40 mb-1">Your Purchase</p>
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-black tracking-tight flex items-center gap-2">
              Checkout
              <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-foreground/[0.05] border border-foreground/10 text-foreground/60 uppercase">
                Step {step}/2
              </span>
            </h1>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-8">
          {[1, 2].map((s) => (
            <div 
              key={s}
              className={`h-1 rounded-full transition-all duration-500 ${
                s === step ? "w-12 bg-foreground" : s < step ? "w-6 bg-foreground/50" : "w-3 bg-foreground/10"
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
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Shipping Details</h2>
                <p className="text-foreground/40 text-[10px] font-medium uppercase tracking-wider">Where should we deliver your pieces?</p>
              </div>

              {/* Saved Addresses list */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-foreground/45">Use Saved Address</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`snap-start shrink-0 w-[200px] md:w-[240px] text-left p-3.5 rounded-[1.25rem] glass-panel border transition-all ${
                          selectedSavedId === addr.id
                            ? "border-foreground/30 bg-foreground/[0.03] shadow-[0_0_15px_rgba(var(--foreground),0.02)]"
                            : "border-foreground/5 bg-foreground/[0.01] hover:border-foreground/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold truncate pr-1">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-full text-[5px] font-bold uppercase tracking-wider bg-foreground text-background">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-foreground/50 truncate">
                          {addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}
                        </p>
                        <p className="text-[9px] text-foreground/50 font-medium">
                          {addr.city}, {addr.state}
                        </p>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedId("");
                        setAddress({
                          name: "",
                          email: "",
                          phone: "",
                          street: "",
                          city: "",
                          state: "",
                          zip: "",
                          country: "India",
                        });
                      }}
                      className="snap-start shrink-0 p-4 rounded-[1.25rem] glass-panel border border-foreground/5 hover:border-foreground/10 bg-foreground/[0.01] flex flex-col items-center justify-center gap-1 w-[120px] text-center"
                    >
                      <Plus className="w-3.5 h-3.5 text-foreground/40" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/50">New Form</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddressSubmit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    placeholder="Recipient Full Name"
                    required
                    value={address.name}
                    onChange={(e) => {
                      setSelectedSavedId("");
                      setAddress({...address, name: e.target.value});
                    }}
                    className="glass-input w-full px-4 py-3 text-[12px]"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                        type="email"
                        placeholder="Email Address"
                        required
                        value={address.email}
                        onChange={(e) => {
                          setSelectedSavedId("");
                          setAddress({...address, email: e.target.value});
                        }}
                        className="glass-input w-full px-4 py-3 text-[12px]"
                    />
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-foreground/35 font-semibold pointer-events-none">+91</span>
                      <input
                          type="tel"
                          placeholder="10-digit Mobile Number"
                          required
                          value={address.phone}
                          onChange={(e) => {
                            setSelectedSavedId("");
                            setAddress({...address, phone: e.target.value});
                          }}
                          className="glass-input w-full pl-10 pr-4 py-3 text-[12px]"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Street Address, Area, Landmark"
                    required
                    value={address.street}
                    onChange={(e) => {
                      setSelectedSavedId("");
                      setAddress({...address, street: e.target.value});
                    }}
                    className="glass-input w-full px-4 py-3 text-[12px]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City"
                      required
                      value={address.city}
                      onChange={(e) => {
                        setSelectedSavedId("");
                        setAddress({...address, city: e.target.value});
                      }}
                      className="glass-input w-full px-4 py-3 text-[12px]"
                    />
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="PIN Code (6 digits)"
                        required
                        maxLength={6}
                        value={address.zip}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setSelectedSavedId("");
                          setAddress({...address, zip: val});
                        }}
                        className="glass-input w-full px-4 py-3 text-[12px]"
                      />
                      {zipLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-foreground/30" />
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="State"
                    required
                    value={address.state}
                    onChange={(e) => {
                      setSelectedSavedId("");
                      setAddress({...address, state: e.target.value});
                    }}
                    className="glass-input w-full px-4 py-3 text-[12px]"
                  />
                </div>

                {addressError && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl text-[10px] font-bold mt-2" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.12)", color: "rgba(255,100,100,0.9)" }}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    {addressError}
                  </div>
                )}

                <div className="pt-6">
                  <button
                    type="submit"
                    className="glass-cta w-full py-4 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Select Payment Method
                    <ChevronRight className="w-3.5 h-3.5" />
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setStep(1)}
                  className="p-1.5 rounded-lg glass-panel hover:bg-foreground/5 text-foreground/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Select Payment</h2>
                  <p className="text-foreground/40 text-[10px] font-medium uppercase tracking-wider">Choose your preferred settlement method</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: "UPI", label: "UPI Payments (Intent & GPay/PhonePe)", description: "Seamless intent launch on mobile devices" },
                  { id: "CARD", label: "Credit & Debit Cards", description: "Visa, Mastercard, RuPay & international options" },
                  { id: "COD", label: "Cash on Delivery (COD)", description: "Additional ₹99 processing fee applies" },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={`w-full p-4 text-left rounded-[1.5rem] transition-all flex items-center justify-between border ${
                      paymentMethod === method.id 
                        ? "bg-foreground text-background border-transparent shadow-[0_0_25px_rgba(var(--foreground),0.05)] scale-[1.01]" 
                        : "glass-panel text-foreground border-foreground/5 hover:bg-foreground/[0.04]"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-[12px] uppercase tracking-wide">{method.label}</p>
                      <p className={`text-[9px] font-medium ${paymentMethod === method.id ? "opacity-60" : "text-foreground/35"}`}>
                        {method.description}
                      </p>
                    </div>
                    {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 text-background shrink-0 ml-2" />}
                  </button>
                ))}
              </div>

              {/* ═══ Coupon Code ═══ */}
              <div className="glass-panel p-4 space-y-3 border border-foreground/5">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-foreground/45" />
                  <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-widest">Discount Code</span>
                </div>
                
                {couponValid ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.04] border border-foreground/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-foreground/60" />
                      <span className="text-[10px] font-bold text-foreground/80">{couponCode.toUpperCase()}</span>
                      <span className="text-[8px] text-foreground/40">— {couponMessage}</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-foreground/30 hover:text-foreground/60 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Discount Code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="glass-input flex-1 px-3 py-2 text-[11px] uppercase tracking-wider"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="glass-button px-4 py-2 text-[9px] font-bold uppercase tracking-widest disabled:opacity-30"
                    >
                      {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}
                
                {couponMessage && !couponValid && (
                  <p className="text-[9px] text-foreground/40 font-semibold">{couponMessage}</p>
                )}
              </div>

              {/* ═══ Cart Items Preview ═══ */}
              <div className="glass-panel p-4 border border-foreground/5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-3.5 h-3.5 text-foreground/40" />
                  <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-widest">Order Preview</span>
                </div>
                <div className="max-h-[160px] overflow-y-auto divide-y divide-foreground/5 space-y-2 pr-1 scrollbar-thin">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="w-12 h-14 rounded-[0.5rem] bg-foreground/[0.02] border border-foreground/5 overflow-hidden shrink-0">
                        {item.image ? (
                          <img src={item.image} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-foreground/20 text-[8px]">ZB</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-foreground/80 truncate leading-tight">{item.title}</p>
                        <p className="text-[8px] text-foreground/40 font-bold uppercase tracking-wider mt-0.5">
                          Size: {item.size || "Free"} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-foreground/80">₹{(parseFloat(item.price) * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ═══ Order Summary ═══ */}
              <div className="glass-panel p-5 space-y-3 border border-foreground/5">
                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-foreground/45">Subtotal</span>
                  <span className="text-foreground/80">₹{subtotal.toLocaleString()}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-foreground/45">Coupon Discount</span>
                    <span className="text-foreground/60">- ₹{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                {paymentMethod === "COD" && (
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-foreground/45">COD Fee (Upfront)</span>
                    <span className="text-foreground/60">+ ₹{codFee}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-foreground/45">Shipping</span>
                  <span className="text-foreground/60">Free</span>
                </div>
                <div className="h-[1px] bg-foreground/10 my-2" />
                
                {paymentMethod === "COD" ? (
                  <>
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-foreground/45">Total Order Value</span>
                      <span className="text-foreground/80">₹{total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-foreground/45">Due at Delivery</span>
                      <span className="text-foreground/80">₹{(total - codFee).toLocaleString()}</span>
                    </div>
                    <div className="h-[1px] bg-foreground/10 my-2" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-extrabold text-[11px] text-foreground/60 uppercase tracking-widest">Pay Upfront</span>
                      <span className="text-xl font-black tracking-tight text-foreground">₹{codFee.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-extrabold text-[11px] text-foreground/60 uppercase tracking-widest">Total Payable</span>
                    <span className="text-xl font-black tracking-tight text-foreground">₹{total.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl text-[10px] font-bold" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.12)", color: "rgba(255,100,100,0.9)" }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}

              <div className="pt-6">
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="glass-cta w-full py-4 text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2.5 disabled:opacity-30"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {paymentMethod === "COD" ? `Pay ₹${codFee} Upfront & Place COD` : "Complete Payment"}
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <p className="text-center text-[7px] text-foreground/20 mt-4 uppercase tracking-[0.25em] font-bold">
                  256-Bit SSL Secured Transaction
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
