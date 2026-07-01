"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useMetaEvents } from "@/hooks/useMetaEvents";
import { trackStorefrontEvent } from "@/lib/track-client";
import { saveUserDataToCookiesAndReinit } from "@/lib/metaPixel";
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
  Lock,
  Sun,
  User,
  Mail,
  Globe,
  Map
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
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry"
];

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { trackInitiateCheckout, trackAddPaymentInfo } = useMetaEvents();

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

  const [step, setStep] = useState(1); // 1: Address, 2: Payment
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initiatedPixel, setInitiatedPixel] = useState(false);
  const [paymentInfoFired, setPaymentInfoFired] = useState(false);
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
      const joinedCategories = items.map(item => item.category).filter(Boolean).join(', ') || undefined;
      const contentIds = items.map(item => item.productId);
      const contents = items.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: parseFloat(item.price)
      }));
      trackInitiateCheckout(subtotal, items.length, 'INR', joinedCategories, contentIds, undefined, contents);

      // Track Checkout Started event server-side
      trackStorefrontEvent('Checkout Started', {
        customerId: (session?.user as any)?.id || null,
        customerPhone: address.phone || null,
        metadata: {
          num_items: items.length,
          value: subtotal,
          currency: "INR",
          content_ids: contentIds
        }
      });
    }
  }, [items, subtotal, initiatedPixel, session, address.phone]);


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

  // Fetch saved addresses callback
  const fetchSavedAddresses = useCallback(async (selectDefault = false) => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/customer/addresses");
      const data = await res.json();
      if (data.addresses && data.addresses.length > 0) {
        setSavedAddresses(data.addresses);
        if (selectDefault) {
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
        }
      } else {
        setShowAddressForm(true);
      }
    } catch (err) {
      console.error("Error loading addresses:", err);
      setShowAddressForm(true);
    }
  }, [status]);

  useEffect(() => {
    fetchSavedAddresses(true);
  }, [fetchSavedAddresses]);

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

    // Save details to cookies and re-init pixel for Advanced Matching
    saveUserDataToCookiesAndReinit({
      email: addr.email || undefined,
      phone: addr.phone || undefined,
      name: addr.name || undefined,
      city: addr.city || undefined,
      state: addr.state || undefined,
      zip: addr.zip || undefined,
      country: addr.country || "India",
    });
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

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) return;

    setLoading(true);

    // Format phone
    const digits = address.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
    const formattedPhone = `+91${baseNumber}`;
    const updatedAddress = { ...address, phone: formattedPhone };
    setAddress(updatedAddress);

    // Auto-save address to database on proceed
    try {
      const response = await fetch("/api/customer/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: updatedAddress.name,
          phone: updatedAddress.phone,
          email: updatedAddress.email,
          address1: `${updatedAddress.houseNo}, ${updatedAddress.street}`,
          address2: updatedAddress.landmark,
          city: updatedAddress.city,
          state: updatedAddress.state,
          zip: updatedAddress.zip,
          country: updatedAddress.country,
          isDefault: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.address) {
          setSelectedSavedId(data.address.id);
          // Reload saved addresses to sync UI in real time
          await fetchSavedAddresses(false);
          setShowAddressForm(false);
        }
      }
    } catch (err) {
      console.error("Failed to auto-save address on proceed:", err);
    } finally {
      setLoading(false);
    }

    setStep(2);

    const nameParts = (updatedAddress.name || "").trim().split(/\s+/);
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
          country: updatedAddress.country,
          st: updatedAddress.state,
          ct: updatedAddress.city,
          zp: updatedAddress.zip,
          fn,
          ln,
          em: updatedAddress.email || undefined,
          ph: formattedPhone || undefined,
        },
        subtotal,
        'INR',
        contentIds,
        contents
      );
      setPaymentInfoFired(true);
    }

    // Save details to cookies and re-init pixel for Advanced Matching
    saveUserDataToCookiesAndReinit({
      email: updatedAddress.email || undefined,
      phone: formattedPhone || undefined,
      name: updatedAddress.name || undefined,
      city: updatedAddress.city || undefined,
      state: updatedAddress.state || undefined,
      zip: updatedAddress.zip || undefined,
      country: updatedAddress.country || "India",
    });
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

        // Handle double discounts: check if cashback is enabled
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

    // check payment method applicability
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

    // Calculate cashback if enabled
    let cashbackAmount = 0;
    const isCashbackEnabled = !!coupon.cashbackEnabled;
    if (isCashbackEnabled) {
      const cbVal = Number(coupon.cashbackValue || 0);
      if (coupon.cashbackType === "percentage") {
        cashbackAmount = Math.round((subtotalAmount * cbVal) / 100);
      } else {
        cashbackAmount = Math.min(cbVal, subtotalAmount);
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
      cashbackAmount
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

      // Track Payment Initiated event
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

  return (
    <div className="min-h-[100dvh] relative bg-background text-foreground font-sans">

      <div className="relative z-10 max-w-xl mx-auto px-4 pt-24 pb-12 flex flex-col" style={{ minHeight: '100dvh' }}>

        {/* Page Title & H1 */}
        <div className="mb-6">
          <p className="text-[8.5px] font-extrabold uppercase tracking-[0.4em] text-foreground/40 mb-1 pl-0.5">YOUR PURCHASE</p>
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-black tracking-tight text-foreground leading-none mb-1">Checkout</h1>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            /* ORIGINAL Step 1 Address Selection and form logic (fully reverted) */
            <motion.div
              key="address"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col animate-in fade-in duration-300"
              style={{ minHeight: 'calc(100dvh - 160px)' }}
            >
              <div className="flex flex-col gap-1.5 mb-5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-foreground/80" strokeWidth={2.25} />
                  <h2 className="text-[12px] font-black uppercase tracking-[0.12em] text-foreground/90">
                    SHIPPING DETAILS
                  </h2>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-foreground/40 pl-6">
                  WHERE SHOULD WE DELIVER?
                </p>
              </div>

              {/* Saved Addresses list */}
              {savedAddresses.length > 0 && !showAddressForm && (
                <div className="mb-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/45 mb-2 pl-0.5">Saved Addresses</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`snap-start shrink-0 w-[180px] text-left p-4 rounded-xl border transition-all ${selectedSavedId === addr.id
                          ? "border-black/40 dark:border-white/40 bg-black/[0.02] dark:bg-white/[0.02] shadow-sm"
                          : "border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-black"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold truncate pr-1">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-full text-[6px] font-bold uppercase tracking-wider bg-foreground text-background">
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
                          name: "", email: "", phone: "", houseNo: "", street: "",
                          landmark: "", city: "", state: "", zip: "", country: "India",
                        });
                        setAddressErrors({});
                        setShowAddressForm(true);
                      }}
                      className="snap-start shrink-0 p-4 rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-black flex flex-col items-center justify-center gap-1 w-[100px] text-center transition-all hover:bg-black/[0.01] dark:hover:bg-white/[0.01]"
                    >
                      <Plus className="w-4 h-4 text-foreground/45" />
                      <span className="text-[8px] font-bold uppercase tracking-wider text-foreground/55">New</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Address Display Card when form is hidden */}
              {!showAddressForm && selectedSavedId && (
                <div className="p-6 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-black/40 flex flex-col gap-4 mb-4 shadow-sm animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/45">Deliver to</p>
                    <p className="text-sm font-extrabold tracking-tight">{address.name}</p>
                    <p className="text-[12px] text-foreground/60 leading-relaxed font-medium">
                      {address.houseNo}, {address.street}
                      {address.landmark ? `, ${address.landmark}` : ""}
                    </p>
                    <p className="text-[12px] text-foreground/60 leading-relaxed font-semibold">
                      {address.city}, {address.state} — {address.zip}
                    </p>
                    <p className="text-[11px] text-foreground/50 font-bold uppercase tracking-wider flex items-center gap-1.5 pt-1.5">
                      <Smartphone className="w-4 h-4 text-foreground/35" />
                      +91 {address.phone.replace("+91", "").replace("+91", "")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full h-[54px] bg-black text-white dark:bg-white dark:text-black rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Deliver to this Address</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
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
                      className="w-full h-11 text-[9px] font-semibold uppercase tracking-[0.15em] bg-transparent border border-dashed border-black/[0.12] dark:border-white/[0.12] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] rounded-xl text-foreground/75 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
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
                      className="w-full h-11 text-[9px] font-semibold uppercase tracking-[0.15em] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-[0.98] rounded-xl text-foreground/55 transition-all flex items-center justify-center mb-4 whitespace-nowrap"
                    >
                      Back to Saved Addresses
                    </button>
                  )}
                  
                  <div className="flex flex-col gap-3 flex-1">
                    {/* Full Name */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.name ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <User className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Full Name"
                          aria-label="Full Name"
                          required
                          value={address.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.name && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.name}</p>}
                    </div>

                    {/* Email Address */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.email ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Mail className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <input
                          type="email"
                          placeholder="Email Address"
                          aria-label="Email"
                          required
                          value={address.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.email && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.email}</p>}
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.phone ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Smartphone className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <div className="flex items-center gap-1 text-[13px] font-bold text-foreground/75 px-0.5 select-none">
                          <span>+91</span>
                          <ChevronDown className="w-3 h-3 text-foreground/45" />
                        </div>
                        <div className="h-5 w-[1px] bg-black/[0.08] dark:bg-white/[0.08] mx-3" />
                        <input
                          type="tel"
                          placeholder="Mobile Number"
                          aria-label="Mobile Number"
                          required
                          value={address.phone.startsWith("+91") ? address.phone.slice(3) : address.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.phone && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.phone}</p>}
                    </div>

                    {/* House / Flat / Building */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.houseNo ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Home className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="House / Flat / Building"
                          aria-label="House or Flat Number"
                          required
                          value={address.houseNo}
                          onChange={(e) => updateField("houseNo", e.target.value, true)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.houseNo && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.houseNo}</p>}
                    </div>

                    {/* Street / Road / Area */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.street ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Navigation className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none rotate-45" />
                        <input
                          type="text"
                          placeholder="Street / Road / Area"
                          aria-label="Street, Road, or Area"
                          required
                          value={address.street}
                          onChange={(e) => updateField("street", e.target.value, true)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.street && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.street}</p>}
                    </div>

                    {/* Landmark (Optional) */}
                    <div>
                      <div className="relative flex items-center w-full h-[54px] bg-white dark:bg-black border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 focus-within:border-black/30 dark:focus-within:border-white/30 transition-all">
                        <Building2 className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Landmark (Optional)"
                          aria-label="Landmark"
                          value={address.landmark}
                          onChange={(e) => updateField("landmark", e.target.value, true)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                    </div>

                    {/* PIN Code */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.zip ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <MapPin className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
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
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0 font-mono tracking-wider"
                        />
                        {zipLoading && (
                          <Loader2 className="absolute right-4 w-4 h-4 animate-spin text-foreground/30" />
                        )}
                      </div>
                      {addressErrors.zip && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.zip}</p>}
                    </div>

                    {/* City */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.city ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Globe className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="City"
                          aria-label="City"
                          required
                          value={address.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-normal text-foreground placeholder:text-foreground/35 p-0"
                        />
                      </div>
                      {addressErrors.city && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.city}</p>}
                    </div>

                    {/* Select State */}
                    <div>
                      <div className={`relative flex items-center w-full h-[54px] bg-white dark:bg-black border rounded-xl px-4 transition-all duration-200 ${addressErrors.state ? "border-red-500/50 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/30" : "border-black/[0.08] dark:border-white/[0.08] focus-within:border-black/30 dark:focus-within:border-white/30"}`}>
                        <Map className="w-4.5 h-4.5 text-foreground/35 mr-3 pointer-events-none" />
                        <span className={`text-[13px] ${!address.state ? "text-foreground/35" : "text-foreground"}`}>
                          {address.state || "Select State"}
                        </span>
                        <ChevronDown className="absolute right-4 w-4 h-4 text-foreground/35 pointer-events-none" />
                        <select
                          required
                          value={address.state}
                          onChange={(e) => updateField("state", e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          <option value="" disabled>Select State</option>
                          {INDIAN_STATES.map(s => (
                            <option key={s} value={s} className="bg-background text-foreground">{s}</option>
                          ))}
                        </select>
                      </div>
                      {addressErrors.state && <p className="text-[9px] text-red-500 mt-1 pl-1">{addressErrors.state}</p>}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="pt-4 mt-auto">
                    <button
                      type="submit"
                      className="w-full h-[54px] bg-black text-white dark:bg-white dark:text-black rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Continue to Payment</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
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
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col">

                {/* Product Preview Card */}
                <div className="apple-glass-capsule p-4 rounded-2xl flex flex-col gap-3 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
                      <div className="w-14 h-18 rounded-xl bg-foreground/[0.02] border border-foreground/10 overflow-hidden shrink-0 relative">
                        {item.image ? (
                          <img src={item.image} className="w-full h-full object-cover animate-in fade-in duration-300" alt={item.title} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-foreground/20 text-[8px] font-light">ZB</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-normal text-foreground/85 uppercase tracking-wide truncate leading-tight">{item.title}</h4>
                        <p className="text-[9px] text-foreground/40 font-light uppercase tracking-wider mt-1.5 leading-none">
                          Size: {item.size || "Free"} &nbsp;•&nbsp; Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="text-[11.5px] font-normal text-foreground/80 shrink-0">₹{(parseFloat(item.price) * item.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                {/* Payment Method header label */}
                <p className="text-[8px] font-light uppercase tracking-[0.25em] text-foreground/45 mb-2 pl-0.5">PAYMENT METHOD</p>

                {/* Segment tabs */}
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-foreground/[0.03] border border-foreground/5 mb-6">
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
                          if (method.id !== "UPI") {
                            setSelectedUpiApp("");
                            setUpiId("");
                          }
                        }}
                        className={`py-2 px-0.5 text-[7px] min-[360px]:text-[8px] sm:text-[9.5px] font-normal uppercase tracking-[0.05em] min-[360px]:tracking-[0.1em] sm:tracking-[0.12em] rounded-lg text-center transition-all duration-300 border whitespace-nowrap ${isActive
                          ? "bg-foreground/[0.08] dark:bg-white/[0.1] border-foreground/15 dark:border-white/15 text-foreground scale-[1.02]"
                          : "border-transparent text-foreground/40 hover:text-foreground hover:bg-foreground/[0.02]"
                          }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                {/* UPI details */}
                {paymentMethod === "UPI" && (
                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 mb-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-light text-foreground/40 uppercase tracking-widest pl-1 leading-none">ENTER UPI ID</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="mobile@upi"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            setSelectedUpiApp("");
                          }}
                          className="w-full h-12 px-4 pr-11 rounded-xl bg-foreground/[0.02] border border-foreground/5 text-foreground text-[11px] font-light placeholder:text-foreground/20 focus:border-foreground/20 focus:outline-none transition-all tracking-wide"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <label className="text-[8px] font-light text-foreground/40 uppercase tracking-widest pl-1 leading-none">OR PAY WITH</label>
                      <div className="grid grid-cols-4 gap-1.5 text-center mt-1">
                        {[
                          {
                            id: "google_pay", name: "GPay", logo: (
                              <div className="flex items-center justify-center gap-1 h-6 shrink-0">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span className="text-[10px] font-black text-foreground tracking-tight pt-0.5">Pay</span>
                              </div>
                            )
                          },
                          {
                            id: "phonepe", name: "PhonePe", logo: (
                              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-[#5f259f] shrink-0 mx-auto">
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                              </div>
                            )
                          },
                          {
                            id: "paytm", name: "Paytm", logo: (
                              <div className="flex items-center justify-center h-6 w-11 bg-white rounded-md shrink-0 mx-auto border border-black/5">
                                <span className="text-[8.5px] font-black italic tracking-tighter leading-none">
                                  <span className="text-[#002e6e]">pay</span>
                                  <span className="text-[#00baf2]">tm</span>
                                </span>
                              </div>
                            )
                          },
                          {
                            id: "bhim", name: "BHIM", logo: (
                              <div className="flex items-center justify-center h-6 w-10 bg-[#e4e4e4] rounded-md shrink-0 mx-auto border border-black/5">
                                <span className="text-[7.5px] font-black tracking-tight leading-none text-black italic">
                                  <span className="text-orange-500">BH</span>
                                  <span className="text-green-600">IM</span>
                                </span>
                              </div>
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
                              className={`flex flex-col items-center justify-center gap-1.5 py-1.5 transition-all duration-300 hover:scale-105 active:scale-95 ${selectedUpiApp === "" || isSelected
                                ? "opacity-100 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                                : "opacity-35"
                                }`}
                            >
                              {app.logo}
                              <span className="text-[9px] font-light tracking-wide text-foreground/50">{app.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculations Summary */}
                <div className="apple-glass-capsule p-5 rounded-2xl flex flex-col gap-3 mb-6">
                  <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                    <span className="text-foreground/40">Subtotal</span>
                    <span className="text-foreground/75">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {couponDiscount > 0 && !applyAsStoreCredit && (
                    <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                      <span className="text-emerald-400/90">Discount ({couponCode})</span>
                      <span className="text-emerald-400/90">- ₹{couponDiscount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {cashbackAmount > 0 && (
                    <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                      <span className="text-emerald-400/90">Cashback ({couponCode})</span>
                      <span className="text-emerald-400/90">+ ₹{cashbackAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {paymentMethod === "COD" && (
                    <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                      <span className="text-foreground/45">COD Fee</span>
                      <span className="text-foreground/60">+ ₹{codFee}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                    <span className="text-foreground/40">Shipping</span>
                    <span className="text-foreground/75">FREE</span>
                  </div>

                  <div className="h-[1px] bg-foreground/5 my-1" />

                  {paymentMethod === "COD" ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                        <span className="text-foreground/40">Total</span>
                        <span className="text-foreground/75">₹{total.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9.5px] font-light uppercase tracking-wider">
                        <span className="text-foreground/40">Due at Delivery</span>
                        <span className="text-foreground/75">₹{(total - codFee).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-[1px] bg-foreground/5 my-1" />
                      <div className="flex justify-between items-center">
                        <span className="font-light text-[9.5px] text-foreground/45 uppercase tracking-widest">Pay Now</span>
                        <span className="text-lg font-medium text-foreground tracking-tight leading-none">₹{codFee}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-light text-[9.5px] text-foreground/45 uppercase tracking-widest">Total</span>
                      <span className="text-lg font-medium text-foreground tracking-tight leading-none">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>

                {/* Apply Discount Banner */}
                <div className="apple-glass-capsule p-4 rounded-2xl flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-4.5 h-4.5 text-foreground/40" />
                    <span className="text-[11px] font-light text-foreground/75">Apply Discount</span>
                  </div>

                  {couponValid ? (
                    <div className="flex items-center gap-2.5 py-1.5 px-3 rounded-full bg-foreground/[0.08] border border-foreground/10 animate-in scale-in duration-300">
                      <span className="text-[9.5px] font-medium text-foreground uppercase tracking-wider">{couponCode}</span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground/20 text-foreground/60 hover:text-foreground"
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
                        className="w-full h-8 px-2.5 rounded-lg bg-foreground/[0.02] border border-foreground/5 text-foreground text-[10px] font-mono tracking-wider placeholder:text-foreground/20 uppercase focus:border-foreground/20 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCode.trim()}
                        className="h-8 px-3 rounded-lg bg-foreground/[0.03] dark:bg-white/[0.05] border border-foreground/10 dark:border-white/10 text-foreground font-light text-[9.5px] uppercase tracking-[0.15em] hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08] backdrop-blur-md active:scale-[0.98] disabled:opacity-30 transition-all flex items-center justify-center shrink-0 whitespace-nowrap"
                      >
                        {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Available Offers */}
                {!couponValid && activeCoupons.length > 0 && (
                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-1.5 pl-1 mb-1 leading-none">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                      <span className="text-[8px] font-light text-foreground/40 uppercase tracking-widest">Available Offers</span>
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
                            className={`snap-start shrink-0 p-3.5 rounded-xl border text-left w-[185px] flex flex-col gap-1.5 transition-all duration-300 ${!isEligible || !isMethodApplicable
                              ? "bg-foreground/[0.002] border-foreground/5 opacity-30 cursor-not-allowed"
                              : "bg-foreground/[0.015] border-foreground/5 hover:border-foreground/10 hover:bg-foreground/[0.02]"
                              }`}
                          >
                            <span className="font-mono text-[9px] font-light text-foreground bg-foreground/10 px-1.5 py-0.5 rounded uppercase tracking-wider self-start leading-none">
                              {coupon.code}
                            </span>
                            <p className="text-[10px] font-light text-foreground/80 leading-tight mt-1">
                              {benefitText} {coupon.applyAsStoreCredit ? "credited as cashback" : "instantly at checkout"}
                            </p>
                            <p className="text-[7.5px] text-foreground/35 font-light mt-0.5">
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

                {/* Secure Payment button */}
                <div className="mt-auto pt-4 pb-8">
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className={`w-full ${paymentMethod === "COD" ? "h-14 pl-14" : "h-12 pl-12"
                      } rounded-full bg-black/95 dark:bg-white/95 hover:bg-black/90 dark:hover:bg-white/90 active:scale-[0.98] backdrop-blur-xl border border-black/10 dark:border-white/10 text-white dark:text-black transition-all flex items-center justify-between pr-1.5 disabled:opacity-50 shadow-sm`}
                  >
                    {/* Center text */}
                    <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase text-center flex-1 whitespace-nowrap">
                      {loading ? "PROCESSING..." : paymentMethod === "COD" ? `PAY ₹${codFee} & PLACE COD ORDER` : `PAY ₹${total.toLocaleString("en-IN")} SECURELY`}
                    </span>

                    {/* Right chevron circle */}
                    <div className={`${paymentMethod === "COD" ? "w-11 h-11" : "w-9 h-9"
                      } rounded-full bg-white/10 dark:bg-black/10 flex items-center justify-center text-white dark:text-black shrink-0 transition-all`}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                      )}
                    </div>
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-4 text-foreground/20">
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
