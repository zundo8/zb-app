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
  ChevronDown,
  Home,
  Navigation,
  Building2,
  Smartphone,
  Banknote,
  Sparkles,
  User,
  Mail,
  Compass,
  Lock,
  Sun,
  Moon
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const [activeCoupons, setActiveCoupons] = useState<any[]>([]);
  const [isManualCoupon, setIsManualCoupon] = useState(false);
  
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

  const handleApplyCoupon = async (overrideCode?: string, currentPaymentMethod?: string, isAuto = false) => {
    const codeToValidate = overrideCode !== undefined ? overrideCode : couponCode;
    const paymentMethodToValidate = currentPaymentMethod !== undefined ? currentPaymentMethod : paymentMethod;
    if (!codeToValidate.trim()) return;

    if (!isAuto) {
      setIsManualCoupon(true);
    }

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
        if (!isAuto) {
          setIsManualCoupon(false);
        }
      }
    } catch {
      setCouponMessage("Unable to validate coupon.");
      setCouponValid(false);
      setApplyAsStoreCredit(false);
      setCashbackAmount(0);
      if (!isAuto) {
        setIsManualCoupon(false);
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setIsManualCoupon(true);
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMessage("");
    setCouponValid(false);
    setApplyAsStoreCredit(false);
    setCashbackAmount(0);
  };

  // Fetch active coupons from storefront active API
  useEffect(() => {
    const fetchActiveCoupons = async () => {
      try {
        const res = await fetch("/api/storefront/coupons/active");
        if (res.ok) {
          const data = await res.json();
          setActiveCoupons(data.coupons || []);
        }
      } catch (err) {
        console.error("Failed to load active coupons:", err);
      }
    };
    fetchActiveCoupons();
  }, []);

  // Client-side local evaluation helper for ranking coupons
  const calculateCouponDiscount = useCallback((coupon: any, subtotalAmount: number, payMethod: string) => {
    const isCOD = payMethod === "COD";
    
    // check minimum order value
    if (subtotalAmount < Number(coupon.minOrderValue || 0)) {
      return { discount: 0, eligible: false, message: "Min order amount not met", type: "", value: 0, applyAsStoreCredit: false };
    }
    
    // check payment method applicability
    if (coupon.applicability === "PREPAID_ONLY" && isCOD) {
      return { discount: 0, eligible: false, message: "Only valid for prepaid orders", type: "", value: 0, applyAsStoreCredit: false };
    }
    if (coupon.applicability === "COD_ONLY" && !isCOD) {
      return { discount: 0, eligible: false, message: "Only valid for COD orders", type: "", value: 0, applyAsStoreCredit: false };
    }
    
    let currentDiscountType = coupon.discountType;
    let currentDiscountValue = Number(coupon.discountValue);

    if (coupon.applicability === "PREPAID_ONLY" || (coupon.applicability === "CUSTOM_RATES" && !isCOD)) {
      currentDiscountType = coupon.prepaidDiscountType;
      currentDiscountValue = Number(coupon.prepaidDiscountValue);
    } else if (coupon.applicability === "COD_ONLY" || (coupon.applicability === "CUSTOM_RATES" && isCOD)) {
      currentDiscountType = coupon.codDiscountType;
      currentDiscountValue = Number(coupon.codDiscountValue);
    }

    let calculatedDiscount = 0;
    if (currentDiscountType === "percentage") {
      calculatedDiscount = Math.round((subtotalAmount * currentDiscountValue) / 100);
    } else {
      calculatedDiscount = Math.min(currentDiscountValue, subtotalAmount);
    }

    return { 
      discount: calculatedDiscount, 
      eligible: true, 
      type: currentDiscountType,
      value: currentDiscountValue,
      applyAsStoreCredit: !!coupon.applyAsStoreCredit
    };
  }, []);

  // Automatic coupon application logic
  useEffect(() => {
    if (activeCoupons.length === 0 || isManualCoupon) return;

    const ranked = activeCoupons
      .map(coupon => ({
        coupon,
        calc: calculateCouponDiscount(coupon, subtotal, paymentMethod)
      }))
      .filter(item => item.calc.eligible && item.calc.discount > 0)
      .sort((a, b) => {
        const immediateA = a.calc.applyAsStoreCredit ? 0 : a.calc.discount;
        const immediateB = b.calc.applyAsStoreCredit ? 0 : b.calc.discount;
        if (immediateA !== immediateB) {
          return immediateB - immediateA;
        }
        const cashbackA = a.calc.applyAsStoreCredit ? a.calc.discount : 0;
        const cashbackB = b.calc.applyAsStoreCredit ? b.calc.discount : 0;
        return cashbackB - cashbackA;
      });

    const best = ranked[0];
    if (best) {
      setCouponCode(best.coupon.code);
      setCouponValid(true);
      setApplyAsStoreCredit(best.coupon.applyAsStoreCredit);
      if (best.coupon.applyAsStoreCredit) {
        setCouponDiscount(0);
        setCashbackAmount(best.calc.discount);
      } else {
        setCouponDiscount(best.calc.discount);
        setCashbackAmount(0);
      }
      
      const displayMessage = best.coupon.applyAsStoreCredit
        ? `₹${best.calc.discount.toLocaleString("en-IN")} Store Credit cashback will be added!`
        : best.calc.type === "percentage"
          ? `${best.calc.value}% off applied automatically!`
          : `₹${best.calc.value.toLocaleString("en-IN")} off applied automatically!`;
      setCouponMessage(displayMessage);
    } else {
      setCouponCode("");
      setCouponDiscount(0);
      setCouponMessage("");
      setCouponValid(false);
      setApplyAsStoreCredit(false);
      setCashbackAmount(0);
    }
  }, [activeCoupons, subtotal, paymentMethod, isManualCoupon, calculateCouponDiscount]);

  // Re-validate coupon when payment method changes (only for manually applied/pinned coupons)
  useEffect(() => {
    if (isManualCoupon && couponValid && couponCode) {
      handleApplyCoupon(couponCode, paymentMethod, false);
    }
  }, [paymentMethod, isManualCoupon]);

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError("");

    try {
      // Ensure Razorpay SDK is loaded
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

  const handleBackClick = useCallback(() => {
    if (step === 2) {
      setStep(1);
    } else {
      if (typeof window !== "undefined" && document.referrer && document.referrer.startsWith(window.location.origin)) {
        router.back();
      } else {
        router.push("/cart");
      }
    }
  }, [step, router]);

  /* ═══════════════════ RENDER ═══════════════════════════════ */
  return (
    <div className="min-h-[100dvh] relative bg-[#000000] text-foreground font-sans">
      
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-4 pb-12 flex flex-col" style={{ minHeight: '100dvh' }}>
        
        {/* Custom Header Row */}
        <div className="flex items-center justify-between mb-8 pt-2">
          {/* Back button */}
          <button
            onClick={handleBackClick}
            className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4 text-white/80" strokeWidth={2.5} />
          </button>

          {/* CHECKOUT Pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <ChevronDown className="w-4 h-4 text-white/60" strokeWidth={2.5} />
            <span className="text-[9.5px] font-bold tracking-[0.25em] text-white uppercase pt-0.5">CHECKOUT</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]"
                aria-label="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-white/80" strokeWidth={1.75} />
                ) : (
                  <Moon className="w-4 h-4 text-white/80" strokeWidth={1.75} />
                )}
              </button>
            )}
            {/* Bag button */}
            <Link
              href="/cart"
              className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]"
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-4 h-4 text-white/80" strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        {/* Page Title & H1 */}
        <div className="mb-8">
          <p className="text-[8px] font-semibold uppercase tracking-[0.45em] text-white/45 mb-1.5 pl-0.5">YOUR PURCHASE</p>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black tracking-tight text-white leading-none">Checkout</h1>
            <span className="px-2.5 py-1 rounded-full text-[8.5px] font-extrabold bg-white/[0.06] border border-white/10 text-white/70 uppercase tracking-wider leading-none">
              Step {step}/2
            </span>
          </div>
        </div>

        {/* Step Indicator / Progress Tracker */}
        <div className="flex flex-col items-center mb-10 relative">
          <div className="w-full flex items-center justify-between px-16 relative">
            {/* Background Line */}
            <div className="absolute top-5 left-[calc(4rem+20px)] right-[calc(4rem+20px)] h-[1px] bg-white/10 z-0" />
            
            {/* Active Line (only when step === 2) */}
            {step === 2 && (
              <div className="absolute top-5 left-[calc(4rem+20px)] right-[calc(4rem+20px)] h-[1.5px] bg-white z-0 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-500" />
            )}

            {/* Step 1 */}
            <div className="flex flex-col items-center z-10 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
                step === 1 
                  ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                  : "bg-black text-white border-white/20"
              }`}>
                {step === 1 ? (
                  <span className="text-[12px] font-black">1</span>
                ) : (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-[8.5px] font-bold tracking-[0.2em] mt-3.5 uppercase transition-colors ${
                step === 1 ? "text-white" : "text-white/40"
              }`}>
                ADDRESS
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center z-10 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
                step === 2 
                  ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                  : "bg-black text-white/40 border-white/10"
              }`}>
                <span className="text-[12px] font-black">2</span>
              </div>
              <span className={`text-[8.5px] font-bold tracking-[0.2em] mt-3.5 uppercase transition-colors ${
                step === 2 ? "text-white" : "text-white/40"
              }`}>
                PAYMENT
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="address"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 flex flex-col"
            >
              {!showAddressForm ? (
                <>
                  {/* Address Headers */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <MapPin className="w-4 h-4 text-white/70" />
                    <h2 className="text-[12.5px] font-black uppercase tracking-wider text-white">SHIPPING ADDRESS</h2>
                  </div>
                  <p className="text-white/35 text-[9.5px] font-bold uppercase tracking-wider mb-6">Select a saved address or add a new one</p>

                  {/* Saved Addresses horizontal list */}
                  {savedAddresses.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-white/45 mb-3 pl-0.5">SAVED ADDRESSES</p>
                      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedSavedId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => handleSelectSavedAddress(addr)}
                              className={`snap-start shrink-0 w-[200px] text-left p-4 rounded-2xl border transition-all duration-300 relative ${
                                isSelected
                                  ? "border-white bg-white/[0.05] shadow-[0_0_20px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]"
                                  : "border-white/5 bg-white/[0.01] hover:border-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-black text-white truncate pr-1">{addr.name}</span>
                                {isSelected && (
                                  <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                                    <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <p className="text-[9px] text-white/50 leading-normal truncate">
                                {addr.address1}
                                {addr.address2 ? `, ${addr.address2}` : ""}
                              </p>
                              <p className="text-[9px] text-white/50 font-semibold mt-0.5">
                                {addr.city}, {addr.state} {addr.zip}
                              </p>
                              <p className="text-[8.5px] text-white/40 font-bold uppercase tracking-wider mt-2.5">
                                +91 {addr.phone.replace("+91", "").trim()}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Address Display Card & Action CTA buttons */}
                  {selectedSavedId && (
                    <div className="apple-glass-capsule p-6 rounded-[2rem] flex flex-col gap-5 mb-6">
                      <div className="space-y-3">
                        <div className="inline-block px-2.5 py-1 rounded bg-white/[0.06] border border-white/10 text-[8px] font-extrabold text-white/50 uppercase tracking-widest leading-none">
                          DELIVER TO
                        </div>
                        <h3 className="text-lg font-black text-white tracking-tight leading-none pt-0.5">{address.name}</h3>
                        
                        <div className="flex gap-3 items-start text-[11.5px] text-white/70 leading-relaxed font-medium">
                          <Home className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                          <div>
                            <p>{address.houseNo}, {address.street}</p>
                            {address.landmark && <p className="text-white/50">{address.landmark}</p>}
                            <p className="font-semibold text-white/80">{address.city}, {address.state} — {address.zip}</p>
                          </div>
                        </div>

                        <div className="flex gap-3 items-center text-[11.5px] text-white/70 font-semibold">
                          <Smartphone className="w-4 h-4 text-white/40 shrink-0" />
                          <p>+91 {address.phone.replace("+91", "").trim()}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                        {/* Deliver to this Address Button */}
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="w-full h-14 rounded-full bg-white text-black font-extrabold text-[10px] uppercase tracking-[0.15em] flex items-center justify-between px-6 hover:bg-white/95 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
                        >
                          <span>DELIVER TO THIS ADDRESS</span>
                          <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center">
                            <ChevronRight className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                          </div>
                        </button>

                        {/* Add New Address Button */}
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
                          className="w-full h-14 rounded-full bg-white/[0.03] border border-white/10 hover:border-white/15 text-white font-bold text-[10px] uppercase tracking-[0.15em] flex items-center justify-between px-6 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg border border-dashed border-white/30 flex items-center justify-center">
                              <Plus className="w-3 h-3 text-white/60" strokeWidth={2.5} />
                            </div>
                            <span>ADD NEW ADDRESS</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-white/40" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* New Address Entry Form UI */
                <div className="flex-1 flex flex-col">
                  {/* Address Headers */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <MapPin className="w-4 h-4 text-white/70" />
                    <h2 className="text-[12.5px] font-black uppercase tracking-wider text-white">SHIPPING DETAILS</h2>
                  </div>
                  <p className="text-white/35 text-[9.5px] font-bold uppercase tracking-wider mb-6">Enter the address where you want your order delivered</p>

                  <form onSubmit={handleAddressSubmit} className="flex-1 flex flex-col gap-3 animate-in fade-in duration-300">
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
                        className="w-full py-3 px-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/15 text-white/60 font-bold text-[9px] uppercase tracking-wider mb-2 transition-all"
                      >
                        ← Back to Saved Addresses
                      </button>
                    )}

                    {/* Full Name */}
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        aria-label="Full Name"
                        required
                        value={address.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.name ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                      />
                      {addressErrors.name && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.name}</p>}
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                        <input
                          type="email"
                          placeholder="Email"
                          aria-label="Email"
                          required
                          value={address.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.email ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                        />
                        {addressErrors.email && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.email}</p>}
                      </div>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                        <input
                          type="tel"
                          placeholder="Mobile Number"
                          aria-label="Mobile Number"
                          required
                          value={address.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.phone ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                        />
                        {addressErrors.phone && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.phone}</p>}
                      </div>
                    </div>

                    {/* House No */}
                    <div className="relative">
                      <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="House / Flat / Building"
                        aria-label="House or Flat Number"
                        required
                        value={address.houseNo}
                        onChange={(e) => updateField("houseNo", e.target.value, true)}
                        className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.houseNo ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                      />
                      {addressErrors.houseNo && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.houseNo}</p>}
                    </div>

                    {/* Street */}
                    <div className="relative">
                      <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30 rotate-45" />
                      <input
                        type="text"
                        placeholder="Street / Road / Area"
                        aria-label="Street, Road, or Area"
                        required
                        value={address.street}
                        onChange={(e) => updateField("street", e.target.value, true)}
                        className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.street ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                      />
                      {addressErrors.street && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.street}</p>}
                    </div>

                    {/* Landmark */}
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Landmark (Optional)"
                        aria-label="Landmark"
                        value={address.landmark}
                        onChange={(e) => updateField("landmark", e.target.value, true)}
                        className="w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border border-white/5 text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all"
                      />
                    </div>

                    {/* City + PIN Code */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                        <input
                          type="text"
                          placeholder="City"
                          aria-label="City"
                          required
                          value={address.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          className={`w-full h-13 pl-12 pr-4 rounded-xl bg-[#090909] border ${addressErrors.city ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                        />
                        {addressErrors.city && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.city}</p>}
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
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
                          className={`w-full h-13 pl-12 pr-10 rounded-xl bg-[#090909] border ${addressErrors.zip ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-mono tracking-wider font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all`}
                        />
                        {zipLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-white/40" />
                        )}
                        {addressErrors.zip && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.zip}</p>}
                      </div>
                    </div>

                    {/* State selection */}
                    <div className="relative">
                      <Compass className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30 pointer-events-none" />
                      <select
                        required
                        value={address.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        className={`w-full h-13 pl-12 pr-10 rounded-xl bg-[#090909] border ${addressErrors.state ? "border-red-500/40" : "border-white/5"} text-white text-[13.5px] font-semibold appearance-none cursor-pointer focus:border-white/20 focus:outline-none transition-all`}
                      >
                        <option value="" disabled>Select State</option>
                        {INDIAN_STATES.map(s => (
                          <option key={s} value={s} className="bg-[#0e0e0e] text-white">{s}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                      {addressErrors.state && <p className="text-[9px] text-red-400 mt-1 pl-1">{addressErrors.state}</p>}
                    </div>

                    {/* Continue to Payment CTA */}
                    <div className="pt-6 mt-auto">
                      <button
                        type="submit"
                        className="w-full h-14 rounded-full bg-white text-black font-extrabold text-[10px] uppercase tracking-[0.15em] flex items-center justify-between px-8 hover:bg-white/90 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
                      >
                        <span>CONTINUE TO PAYMENT</span>
                        <ChevronRight className="w-4 h-4 text-black" strokeWidth={3} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          ) : (
            /* Step 2: Payment UI */
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col">
                
                {/* Product Preview Section */}
                <div className="apple-glass-capsule p-4 rounded-2xl flex flex-col gap-3 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
                      <div className="w-14 h-18 rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden shrink-0 relative">
                        {item.image ? (
                          <Image src={item.image} fill className="w-full h-full object-cover animate-in fade-in duration-300" alt={item.title} sizes="56px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-[8px] font-black">ZB</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[12px] font-black text-white uppercase tracking-wider truncate leading-tight">{item.title}</h4>
                        <p className="text-[9.5px] text-white/40 font-bold uppercase tracking-wider mt-1.5 leading-none">
                          Size: {item.size || "Free"} &nbsp;•&nbsp; Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="text-[12px] font-extrabold text-white shrink-0">₹{(parseFloat(item.price) * item.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                {/* Payment Method Headers */}
                <p className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-white/45 mb-3 pl-0.5">PAYMENT METHOD</p>
                
                {/* Method selector horizontal tabs */}
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5 mb-6">
                  {[
                    { id: "UPI" as PaymentMethod, label: "UPI" },
                    { id: "CARD" as PaymentMethod, label: "CARD" },
                    { id: "PAYLATER" as PaymentMethod, label: "PAY LATER" },
                    { id: "EMI" as PaymentMethod, label: "EMI" },
                    { id: "COD" as PaymentMethod, label: "COD" }
                  ].map((method) => {
                    const isActive = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.id);
                          if (method.id !== "UPI") {
                            setSelectedUpiApp("");
                            setUpiId("");
                          }
                        }}
                        className={`py-2 px-1 text-[9px] font-extrabold uppercase tracking-wider rounded-lg text-center transition-all duration-300 ${
                          isActive
                            ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.1)] scale-[1.02]"
                            : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]"
                        }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                {/* UPI ID / Direct Intent Apps block */}
                {paymentMethod === "UPI" && (
                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 mb-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-extrabold text-white/40 uppercase tracking-widest pl-1 leading-none">ENTER UPI ID</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g., mobile@upi or username@okhdfcbank"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            setSelectedUpiApp("");
                          }}
                          className="w-full h-12 px-4 pr-11 rounded-xl bg-[#090909] border border-white/5 text-white text-[12px] font-semibold placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all tracking-wide"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <label className="text-[8px] font-extrabold text-white/40 uppercase tracking-widest pl-1 leading-none">OR PAY WITH</label>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        {[
                          { id: "google_pay", name: "GPay", logo: (
                            <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.848 10.744h-5.848v2.448h3.364c-.144.792-.616 1.464-1.296 1.92v1.584h2.1c1.224-1.128 1.932-2.796 1.932-4.788 0-.396-.036-.78-.108-1.164z" fill="#4285F4"/>
                              <path d="M12 16.692c1.264 0 2.328-.42 3.104-1.14l-2.1-1.584c-.58.396-1.32.624-2.104.624-1.62 0-2.988-1.092-3.48-2.556H5.212v1.644c.828 1.644 2.532 2.76 4.5 2.76z" fill="#34A853"/>
                              <path d="M8.52 12.036c-.12-.396-.192-.816-.192-1.248s.072-.852.192-1.248V7.896H5.212c-.408.816-.644 1.728-.644 2.704s.236 1.888.644 2.704l3.308-1.972z" fill="#FBBC05"/>
                              <path d="M9.712 5.34c.684 0 1.308.24 1.788.696l1.344-1.344C11.972 3.84 10.968 3.3 9.712 3.3c-1.968 0-3.672 1.116-4.5 2.76l3.308 1.972c.492-1.464 1.86-2.556 3.48-2.556z" fill="#EA4335"/>
                            </svg>
                          )},
                          { id: "phonepe", name: "PhonePe", logo: (
                            <div className="w-5 h-5 mx-auto rounded bg-purple-600 flex items-center justify-center text-white text-[8px] font-black tracking-tight">PP</div>
                          )},
                          { id: "paytm", name: "Paytm", logo: (
                            <div className="w-5 h-5 mx-auto rounded bg-[#0f2a4a] flex items-center justify-center text-[#00baf2] text-[7px] font-extrabold tracking-tighter">paytm</div>
                          )},
                          { id: "bhim", name: "BHIM", logo: (
                            <div className="w-5 h-5 mx-auto rounded bg-gradient-to-r from-orange-400 to-green-500 flex items-center justify-center text-white text-[7px] font-black">BHIM</div>
                          )},
                          { id: "more", name: "More", logo: (
                            <div className="w-5 h-5 mx-auto flex items-center justify-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            </div>
                          )}
                        ].map((app) => {
                          const isSelected = selectedUpiApp === app.id;
                          return (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => {
                                setSelectedUpiApp(app.id);
                                setUpiId("");
                              }}
                              className={`py-2.5 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
                                isSelected
                                  ? "bg-white text-black border-transparent scale-[1.02] shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
                                  : "bg-white/[0.01] border-white/5 text-white/40 hover:border-white/10 hover:text-white"
                              }`}
                            >
                              {app.logo}
                              <span className="text-[9.5px] font-bold leading-none mt-0.5">{app.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculations Summary block */}
                <div className="apple-glass-capsule p-5 rounded-2xl flex flex-col gap-3 mb-6">
                  <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                    <span className="text-white/40">Subtotal</span>
                    <span className="text-white/80">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  
                  {couponDiscount > 0 && !applyAsStoreCredit && (
                    <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                      <span className="text-emerald-400">Discount ({couponCode})</span>
                      <span className="text-emerald-400">- ₹{couponDiscount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {applyAsStoreCredit && cashbackAmount > 0 && (
                    <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                      <span className="text-emerald-400">Cashback ({couponCode})</span>
                      <span className="text-emerald-400">+ ₹{cashbackAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {paymentMethod === "COD" && (
                    <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                      <span className="text-white/45">COD Fee</span>
                      <span className="text-white/60">+ ₹{codFee}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                    <span className="text-white/40">Shipping</span>
                    <span className="text-white/80">FREE</span>
                  </div>

                  <div className="h-[1px] bg-white/5 my-1" />

                  {paymentMethod === "COD" ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                        <span className="text-white/40">Total</span>
                        <span className="text-white/80">₹{total.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-wider">
                        <span className="text-white/40">Due at Delivery</span>
                        <span className="text-white/80">₹{(total - codFee).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-[1px] bg-white/5 my-1" />
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[10.5px] text-white/50 uppercase tracking-widest">Pay Now</span>
                        <span className="text-xl font-black text-white tracking-tight leading-none">₹{codFee}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-[10.5px] text-white/50 uppercase tracking-widest">Total</span>
                      <span className="text-xl font-black text-white tracking-tight leading-none">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>

                {/* Apply Discount Banner */}
                <div className="apple-glass-capsule p-4 rounded-2xl flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-4.5 h-4.5 text-white/40" />
                    <span className="text-[12px] font-bold text-white/80">Apply Discount</span>
                  </div>
                  
                  {couponValid ? (
                    <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-white/10 border border-white/15 animate-in scale-in duration-300">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">{couponCode}</span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/60 hover:text-white"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center flex-1 max-w-[200px]">
                      <input
                        type="text"
                        placeholder="Enter code"
                        aria-label="Discount Code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="w-full h-8 px-2.5 rounded-lg bg-[#090909] border border-white/5 text-white text-[11px] font-mono tracking-wider placeholder:text-white/20 uppercase focus:border-white/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCode.trim()}
                        className="h-8 px-3 rounded-lg bg-white text-black font-extrabold text-[9px] uppercase tracking-wider hover:bg-white/90 disabled:opacity-30 transition-all flex items-center justify-center shrink-0"
                      >
                        {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Available Offers section when coupon is not applied */}
                {!couponValid && activeCoupons.length > 0 && (
                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-1.5 pl-1 mb-1 leading-none">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Available Offers</span>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                      {activeCoupons.map((coupon) => {
                        const isCOD = paymentMethod === "COD";
                        let benefitText = "";
                        let val = 0;
                        let type = "";
                        
                        if (coupon.applicability === "ALL") {
                          val = Number(coupon.discountValue);
                          type = coupon.discountType;
                        } else if (coupon.applicability === "PREPAID_ONLY" || (coupon.applicability === "CUSTOM_RATES" && !isCOD)) {
                          val = Number(coupon.prepaidDiscountValue);
                          type = coupon.prepaidDiscountType;
                        } else if (coupon.applicability === "COD_ONLY" || (coupon.applicability === "CUSTOM_RATES" && isCOD)) {
                          val = Number(coupon.codDiscountValue);
                          type = coupon.codDiscountType;
                        }
                        
                        if (type === "percentage") {
                          benefitText = `${val}% Off`;
                        } else {
                          benefitText = `₹${val} Off`;
                        }

                        if (coupon.applyAsStoreCredit) {
                          benefitText = `${benefitText} Cashback`;
                        }

                        const isEligible = subtotal >= Number(coupon.minOrderValue);
                        const isMethodApplicable = 
                          coupon.applicability === "ALL" ||
                          (isCOD && (coupon.applicability === "COD_ONLY" || coupon.applicability === "CUSTOM_RATES")) ||
                          (!isCOD && (coupon.applicability === "PREPAID_ONLY" || coupon.applicability === "CUSTOM_RATES"));

                        return (
                          <button
                            key={coupon.id}
                            type="button"
                            disabled={!isEligible || !isMethodApplicable}
                            onClick={() => {
                              setCouponCode(coupon.code);
                              setIsManualCoupon(true);
                              handleApplyCoupon(coupon.code, paymentMethod, false);
                            }}
                            className={`snap-start shrink-0 p-3.5 rounded-xl border text-left w-[185px] flex flex-col gap-1.5 transition-all duration-300 ${
                              !isEligible || !isMethodApplicable
                                ? "bg-white/[0.002] border-white/5 opacity-30 cursor-not-allowed"
                                : "bg-white/[0.015] border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
                            }`}
                          >
                            <span className="font-mono text-[9px] font-black text-white bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider self-start leading-none">
                              {coupon.code}
                            </span>
                            <p className="text-[10px] font-black text-white/80 leading-tight mt-1">
                              {benefitText} {coupon.applyAsStoreCredit ? "credited as cashback" : "instantly at checkout"}
                            </p>
                            <p className="text-[7.5px] text-white/35 font-semibold mt-0.5">
                              {Number(coupon.minOrderValue) > 0 ? `On orders above ₹${Number(coupon.minOrderValue).toLocaleString("en-IN")}` : "No minimum limit"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2.5 p-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] text-red-400 text-[11px] font-semibold mb-5 animate-in shake duration-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <p>{error}</p>
                  </div>
                )}

                {/* Secure Payment CTA row */}
                <div className="mt-auto pt-4 pb-8">
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="w-full h-16 rounded-full bg-white/[0.04] border border-white/10 hover:border-white/15 text-white font-extrabold text-[11.5px] uppercase tracking-[0.15em] flex items-center justify-between px-6 disabled:opacity-30 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-white/60" strokeWidth={2.5} />
                      <span>{loading ? "PROCESSING..." : paymentMethod === "COD" ? `PAY ₹${codFee} & PLACE COD ORDER` : `PAY ₹${total.toLocaleString("en-IN")} SECURELY`}</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      )}
                    </div>
                  </button>
                  
                  <div className="flex items-center justify-center gap-1.5 mt-4 text-white/20">
                    <Lock className="w-3 h-3" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.25em] leading-none">256-bit SSL secured transaction</span>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
