"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronLeft,
  Home,
  Navigation,
  Building2,
  Smartphone,
  Banknote,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Address = {
  name: string;
  email: string;
  phone: string;
  houseNo: string;
  street: string;
  landmark: string;
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

type PaymentMethod = "UPI" | "CARD" | "COD" | "PAYLATER" | "EMI";

/* ─── Validation helpers ────────────────────────────────────── */
const BLOCKED_CHARS = /[`~!@#$%^&*()_+={}[\]|\\:;"'<>?/]/g;
const sanitizeAddress = (val: string) => val.replace(BLOCKED_CHARS, "");
const isValidAddressField = (val: string, minLen = 2) => val.trim().length >= minLen;

/* ─── Indian states for dropdown ─────────────────────────────── */
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir",
  "Ladakh","Lakshadweep","Puducherry"
];

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
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("");

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
    houseNo: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
  });

  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
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
  const [applyAsStoreCredit, setApplyAsStoreCredit] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState(0);
  
  const total = subtotal - (applyAsStoreCredit ? 0 : couponDiscount) + (paymentMethod === "COD" ? codFee : 0) + shipping;

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
          if (data.addresses && data.addresses.length > 0) {
            setSavedAddresses(data.addresses);
            const def = data.addresses.find((a: DBAddress) => a.isDefault) || data.addresses[0];
            setSelectedSavedId(def.id);
            // Parse saved address into new fields
            const parts = def.address1?.split(",").map((s: string) => s.trim()) || [];
            setAddress({
              name: def.name || "",
              email: def.email || "",
              phone: def.phone || "",
              houseNo: parts[0] || def.address1 || "",
              street: parts.slice(1).join(", ") || def.address2 || "",
              landmark: def.address2 && !parts[1] ? def.address2 : "",
              city: def.city || "",
              state: def.state || "",
              zip: def.zip || "",
              country: def.country || "India",
            });
            setShowAddressForm(false);
          } else {
            setShowAddressForm(true);
          }
        })
        .catch(err => {
          console.error("Error loading addresses:", err);
          setShowAddressForm(true);
        });
    }
  }, [status]);

  const handleSelectSavedAddress = (addr: DBAddress) => {
    setSelectedSavedId(addr.id);
    const parts = addr.address1?.split(",").map((s: string) => s.trim()) || [];
    setAddress({
      name: addr.name || "",
      email: addr.email || "",
      phone: addr.phone || "",
      houseNo: parts[0] || addr.address1 || "",
      street: parts.slice(1).join(", ") || addr.address2 || "",
      landmark: addr.address2 && !parts[1] ? addr.address2 : "",
      city: addr.city || "",
      state: addr.state || "",
      zip: addr.zip || "",
      country: addr.country || "India",
    });
    setAddressErrors({});
    setShowAddressForm(false);
  };

  const validateAddress = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!address.name.trim() || address.name.trim().length < 2) {
      errors.name = "Enter your full name";
    }
    if (!address.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      errors.email = "Enter a valid email";
    }
    
    // Phone validation
    const digits = address.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) {
      baseNumber = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      baseNumber = digits.slice(1);
    }
    if (baseNumber.length !== 10) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }
    
    if (!isValidAddressField(address.houseNo, 1)) {
      errors.houseNo = "Enter house/flat number";
    }
    if (!isValidAddressField(address.street, 3)) {
      errors.street = "Enter street/road/area name";
    }
    if (!address.city.trim()) {
      errors.city = "City is required";
    }
    if (!address.state.trim()) {
      errors.state = "Select your state";
    }
    if (!/^\d{6}$/.test(address.zip.trim())) {
      errors.zip = "Enter a valid 6-digit PIN code";
    }
    
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) return;

    // Format phone
    const digits = address.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
    const formattedPhone = `+91${baseNumber}`;
    setAddress(prev => ({ ...prev, phone: formattedPhone }));
    setStep(2);
  };

  const handleApplyCoupon = async (overrideCode?: string, currentPaymentMethod?: string) => {
    const codeToValidate = overrideCode !== undefined ? overrideCode : couponCode;
    const paymentMethodToValidate = currentPaymentMethod !== undefined ? currentPaymentMethod : paymentMethod;
    if (!codeToValidate.trim()) return;
    setCouponLoading(true);
    setCouponMessage("");
    
    try {
      const res = await fetch("/api/storefront/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeToValidate,
          subtotal,
          paymentMethod: paymentMethodToValidate
        }),
      });
      const data = await res.json();
      
      setCouponMessage(data.message);
      if (data.valid) {
        setCouponValid(true);
        setApplyAsStoreCredit(!!data.applyAsStoreCredit);
        if (data.applyAsStoreCredit) {
          setCouponDiscount(0);
          setCashbackAmount(data.discount);
        } else {
          setCouponDiscount(data.discount);
          setCashbackAmount(0);
        }
      } else {
        setCouponDiscount(0);
        setCouponValid(false);
        setApplyAsStoreCredit(false);
        setCashbackAmount(0);
      }
    } catch {
      setCouponMessage("Unable to validate coupon.");
      setCouponValid(false);
      setApplyAsStoreCredit(false);
      setCashbackAmount(0);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMessage("");
    setCouponValid(false);
    setApplyAsStoreCredit(false);
    setCashbackAmount(0);
  };

  // Re-validate coupon when payment method changes
  useEffect(() => {
    if (couponValid && couponCode) {
      handleApplyCoupon(couponCode, paymentMethod);
    }
  }, [paymentMethod]);

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

      // Combine address fields into a single street for storage
      const fullStreet = [address.houseNo, address.street, address.landmark].filter(Boolean).join(", ");
      const checkoutAddress = { ...address, street: fullStreet };

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
        description: paymentMethod === "COD" ? "COD Upfront Fee ₹99" : "Order Payment",
        order_id: orderData.id || orderData.razorpay_order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/checkout/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address: checkoutAddress,
                paymentMethod,
                items,
                total,
                subtotal,
                codFee: paymentMethod === "COD" ? codFee : 0,
                razorpay: response,
                couponCode: couponValid ? couponCode : null,
                couponDiscount: couponDiscount,
                applyAsStoreCredit,
                cashbackAmount,
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
          method: (paymentMethod === "UPI" || paymentMethod === "COD") ? "upi" : paymentMethod === "CARD" ? "card" : paymentMethod === "PAYLATER" ? "paylater" : paymentMethod === "EMI" ? "emi" : undefined,
        },
        theme: {
          color: "#000000",
          backdrop_color: "rgba(0,0,0,0.7)",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
          confirm_close: true,
        },
      };

      // Configure display blocks for UPI, Card, PayLater, or EMI
      if (paymentMethod === "UPI" || paymentMethod === "COD") {
        if (selectedUpiApp) {
          options.config = {
            display: {
              blocks: {
                upi: {
                  name: "Direct UPI App",
                  instruments: [
                    {
                      method: "upi",
                      flows: ["intent"],
                      apps: [selectedUpiApp],
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
        } else if (upiId) {
          options.prefill.vpa = upiId;
          options.config = {
            display: {
              blocks: {
                upi: {
                  name: "UPI Collect Request",
                  instruments: [
                    {
                      method: "upi",
                      flows: ["collect"],
                      vpa: upiId,
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
        } else {
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
        }
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
      } else if (paymentMethod === "PAYLATER") {
        options.config = {
          display: {
            blocks: {
              paylater: {
                name: "Pay Later",
                instruments: [
                  {
                    method: "paylater"
                  }
                ]
              }
            },
            sequence: ["block.paylater"],
            preferences: {
              show_default_blocks: false
            }
          }
        };
      } else if (paymentMethod === "EMI") {
        options.config = {
          display: {
            blocks: {
              emi: {
                name: "EMI Options",
                instruments: [
                  {
                    method: "emi"
                  }
                ]
              }
            },
            sequence: ["block.emi"],
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

  /* ═══ Address field update helper ════════════════════════════ */
  const updateField = useCallback((field: keyof Address, value: string, sanitize = false) => {
    setSelectedSavedId("");
    setAddressErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    setAddress(prev => ({ ...prev, [field]: sanitize ? sanitizeAddress(value) : value }));
  }, []);

  /* ═══════════════════ RENDER ═══════════════════════════════ */
  return (
    <div className="min-h-[100dvh] relative bg-background text-foreground font-sans">
      {/* Razorpay SDK loaded via layout.tsx beforeInteractive — no duplicate script needed */}
      
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-20 md:pt-28 pb-6" style={{ minHeight: '100dvh' }}>
        {/* Page Title */}
        <div className="mb-4">
          <p className="text-[7px] font-semibold uppercase tracking-[0.4em] text-foreground/40 mb-0.5">Your Purchase</p>
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
        <div className="flex justify-center gap-1.5 mb-5">
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
              className="flex flex-col"
              style={{ minHeight: 'calc(100dvh - 160px)' }}
            >
              <div className="space-y-0.5 mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-foreground/50" />
                  Shipping Details
                </h2>
                <p className="text-foreground/40 text-[10px] font-medium uppercase tracking-wider">Where should we deliver?</p>
              </div>

              {/* Saved Addresses list */}
              {savedAddresses.length > 0 && !showAddressForm && (
                <div className="mb-3">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-foreground/45 mb-1.5">Saved Addresses</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`snap-start shrink-0 w-[180px] text-left p-3 rounded-2xl border transition-all ${
                          selectedSavedId === addr.id
                            ? "border-foreground/30 bg-foreground/[0.04] shadow-[0_0_15px_rgba(var(--foreground),0.02)]"
                            : "border-foreground/5 bg-foreground/[0.01] hover:border-foreground/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold truncate pr-1">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-full text-[5px] font-bold uppercase tracking-wider bg-foreground text-background">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[8px] text-foreground/50 truncate">
                          {addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}
                        </p>
                        <p className="text-[8px] text-foreground/50 font-medium">
                          {addr.city}, {addr.state}
                        </p>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedId("");
                        setAddress({
                          name: "", email: "", phone: "", houseNo: "", street: "",
                          landmark: "", city: "", state: "", zip: "", country: "India",
                        });
                        setAddressErrors({});
                        setShowAddressForm(true);
                      }}
                      className="snap-start shrink-0 p-3 rounded-2xl border border-foreground/5 hover:border-foreground/10 bg-foreground/[0.01] flex flex-col items-center justify-center gap-0.5 w-[100px] text-center"
                    >
                      <Plus className="w-3 h-3 text-foreground/40" />
                      <span className="text-[7px] font-bold uppercase tracking-widest text-foreground/50">New</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Address Display Card when form is hidden */}
              {!showAddressForm && selectedSavedId && (
                <div className="glass-panel p-5 rounded-[2rem] border border-foreground/10 bg-foreground/[0.01] flex flex-col gap-4 mb-4 shadow-sm animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-foreground/45">Deliver to</p>
                    <p className="text-sm font-extrabold tracking-tight">{address.name}</p>
                    <p className="text-[11px] text-foreground/60 leading-relaxed font-medium">
                      {address.houseNo}, {address.street}
                      {address.landmark ? `, ${address.landmark}` : ""}
                    </p>
                    <p className="text-[11px] text-foreground/60 leading-relaxed font-semibold">
                      {address.city}, {address.state} — {address.zip}
                    </p>
                    <p className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider flex items-center gap-1 pt-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-foreground/35" />
                      +91 {address.phone.replace("+91", "").replace("+91", "")}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t border-foreground/5">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="glass-cta w-full py-4 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      Deliver to this Address
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedId("");
                        setAddress({
                          name: "", email: "", phone: "", houseNo: "", street: "",
                          landmark: "", city: "", state: "", zip: "", country: "India",
                        });
                        setAddressErrors({});
                        setShowAddressForm(true);
                      }}
                      className="glass-button w-full py-3 text-[8px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" />
                      Add New Address
                    </button>
                  </div>
                </div>
              )}

              {showAddressForm && (
                <form onSubmit={handleAddressSubmit} className="flex-1 flex flex-col animate-in fade-in duration-300">
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const def = savedAddresses.find((a: DBAddress) => a.id === selectedSavedId) || savedAddresses[0];
                        if (def) {
                          handleSelectSavedAddress(def);
                        }
                        setShowAddressForm(false);
                      }}
                      className="glass-button w-full py-3 text-[8px] font-bold uppercase tracking-widest text-foreground/50 mb-3"
                    >
                      Back to Saved Addresses
                    </button>
                  )}
                  <div className="grid grid-cols-1 gap-2.5 flex-1">
                    {/* Full Name */}
                    <div>
                      <input
                        type="text"
                        placeholder="Full Name"
                        aria-label="Full Name"
                        required
                        value={address.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        className={`glass-input w-full px-4 py-3 text-[12px] rounded-2xl ${addressErrors.name ? "border-red-500/40" : ""}`}
                      />
                      {addressErrors.name && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.name}</p>}
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <input
                          type="email"
                          placeholder="Email"
                          aria-label="Email"
                          required
                          value={address.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className={`glass-input w-full px-4 py-3 text-[12px] rounded-2xl ${addressErrors.email ? "border-red-500/40" : ""}`}
                        />
                        {addressErrors.email && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.email}</p>}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-foreground/35 font-semibold pointer-events-none">+91</span>
                        <input
                          type="tel"
                          placeholder="Mobile"
                          aria-label="Mobile Number"
                          required
                          value={address.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          className={`glass-input w-full pl-9 pr-3 py-3 text-[12px] rounded-2xl ${addressErrors.phone ? "border-red-500/40" : ""}`}
                        />
                        {addressErrors.phone && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.phone}</p>}
                      </div>
                    </div>

                    {/* House No + Street */}
                    <div className="grid grid-cols-5 gap-2.5">
                      <div className="col-span-2">
                        <div className="relative">
                          <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25" />
                          <input
                            type="text"
                            placeholder="House / Flat No."
                            aria-label="House or Flat Number"
                            required
                            value={address.houseNo}
                            onChange={(e) => updateField("houseNo", e.target.value, true)}
                            className={`glass-input w-full pl-8 pr-3 py-3 text-[12px] rounded-2xl ${addressErrors.houseNo ? "border-red-500/40" : ""}`}
                          />
                        </div>
                        {addressErrors.houseNo && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.houseNo}</p>}
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25" />
                          <input
                            type="text"
                            placeholder="Street / Road / Area"
                            aria-label="Street, Road, or Area"
                            required
                            value={address.street}
                            onChange={(e) => updateField("street", e.target.value, true)}
                            className={`glass-input w-full pl-8 pr-3 py-3 text-[12px] rounded-2xl ${addressErrors.street ? "border-red-500/40" : ""}`}
                          />
                        </div>
                        {addressErrors.street && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.street}</p>}
                      </div>
                    </div>

                    {/* Landmark */}
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25" />
                      <input
                        type="text"
                        placeholder="Landmark (Optional)"
                        aria-label="Landmark"
                        value={address.landmark}
                        onChange={(e) => updateField("landmark", e.target.value, true)}
                        className="glass-input w-full pl-8 pr-3 py-3 text-[12px] rounded-2xl"
                      />
                    </div>

                    {/* PIN + City */}
                    <div className="grid grid-cols-5 gap-2.5">
                      <div className="col-span-2 relative">
                        <input
                          type="text"
                          placeholder="PIN Code"
                          aria-label="PIN Code"
                          required
                          maxLength={6}
                          value={address.zip}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            updateField("zip", val);
                          }}
                          className={`glass-input w-full px-4 py-3 text-[12px] rounded-2xl font-mono tracking-wider ${addressErrors.zip ? "border-red-500/40" : ""}`}
                        />
                        {zipLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-foreground/30" />
                        )}
                        {addressErrors.zip && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.zip}</p>}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="City"
                          aria-label="City"
                          required
                          value={address.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          className={`glass-input w-full px-4 py-3 text-[12px] rounded-2xl ${addressErrors.city ? "border-red-500/40" : ""}`}
                        />
                        {addressErrors.city && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.city}</p>}
                      </div>
                    </div>

                    {/* State dropdown */}
                    <div>
                      <select
                        required
                        value={address.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        className={`glass-input w-full px-4 py-3 text-[12px] rounded-2xl appearance-none cursor-pointer ${
                          !address.state ? "text-foreground/40" : ""
                        } ${addressErrors.state ? "border-red-500/40" : ""}`}
                      >
                        <option value="" disabled>Select State</option>
                        {INDIAN_STATES.map(s => (
                          <option key={s} value={s} className="bg-[#0e0e0e] text-foreground">{s}</option>
                        ))}
                      </select>
                      {addressErrors.state && <p className="text-[9px] text-red-400 mt-0.5 pl-1">{addressErrors.state}</p>}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="pt-4 mt-auto">
                    <button
                      type="submit"
                      className="glass-cta w-full py-4 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      Continue to Payment
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col"
              style={{ minHeight: 'calc(100dvh - 160px)' }}
            >
              {/* Back + Title */}
              <div className="flex items-center gap-2 mb-3">
                <button 
                  onClick={() => setStep(1)}
                  className="p-1.5 rounded-lg glass-panel hover:bg-foreground/5 text-foreground/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Payment</h2>
                  <p className="text-foreground/40 text-[10px] font-medium uppercase tracking-wider">Choose payment method</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-3">
                {/* ═══ Payment Methods ═══ */}
                <div className="space-y-2">
                  {[
                    { id: "UPI" as PaymentMethod, icon: Smartphone, label: "UPI Payment", desc: "GPay, PhonePe, Paytm & more", accent: "text-emerald-400" },
                    { id: "CARD" as PaymentMethod, icon: CreditCard, label: "Card Payment", desc: "Visa, Mastercard, RuPay", accent: "text-sky-400" },
                    { id: "PAYLATER" as PaymentMethod, icon: Sparkles, label: "Pay Later", desc: "Simpl, LazyPay, ICICI & more", accent: "text-purple-400" },
                    { id: "EMI" as PaymentMethod, icon: Tag, label: "EMI Options", desc: "Credit/Debit card & Cardless EMIs", accent: "text-pink-400" },
                    { id: "COD" as PaymentMethod, icon: Banknote, label: "Cash on Delivery", desc: "₹99 upfront processing fee", accent: "text-amber-400" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setPaymentMethod(method.id);
                        if (method.id !== "UPI") {
                          setSelectedUpiApp("");
                          setUpiId("");
                        }
                      }}
                      className={`w-full p-3.5 text-left rounded-2xl transition-all flex items-center gap-3 border ${
                        paymentMethod === method.id 
                          ? "bg-foreground text-background border-transparent scale-[1.01]" 
                          : "glass-panel text-foreground border-foreground/5 hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        paymentMethod === method.id ? "bg-background/20" : "bg-foreground/[0.04]"
                      }`}>
                        <method.icon className={`w-4 h-4 ${paymentMethod === method.id ? "text-background" : method.accent}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[11px] uppercase tracking-wide">{method.label}</p>
                        <p className={`text-[9px] font-medium ${paymentMethod === method.id ? "opacity-60" : "text-foreground/35"}`}>
                          {method.desc}
                        </p>
                      </div>
                      {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 text-background shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Custom UPI Options (Only when UPI is selected) */}
                <AnimatePresence>
                  {paymentMethod === "UPI" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden space-y-3"
                    >
                      <div className="glass-panel p-4 rounded-2xl border border-foreground/10 bg-foreground/[0.01] space-y-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-bold text-foreground/50 uppercase tracking-widest">Select UPI App</span>
                          <span className="text-[7px] text-foreground/30 uppercase tracking-wider font-semibold">Launch directly to complete payment</span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: "google_pay", name: "GPay", color: "from-blue-500/10 to-green-500/10 border-blue-500/20 text-blue-400" },
                            { id: "phonepe", name: "PhonePe", color: "from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-400" },
                            { id: "paytm", name: "Paytm", color: "from-sky-500/10 to-blue-500/10 border-sky-500/20 text-sky-400" },
                            { id: "bhim", name: "BHIM", color: "from-orange-500/10 to-green-500/10 border-orange-500/20 text-orange-400" },
                          ].map((app) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => {
                                setSelectedUpiApp(app.id);
                                setUpiId("");
                              }}
                              className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                                selectedUpiApp === app.id
                                  ? "bg-foreground text-background border-transparent scale-[1.02]"
                                  : "glass-panel text-foreground border-foreground/5 hover:border-foreground/15 hover:bg-foreground/[0.02]"
                              }`}
                            >
                              <span className="text-[10px] font-bold tracking-tight">{app.name}</span>
                              {selectedUpiApp === app.id && (
                                <span className="absolute -top-1 -right-1 bg-foreground text-background rounded-full p-0.5 animate-in scale-in duration-200">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-background fill-foreground" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 my-1">
                          <div className="h-[1px] bg-foreground/5 flex-1" />
                          <span className="text-[7px] font-bold text-foreground/20 uppercase tracking-widest">or</span>
                          <div className="h-[1px] bg-foreground/5 flex-1" />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-foreground/50 uppercase tracking-widest">Enter UPI ID (VPA)</span>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g., mobile@upi or username@okhdfcbank"
                              value={upiId}
                              onChange={(e) => {
                                setUpiId(e.target.value);
                                setSelectedUpiApp("");
                              }}
                              className="glass-input w-full px-3.5 py-2.5 text-[11px] rounded-xl pr-10 font-medium tracking-wide placeholder:text-foreground/25"
                            />
                            {upiId && (
                              <button
                                type="button"
                                onClick={() => setUpiId("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 hover:text-foreground/75 p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>


                {/* ═══ Coupon Code ═══ */}
                <div className="glass-panel p-3 space-y-2 border border-foreground/5 rounded-2xl">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-foreground/45" />
                    <span className="text-[8px] font-bold text-foreground/60 uppercase tracking-widest">Discount Code</span>
                  </div>
                  
                  {couponValid ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-foreground/[0.04] border border-foreground/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-foreground/80">{couponCode.toUpperCase()}</span>
                        <span className="text-[8px] text-foreground/40">— {couponMessage}</span>
                      </div>
                      <button onClick={handleRemoveCoupon} className="text-foreground/30 hover:text-foreground/60 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter code"
                        aria-label="Discount Code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="glass-input flex-1 px-3 py-2 text-[11px] uppercase tracking-wider rounded-xl"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="glass-button px-3 py-2 text-[9px] font-bold uppercase tracking-widest disabled:opacity-30 rounded-xl"
                      >
                        {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  )}
                  
                  {couponMessage && !couponValid && (
                    <p className="text-[9px] text-foreground/40 font-semibold">{couponMessage}</p>
                  )}
                </div>

                {/* ═══ Compact Order Preview ═══ */}
                <div className="glass-panel p-3 border border-foreground/5 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3 h-3 text-foreground/40" />
                      <span className="text-[8px] font-bold text-foreground/60 uppercase tracking-widest">
                        {items.length} Item{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-[80px] overflow-y-auto divide-y divide-foreground/5 scrollbar-thin">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-2 py-1.5 first:pt-0 last:pb-0 items-center">
                        <div className="w-8 h-10 rounded-lg bg-foreground/[0.02] border border-foreground/5 overflow-hidden shrink-0 relative">
                          {item.image ? (
                            <Image src={item.image} fill className="w-full h-full object-cover" alt={item.title} sizes="32px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-foreground/20 text-[6px]">ZB</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold text-foreground/80 truncate leading-tight">{item.title}</p>
                          <p className="text-[7px] text-foreground/40 font-bold uppercase tracking-wider">
                            {item.size || "Free"} × {item.quantity}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-foreground/70 shrink-0">₹{(parseFloat(item.price) * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ═══ Order Summary ═══ */}
                <div className="glass-panel p-3.5 space-y-2 border border-foreground/5 rounded-2xl">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-foreground/45">Subtotal</span>
                    <span className="text-foreground/80">₹{subtotal.toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && !applyAsStoreCredit && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-emerald-400">Discount</span>
                      <span className="text-emerald-400">- ₹{couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {applyAsStoreCredit && cashbackAmount > 0 && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-emerald-400">Cashback (Store Credit)</span>
                      <span className="text-emerald-400">+ ₹{cashbackAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {paymentMethod === "COD" && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-foreground/45">COD Fee</span>
                      <span className="text-foreground/60">+ ₹{codFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-foreground/45">Shipping</span>
                    <span className="text-foreground/60">Free</span>
                  </div>
                  <div className="h-[1px] bg-foreground/10" />
                  
                  {paymentMethod === "COD" ? (
                    <>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-foreground/45">Total</span>
                        <span className="text-foreground/70">₹{total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-foreground/45">Due at Delivery</span>
                        <span className="text-foreground/70">₹{(total - codFee).toLocaleString()}</span>
                      </div>
                      <div className="h-[1px] bg-foreground/10" />
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[10px] text-foreground/60 uppercase tracking-widest">Pay Now</span>
                        <span className="text-lg font-black tracking-tight text-foreground">₹{codFee}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-[10px] text-foreground/60 uppercase tracking-widest">Total</span>
                      <span className="text-lg font-black tracking-tight text-foreground">₹{total.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl text-[10px] font-bold" style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.12)", color: "rgba(255,100,100,0.9)" }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* ═══ CTA ═══ */}
                <div className="mt-auto pt-2">
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="glass-cta w-full py-4 text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2.5 disabled:opacity-30"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {paymentMethod === "COD" ? `Pay ₹${codFee} & Place COD Order` : "Complete Payment"}
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-[7px] text-foreground/20 mt-3 uppercase tracking-[0.25em] font-bold">
                    256-Bit SSL Secured Transaction
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
