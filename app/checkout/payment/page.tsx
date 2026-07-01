"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useMetaEvents } from "@/hooks/useMetaEvents";
import { trackStorefrontEvent } from "@/lib/track-client";
import { saveUserDataToCookiesAndReinit } from "@/lib/metaPixel";
import { CheckoutHeader, CheckoutInput, StickyCTA } from "@/components/CheckoutComponents";
import {
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  Tag,
  Plus,
  CreditCard,
  User,
  Smartphone,
  ChevronRight,
  ArrowRight,
  Info,
  Calendar,
  Sparkles
} from "lucide-react";

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

type PaymentMethod = "UPI" | "CARD" | "COD" | "PAYLATER" | "EMI";

export default function CheckoutPaymentPage() {
  const { data: session, status } = useSession();
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { trackAddPaymentInfo } = useMetaEvents();

  // Load address from localStorage
  const [address, setAddress] = useState<Address | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [paymentInfoFired, setPaymentInfoFired] = useState(false);

  // UPI details
  const [upiId, setUpiId] = useState("");
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("");
  const [touchedUpi, setTouchedUpi] = useState(false);

  // Card details
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });
  const [touchedCard, setTouchedCard] = useState<Record<string, boolean>>({});

  // Providers lists
  const [selectedPayLater, setSelectedPayLater] = useState("Simpl");
  const [selectedEMI, setSelectedEMI] = useState("hdfc");

  const codFee = 99;
  const shipping = 0;

  // Coupon states
  const [isCouponExpanded, setIsCouponExpanded] = useState(false);
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

  // Mount check and load states
  useEffect(() => {
    setMounted(true);
    const savedAddress = localStorage.getItem("zica_checkout_address");
    if (savedAddress) {
      try {
        setAddress(JSON.parse(savedAddress));
      } catch (e) {
        console.error("Failed to parse stored address:", e);
      }
    }

    const savedMethod = localStorage.getItem("zica_checkout_payment_method");
    if (savedMethod) {
      setPaymentMethod(savedMethod as PaymentMethod);
    }
  }, []);

  // Save payment method state locally
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("zica_checkout_payment_method", paymentMethod);
    }
  }, [paymentMethod, mounted]);

  // Auth / Cart Guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/checkout`);
    } else if (mounted && items.length === 0 && !isOrderPlaced) {
      router.push("/cart");
    } else if (mounted && !localStorage.getItem("zica_checkout_address")) {
      router.push("/checkout");
    }
  }, [items, isOrderPlaced, router, status, mounted]);

  // Fetch active coupons
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

  // Coupon calculations
  const calculateCouponDiscount = useCallback((coupon: any, subtotalAmount: number, payMethod: string) => {
    const isCOD = payMethod === "COD";

    if (subtotalAmount < Number(coupon.minOrderValue || 0)) {
      return {
        discount: 0,
        eligible: false,
        message: "Min order amount not met",
        type: "",
        value: 0,
        applyAsStoreCredit: false,
        cashbackEnabled: false,
        cashbackType: "percentage",
        cashbackValue: 0,
        cashbackAmount: 0
      };
    }

    if (coupon.applicability === "PREPAID_ONLY" && isCOD) {
      return {
        discount: 0,
        eligible: false,
        message: "Only valid for prepaid orders",
        type: "",
        value: 0,
        applyAsStoreCredit: false,
        cashbackEnabled: false,
        cashbackType: "percentage",
        cashbackValue: 0,
        cashbackAmount: 0
      };
    }
    if (coupon.applicability === "COD_ONLY" && !isCOD) {
      return {
        discount: 0,
        eligible: false,
        message: "Only valid for COD orders",
        type: "",
        value: 0,
        applyAsStoreCredit: false,
        cashbackEnabled: false,
        cashbackType: "percentage",
        cashbackValue: 0,
        cashbackAmount: 0
      };
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

    let cashbackAmt = 0;
    const isCashbackEnabled = !!coupon.cashbackEnabled;
    if (isCashbackEnabled) {
      const cbVal = Number(coupon.cashbackValue || 0);
      if (coupon.cashbackType === "percentage") {
        cashbackAmt = Math.round((subtotalAmount * cbVal) / 100);
      } else {
        cashbackAmt = Math.min(cbVal, subtotalAmount);
      }
    }

    return {
      discount: calculatedDiscount,
      eligible: true,
      type: currentDiscountType,
      value: currentDiscountValue,
      applyAsStoreCredit: !!coupon.applyAsStoreCredit,
      cashbackEnabled: isCashbackEnabled,
      cashbackType: coupon.cashbackType || "percentage",
      cashbackValue: Number(coupon.cashbackValue || 0),
      cashbackAmount: cashbackAmt
    };
  }, []);

  // Auto-coupon apply logic
  useEffect(() => {
    if (activeCoupons.length === 0 || isManualCoupon) return;

    const ranked = activeCoupons
      .map(coupon => ({
        coupon,
        calc: calculateCouponDiscount(coupon, subtotal, paymentMethod)
      }))
      .filter(item => item.coupon.autoApply && item.calc.eligible && (item.calc.discount > 0 || item.calc.cashbackAmount > 0))
      .sort((a, b) => {
        const immediateA = a.calc.applyAsStoreCredit ? 0 : a.calc.discount;
        const immediateB = b.calc.applyAsStoreCredit ? 0 : b.calc.discount;
        if (immediateA !== immediateB) {
          return immediateB - immediateA;
        }
        const cashbackA = a.calc.applyAsStoreCredit ? a.calc.discount : a.calc.cashbackAmount;
        const cashbackB = b.calc.applyAsStoreCredit ? b.calc.discount : b.calc.cashbackAmount;
        return cashbackB - cashbackA;
      });

    const best = ranked[0];
    if (best) {
      setCouponCode(best.coupon.code);
      setCouponValid(true);
      setApplyAsStoreCredit(best.coupon.applyAsStoreCredit);

      if (best.calc.cashbackEnabled && best.calc.cashbackAmount > 0) {
        setCashbackAmount(best.calc.cashbackAmount);
        if (best.coupon.applyAsStoreCredit) {
          setCouponDiscount(0);
        } else {
          setCouponDiscount(best.calc.discount);
        }
      } else {
        if (best.coupon.applyAsStoreCredit) {
          setCouponDiscount(0);
          setCashbackAmount(best.calc.discount);
        } else {
          setCouponDiscount(best.calc.discount);
          setCashbackAmount(0);
        }
      }

      let displayMessage = "";
      if (best.calc.cashbackEnabled && !best.coupon.applyAsStoreCredit && best.calc.discount > 0) {
        displayMessage = best.calc.type === "percentage"
          ? `${best.calc.value}% instant off + ₹${best.calc.cashbackAmount.toLocaleString("en-IN")} store credit cashback!`
          : `₹${best.calc.value.toLocaleString("en-IN")} instant off + ₹${best.calc.cashbackAmount.toLocaleString("en-IN")} store credit cashback!`;
      } else if (best.coupon.applyAsStoreCredit || (best.calc.cashbackEnabled && best.calc.discount === 0)) {
        const finalCashback = best.calc.discount > 0 ? best.calc.discount : best.calc.cashbackAmount;
        displayMessage = `₹${finalCashback.toLocaleString("en-IN")} Store Credit cashback will be added!`;
      } else {
        displayMessage = best.calc.type === "percentage"
          ? `${best.calc.value}% off applied automatically!`
          : `₹${best.calc.value.toLocaleString("en-IN")} off applied automatically!`;
      }
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

  // Re-validate coupon when payment method changes (for manual)
  useEffect(() => {
    if (isManualCoupon && couponValid && couponCode) {
      handleApplyCoupon(couponCode, paymentMethod, false);
    }
  }, [paymentMethod, isManualCoupon]);

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

        if (data.cashbackEnabled && data.cashbackAmount > 0) {
          setCashbackAmount(data.cashbackAmount);
          if (data.applyAsStoreCredit) {
            setCouponDiscount(0);
          } else {
            setCouponDiscount(data.discount);
          }
        } else {
          if (data.applyAsStoreCredit) {
            setCouponDiscount(0);
            setCashbackAmount(data.discount);
          } else {
            setCouponDiscount(data.discount);
            setCashbackAmount(0);
          }
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

  // Place Order logic
  const handlePlaceOrder = async () => {
    if (!address) {
      setError("Please return to the previous screen and complete your address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!(window as any).Razorpay) {
        setError("Payment gateway is loading. Please try again in a moment.");
        setLoading(false);
        return;
      }

      const fullStreet = [address.houseNo, address.street, address.landmark].filter(Boolean).join(", ");
      const checkoutAddress = { ...address, street: fullStreet };

      const paymentAmount = paymentMethod === "COD" ? codFee : total;

      const res = await fetch("/api/checkout/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: paymentAmount }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || "Failed to initiate payment");

      // Track server-side payment initiated
      trackStorefrontEvent('Payment Initiated', {
        customerId: (session?.user as any)?.id || null,
        customerPhone: address.phone || null,
        orderId: orderData.id || orderData.razorpay_order_id || null,
        metadata: {
          amount: paymentAmount,
          currency: 'INR',
          paymentMethod,
          num_items: items.length
        }
      });

      const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

      const options: any = {
        key: orderData.keyId || orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Zica Bella",
        description: paymentMethod === "COD" ? "COD Upfront Fee ₹99" : "Order Payment",
        order_id: orderData.id || orderData.razorpay_order_id,
        method: paymentMethod === "UPI" ? "upi" : paymentMethod === "CARD" ? "card" : paymentMethod === "PAYLATER" ? "paylater" : paymentMethod === "EMI" ? "emi" : undefined,
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
              if (typeof window !== "undefined") {
                sessionStorage.setItem("last_placed_order_id", verifyData.orderId);
                const joinedCategories = items.map(item => item.category).filter(Boolean).join(', ');
                sessionStorage.setItem(`order_categories_${verifyData.orderId}`, joinedCategories);
              }
              clear();
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

      // Configuration blocks per payment tab
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
                    method: "paylater",
                    provider: selectedPayLater.toLowerCase()
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
                    method: "emi",
                    provider: selectedEMI
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

      rzp.on('payment.failed', function (response: any) {
        const errorDesc = response?.error?.description || "Payment failed. Please try again.";
        const errorCode = response?.error?.code || "";
        console.error('[Razorpay] Payment failed:', response?.error);
        setError(`${errorDesc}${errorCode ? ` (${errorCode})` : ''}`);
        setLoading(false);
      });

      rzp.open();

      // Trigger analytics
      const nameParts = (address.name || "").trim().split(/\s+/);
      const fn = nameParts[0] || undefined;
      const ln = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

      const contentIds = items.map(item => item.productId);
      const contents = items.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: parseFloat(item.price)
      }));

      if (!paymentInfoFired) {
        trackAddPaymentInfo(
          {
            country: address.country,
            st: address.state,
            ct: address.city,
            zp: address.zip,
            fn,
            ln,
            em: address.email || undefined,
            ph: address.phone || undefined,
          },
          subtotal,
          'INR',
          contentIds,
          contents
        );
        setPaymentInfoFired(true);
      }

    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleBackClick = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  // Card validation helpers
  const handleCardFieldChange = (field: string, val: string) => {
    setCardDetails(prev => ({ ...prev, [field]: val }));
    setTouchedCard(prev => ({ ...prev, [field]: true }));
  };

  const validateCardField = (field: string) => {
    setTouchedCard(prev => ({ ...prev, [field]: true }));
  };

  const cardErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (touchedCard.number && cardDetails.number.replace(/\s/g, "").length !== 16) {
      errors.number = "Enter a valid 16-digit card number";
    }
    if (touchedCard.expiry && !/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(cardDetails.expiry)) {
      errors.expiry = "Use format MM/YY";
    }
    if (touchedCard.cvv && cardDetails.cvv.length !== 3) {
      errors.cvv = "Enter 3-digit CVV";
    }
    if (touchedCard.name && cardDetails.name.trim().length < 2) {
      errors.name = "Enter name on card";
    }
    return errors;
  }, [cardDetails, touchedCard]);

  const isCardFormValid = useMemo(() => {
    return (
      cardDetails.number.replace(/\s/g, "").length === 16 &&
      /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(cardDetails.expiry) &&
      cardDetails.cvv.length === 3 &&
      cardDetails.name.trim().length >= 2
    );
  }, [cardDetails]);

  // General enable CTA check
  const isCTADisabled = useMemo(() => {
    if (paymentMethod === "UPI") {
      if (selectedUpiApp) return false;
      const cleanUpi = upiId.trim();
      if (cleanUpi.length > 0) {
        return !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi);
      }
      return false; // can trigger generic UPI collect/intent chooser in Razorpay
    }
    if (paymentMethod === "CARD") {
      return !isCardFormValid;
    }
    return false; // other methods are enabled by default
  }, [paymentMethod, selectedUpiApp, upiId, isCardFormValid]);

  if (!mounted || !address) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] text-slate-800 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Loading Payment...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-slate-850 font-sans pb-36">
      {/* Shared floating Header */}
      <CheckoutHeader step={2} onBack={handleBackClick} />

      <main className="max-w-md mx-auto px-4 pt-24 flex flex-col gap-6">
        {/* Order Summary Card */}
        <section className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-slate-100/50">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-4 block font-mono">
            ORDER SUMMARY
          </span>

          <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto pr-1 hide-scrollbar">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3.5 items-center">
                <div className="w-12 h-15 rounded-xl overflow-hidden shrink-0 border border-slate-100 relative bg-white">
                  {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px] font-bold font-mono bg-slate-50">
                      ZB
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11.5px] font-black text-slate-800 uppercase tracking-tight truncate leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wide mt-1.5 leading-none">
                    Size: {item.size || "Free"} &nbsp;•&nbsp; Qty: {item.quantity}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-800 shrink-0">
                  ₹{(parseFloat(item.price) * item.quantity).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          <div className="h-[1px] bg-slate-100 my-3.5" />

          {/* Pricing breakdowns */}
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-none">
              <span>Subtotal</span>
              <span className="text-slate-800">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>

            {couponDiscount > 0 && !applyAsStoreCredit && (
              <div className="flex justify-between items-center text-[10px] font-bold text-emerald-500 uppercase tracking-wider leading-none">
                <span>Discount ({couponCode})</span>
                <span>- ₹{couponDiscount.toLocaleString("en-IN")}</span>
              </div>
            )}

            {cashbackAmount > 0 && (
              <div className="flex justify-between items-center text-[10px] font-bold text-emerald-500 uppercase tracking-wider leading-none">
                <span>Cashback ({couponCode})</span>
                <span>+ ₹{cashbackAmount.toLocaleString("en-IN")}</span>
              </div>
            )}

            {paymentMethod === "COD" && (
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-none">
                <span>COD Fee</span>
                <span className="text-slate-800">+ ₹{codFee}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-none">
              <span>Shipping</span>
              <span className="text-emerald-500 font-black">FREE</span>
            </div>

            <div className="h-[1px] bg-slate-100 my-1" />

            {paymentMethod === "COD" ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-none">
                  <span>Total</span>
                  <span className="text-slate-800">₹{total.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-none">
                  <span>Due at Delivery</span>
                  <span className="text-slate-800">₹{(total - codFee).toLocaleString("en-IN")}</span>
                </div>
                <div className="h-[1px] bg-slate-100 my-1" />
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-[10px] text-slate-450 uppercase tracking-wider leading-none">Pay Upfront</span>
                  <span className="text-sm font-black text-slate-900 tracking-tight leading-none">₹{codFee}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-[10.5px] text-slate-450 uppercase tracking-wider leading-none font-mono">Total Amount</span>
                <span className="text-base font-black text-slate-900 tracking-tight leading-none">₹{total.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </section>

        {/* Payment Method Selector Tab */}
        <section className="flex flex-col">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 block font-mono">
            PAYMENT METHOD
          </span>

          {/* Segmented iOS Slider control */}
          <div className="bg-slate-100/80 rounded-2xl p-1 flex w-full border border-slate-150/20 shadow-inner mb-4 select-none">
            {[
              { id: "UPI" as PaymentMethod, label: "UPI" },
              { id: "CARD" as PaymentMethod, label: "Card" },
              { id: "PAYLATER" as PaymentMethod, label: "Pay Later" },
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
                  className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/20 font-black"
                      : "text-slate-400 hover:text-slate-600 active:scale-95"
                  }`}
                >
                  {method.label}
                </button>
              );
            })}
          </div>

          {/* Conditional Contents per active tab */}
          <div className="animate-in fade-in duration-200">
            {/* UPI view */}
            {paymentMethod === "UPI" && (
              <div className="flex flex-col gap-4">
                {/* Enter UPI ID card */}
                <CheckoutInput
                  id="upiId"
                  label="Enter UPI ID"
                  icon={
                    <span className="font-mono text-xs font-bold text-slate-500 select-none">@</span>
                  }
                  error={
                    touchedUpi &&
                    upiId.trim().length > 0 &&
                    !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)
                      ? "Enter a valid UPI ID (e.g. name@upi)"
                      : undefined
                  }
                >
                  <div className="relative w-full flex items-center justify-between">
                    <input
                      id="upiId"
                      type="text"
                      placeholder="username@upi"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value.toLowerCase().trim());
                        setSelectedUpiApp("");
                      }}
                      onBlur={() => setTouchedUpi(true)}
                      className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                    />
                    <div className="w-5 h-5 text-slate-350 flex items-center justify-center shrink-0 ml-1.5 select-none pointer-events-none opacity-60">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                  </div>
                </CheckoutInput>

                {/* Or pay with UPI apps */}
                <div className="flex flex-col gap-2">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono select-none pl-0.5">
                    OR PAY WITH UPI APPS
                  </span>
                  <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar snap-x snap-mandatory">
                    {[
                      {
                        id: "google_pay",
                        name: "GPay",
                        logo: (
                          <div className="flex items-center justify-center gap-0.5 shrink-0 text-slate-900 font-extrabold text-[12px] tracking-tight select-none">
                            <span>GPay</span>
                          </div>
                        )
                      },
                      {
                        id: "phonepe",
                        name: "PhonePe",
                        logo: (
                          <div className="flex items-center justify-center h-5 w-5 rounded bg-purple-600 text-white shrink-0 mx-auto select-none">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                          </div>
                        )
                      },
                      {
                        id: "paytm",
                        name: "Paytm",
                        logo: (
                          <span className="text-[10px] font-black text-blue-650 tracking-tight leading-none select-none">
                            Paytm
                          </span>
                        )
                      },
                      {
                        id: "bhim",
                        name: "BHIM",
                        logo: (
                          <span className="text-[9.5px] font-black tracking-tight leading-none text-slate-800 select-none">
                            BHIM
                          </span>
                        )
                      },
                      {
                        id: "amazonpay",
                        name: "Amazon Pay",
                        logo: (
                          <span className="text-[10px] font-black text-amber-550 select-none">
                            Amazon
                          </span>
                        )
                      }
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
                          className={`snap-start shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl w-16 h-16 shadow-sm border transition-all ${
                            isSelected
                              ? "border-black ring-1 ring-black bg-slate-50"
                              : "border-slate-100 bg-white opacity-80 hover:opacity-100"
                          }`}
                        >
                          {app.logo}
                          <span className="text-[8.5px] font-bold text-slate-400">{app.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CARD view */}
            {paymentMethod === "CARD" && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <CheckoutInput
                  id="cardNumber"
                  label="Card Number"
                  icon={<CreditCard className="w-4.5 h-4.5" />}
                  error={cardErrors.number}
                >
                  <input
                    id="cardNumber"
                    type="tel"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={cardDetails.number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                      // Formats into chunks of 4 visually if possible, but keep plain for value
                      handleCardFieldChange("number", v);
                    }}
                    onBlur={() => validateCardField("number")}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none font-mono tracking-wider"
                  />
                </CheckoutInput>

                <div className="grid grid-cols-2 gap-3.5">
                  <CheckoutInput
                    id="cardExpiry"
                    label="Expiry Date"
                    icon={<Calendar className="w-4.5 h-4.5" />}
                    error={cardErrors.expiry}
                  >
                    <input
                      id="cardExpiry"
                      type="text"
                      placeholder="MM/YY"
                      value={cardDetails.expiry}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        if (v.length > 2) {
                          v = `${v.slice(0, 2)}/${v.slice(2, 4)}`;
                        }
                        handleCardFieldChange("expiry", v.slice(0, 5));
                      }}
                      onBlur={() => validateCardField("expiry")}
                      className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none font-mono"
                    />
                  </CheckoutInput>

                  <CheckoutInput
                    id="cardCVV"
                    label="CVV"
                    icon={<Lock className="w-4.5 h-4.5" />}
                    error={cardErrors.cvv}
                  >
                    <input
                      id="cardCVV"
                      type="password"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="•••"
                      value={cardDetails.cvv}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                        handleCardFieldChange("cvv", v);
                      }}
                      onBlur={() => validateCardField("cvv")}
                      className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none font-mono tracking-widest"
                    />
                  </CheckoutInput>
                </div>

                <CheckoutInput
                  id="cardName"
                  label="Name on Card"
                  icon={<User className="w-4.5 h-4.5" />}
                  error={cardErrors.name}
                >
                  <input
                    id="cardName"
                    type="text"
                    placeholder="Cardholder Name"
                    value={cardDetails.name}
                    onChange={(e) => handleCardFieldChange("name", e.target.value)}
                    onBlur={() => validateCardField("name")}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                </CheckoutInput>
              </div>
            )}

            {/* PAY LATER view */}
            {paymentMethod === "PAYLATER" && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                {["Simpl", "LazyPay"].map((prov) => (
                  <label
                    key={prov}
                    onClick={() => setSelectedPayLater(prov)}
                    className={`bg-white rounded-2xl p-4 border flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                      selectedPayLater === prov ? "border-black bg-slate-50" : "border-slate-100"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{prov}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedPayLater === prov ? "border-slate-850 bg-slate-850" : "border-slate-300 bg-transparent"
                    }`}>
                      {selectedPayLater === prov && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* EMI view */}
            {paymentMethod === "EMI" && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                {[
                  { id: "hdfc", name: "HDFC Bank EMI Plan" },
                  { id: "icici", name: "ICICI Bank EMI Plan" },
                  { id: "sbi", name: "SBI Card EMI Plan" }
                ].map((plan) => (
                  <label
                    key={plan.id}
                    onClick={() => setSelectedEMI(plan.id)}
                    className={`bg-white rounded-2xl p-4 border flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                      selectedEMI === plan.id ? "border-black bg-slate-50" : "border-slate-100"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{plan.name}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedEMI === plan.id ? "border-slate-850 bg-slate-850" : "border-slate-300 bg-transparent"
                    }`}>
                      {selectedEMI === plan.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* COD view */}
            {paymentMethod === "COD" && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/50 flex items-start gap-3.5 animate-in fade-in duration-200">
                <Info className="w-5.5 h-5.5 text-slate-450 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Cash on Delivery Conditions</h4>
                  <p className="text-[10px] text-slate-450 leading-relaxed mt-1">
                    An upfront payment of <span className="font-extrabold text-slate-850">₹99</span> is required to place COD orders. This ensures delivery commitment and limits failed deliveries. The remaining balance of <span className="font-extrabold text-slate-850">₹{(total - codFee).toLocaleString("en-IN")}</span> will be payable at your doorstep.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Promo / Coupon Code Section */}
        <section className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-slate-100/50 overflow-hidden">
          {couponValid ? (
            <div className="flex items-center justify-between p-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-800 leading-none">
                  Discount applied: <span className="font-black uppercase text-emerald-600 tracking-wide">{couponCode}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-[9.5px] font-bold uppercase tracking-widest font-mono text-red-500 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : !isCouponExpanded ? (
            <button
              type="button"
              onClick={() => setIsCouponExpanded(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50/30 transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                  Apply Coupon Code
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <div className="p-4 flex flex-col gap-3 animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                  Promo / Coupon Code
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCouponExpanded(false);
                    setCouponCode("");
                    setCouponMessage("");
                  }}
                  className="text-[8px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors font-mono"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1 border border-slate-100 focus-within:border-slate-350 focus-within:bg-white transition-all">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="ENTER CODE"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 h-8 bg-transparent border-0 outline-none text-xs font-semibold font-mono tracking-widest placeholder:text-slate-300 uppercase focus:ring-0 focus:outline-none text-slate-800 p-0"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleApplyCoupon()}
                  disabled={couponLoading || !couponCode.trim()}
                  className="h-8 px-4 rounded-lg bg-black text-white font-bold text-[9px] uppercase tracking-wider hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm"
                >
                  {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                </button>
              </div>
            </div>
          )}

          {couponMessage && (
            <div className={`px-4 pb-4 pt-1.5 text-[9.5px] font-bold leading-tight ${couponValid ? "text-emerald-500 animate-pulse-glow" : "text-red-500"}`}>
              {couponMessage}
            </div>
          )}
        </section>

        {/* Error Banner */}
        {error && (
          <section className="flex items-center gap-2.5 p-3.5 border border-red-200 bg-red-50 text-red-650 text-[10.5px] font-bold leading-snug rounded-2xl shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <p>{error}</p>
          </section>
        )}

        {/* trust badge row */}
        <section className="flex items-center justify-center gap-1.5 text-slate-400">
          <Lock className="w-3 h-3 text-slate-400 animate-pulse-glow" />
          <span className="text-[9px] font-bold font-mono tracking-wider">zicabella.com</span>
        </section>
      </main>

      {/* Sticky Bottom Pay CTA */}
      <StickyCTA
        label={
          loading
            ? "Processing..."
            : paymentMethod === "COD"
            ? `Pay ₹${codFee} & Place COD Order`
            : `Pay ₹${total.toLocaleString("en-IN")} Securely`
        }
        disabled={isCTADisabled}
        loading={loading}
        onClick={handlePlaceOrder}
      />
    </div>
  );
}
