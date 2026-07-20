"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useMetaEvents } from "@/hooks/useMetaEvents";
import { trackStorefrontEvent } from "@/lib/track-client";
import { trackBeginCheckout as zbTrackBeginCheckout, trackPaymentInitiated as zbTrackPaymentInitiated } from "@/lib/analytics-tracker";
import { saveUserDataToCookiesAndReinit, getClientCookie } from "@/lib/metaPixel";
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
  Banknote,
  Smartphone,
  Sparkles,
  Lock,
  Sun,
  User,
  Mail,
  Globe,
  Map,
  Folder,
  Wallet
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

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
  lat?: number;
  lng?: number;
  placeId?: string;
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
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
};

type PaymentMethod = "UPI" | "CARD" | "COD" | "PAYLATER" | "EMI";

interface GoogleAddressComponent {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types: string[];
}

const parseAddressComponents = (components: GoogleAddressComponent[]) => {
  let city = "";
  let district = "";
  let state = "";
  let pincode = "";
  
  let streetNumber = "";
  let premise = "";
  let subpremise = "";
  let route = "";
  let sublocality3 = "";
  let sublocality2 = "";
  let sublocality1 = "";
  let sublocality = "";
  let neighborhood = "";

  components.forEach(comp => {
    const name = comp.long_name || comp.longText || comp.short_name || comp.shortText || "";
    const types = comp.types || [];

    if (types.includes("postal_code")) {
      pincode = name;
    } else if (types.includes("administrative_area_level_1")) {
      state = name;
    } else if (types.includes("locality")) {
      city = name;
    } else if (types.includes("administrative_area_level_2")) {
      district = name;
    } else if (types.includes("sublocality_level_3")) {
      sublocality3 = name;
    } else if (types.includes("sublocality_level_2")) {
      sublocality2 = name;
    } else if (types.includes("sublocality_level_1")) {
      sublocality1 = name;
    } else if (types.includes("sublocality")) {
      sublocality = name;
    } else if (types.includes("neighborhood")) {
      neighborhood = name;
    } else if (types.includes("route")) {
      route = name;
    } else if (types.includes("street_number")) {
      streetNumber = name;
    } else if (types.includes("premise")) {
      premise = name;
    } else if (types.includes("subpremise")) {
      subpremise = name;
    }
  });

  // In India, locality is typically the city (e.g. Noida, New Delhi). 
  // Fall back to administrative_area_level_2 (district) or sublocalities if not present.
  const finalCity = city || district || sublocality1 || sublocality || "";

  const streetParts = [
    subpremise,
    premise,
    streetNumber,
    route,
    sublocality3,
    sublocality2,
    sublocality1,
    sublocality,
    neighborhood
  ].filter(Boolean);
  
  // Remove duplicates while preserving original order
  const uniqueStreetParts = streetParts.filter((item, index) => streetParts.indexOf(item) === index);
  const streetName = uniqueStreetParts.join(", ");

  let matchedState = "";
  if (state) {
    const lowerState = state.toLowerCase().trim();
    const found = INDIAN_STATES.find(s =>
      s.toLowerCase() === lowerState ||
      lowerState.includes(s.toLowerCase()) ||
      s.toLowerCase().includes(lowerState)
    );
    if (found) matchedState = found;
  }

  return {
    city: finalCity,
    state: matchedState || state,
    pincode: pincode.replace(/\s/g, "").slice(0, 6),
    streetName
  };
};

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

  const initialName = session?.user?.name || "";
  const isPhoneName = /^\+?[0-9\s\-]{8,15}$/.test(initialName.trim());
  const [address, setAddress] = useState<Address>({
    name: isPhoneName ? "" : initialName,
    email: session?.user?.email || "",
    phone: (session as any)?.customer?.phone || "",
    houseNo: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
    lat: undefined,
    lng: undefined,
    placeId: undefined,
  });

  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState(false);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  const [step, setStep] = useState(1); // 1: Address, 2: Payment
  const [loading, setLoading] = useState(false);

  // Sync cart contact details (email, phone, name) in background as user fills checkout form
  useEffect(() => {
    if ((address.email || address.phone) && items.length > 0) {
      const syncCheckoutDetails = async () => {
        try {
          const guestId = getClientCookie("zb_device_id");
          const { getTrafficSource } = await import("@/lib/traffic-source");
          const trafficSource = getTrafficSource();

          await fetch("/api/cart/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items,
              guestId,
              name: address.name || undefined,
              email: address.email || undefined,
              phone: address.phone || undefined,
              source: trafficSource
            }),
          });
        } catch (e) {
          console.error("Failed to sync checkout details to cart session:", e);
        }
      };

      const timer = setTimeout(syncCheckoutDetails, 1000);
      return () => clearTimeout(timer);
    }
  }, [address.email, address.phone, address.name, items]);
  const [error, setError] = useState("");

  // Clear error automatically after 4 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  const [initiatedPixel, setInitiatedPixel] = useState(false);
  const [paymentInfoFired, setPaymentInfoFired] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<DBAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [prefetchedOrder, setPrefetchedOrder] = useState<{
    id: string;
    amount: number;
    keyId: string;
  } | null>(null);

  const paymentLockRef = useRef<boolean>(false);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);



  useEffect(() => {
    const canFire = status === "unauthenticated" || (status === "authenticated" && addressesLoaded);

    if (items.length > 0 && !initiatedPixel && canFire) {
      setInitiatedPixel(true);
      const joinedCategories = items.map(item => item.category).filter(Boolean).join(', ') || undefined;
      const contentIds = items.map(item => item.productId);
      const contents = items.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: parseFloat(item.price),
        title: item.title,
        category: item.category
      }));

      // Parse the pre-filled/saved address state into userData
      let userData: any = undefined;
      if (address.email || address.phone || address.city) {
        const nameParts = (address.name || "").trim().split(/\s+/);
        const fn = nameParts[0] || undefined;
        const ln = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
        userData = {
          country: address.country || undefined,
          st: address.state || undefined,
          ct: address.city || undefined,
          zp: address.zip || undefined,
          fn,
          ln,
          em: address.email || undefined,
          ph: address.phone || undefined,
        };
      }

      trackInitiateCheckout(subtotal, items.length, 'INR', joinedCategories, contentIds, userData, contents);
      zbTrackBeginCheckout(subtotal, { num_items: items.length, currency: 'INR' });

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
  }, [items, subtotal, initiatedPixel, session, address, status, addressesLoaded]);


  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [zipLoading, setZipLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    if (googleMapsLoaded || googleMapsError) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key not found in env variables.");
      setGoogleMapsError(true);
      return;
    }

    try {
      setOptions({
        key: apiKey,
        v: "weekly"
      });

      importLibrary("places")
        .then(() => {
          setGoogleMapsLoaded(true);
        })
        .catch((err) => {
          console.error("Failed to load Google Maps script:", err);
          setGoogleMapsError(true);
        });
    } catch (err) {
      console.error("Error configuring Google Maps loader:", err);
      setGoogleMapsError(true);
    }
  }, [googleMapsLoaded, googleMapsError]);

  // Initialize Place Autocomplete
  useEffect(() => {
    if (!googleMapsLoaded || !autocompleteInputRef.current) return;

    let active = true;

    const initAutocomplete = async () => {
      try {
        const { Autocomplete } = await importLibrary("places") as any;
        if (!active) return;
        if (!Autocomplete) {
          throw new Error("Autocomplete constructor not found in places library.");
        }

        const autocomplete = new Autocomplete(autocompleteInputRef.current, {
          componentRestrictions: { country: "IN" },
          fields: ["address_components", "geometry", "place_id", "formatted_address", "name"],
          types: ["geocode", "establishment"]
        });

        autocompleteRef.current = autocomplete;

        autocomplete.addListener("place_changed", () => {
          if (!active) return;
          const place = autocomplete.getPlace();
          if (!place || !place.address_components) return;

          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          const placeId = place.place_id;
          const components = place.address_components;

          const parsed = parseAddressComponents(components);

          let streetVal = parsed.streetName || address.street;
          if (!parsed.streetName && place.name) {
            const nameLower = place.name.toLowerCase();
            const cityLower = (parsed.city || "").toLowerCase();
            const stateLower = (parsed.state || "").toLowerCase();
            if (nameLower !== cityLower && nameLower !== stateLower && nameLower !== "india") {
              streetVal = place.name;
            }
          }

          setAddress(prev => ({
            ...prev,
            street: streetVal,
            city: parsed.city || prev.city,
            state: parsed.state || prev.state,
            zip: parsed.pincode || prev.zip,
            lat: lat != null ? lat : prev.lat,
            lng: lng != null ? lng : prev.lng,
            placeId: placeId || prev.placeId,
          }));

          setAddressErrors(prev => {
            const next = { ...prev };
            delete next.street;
            delete next.city;
            delete next.state;
            delete next.zip;
            return next;
          });
        });
      } catch (err) {
        console.error("Error initializing Google Autocomplete:", err);
        setGoogleMapsError(true);
      }
    };

    initAutocomplete();

    return () => {
      active = false;
      if (autocompleteRef.current) {
        try {
          const googleObj = (window as any).google;
          if (googleObj && googleObj.maps && googleObj.maps.event) {
            googleObj.maps.event.clearInstanceListeners(autocompleteRef.current);
          }
        } catch (e) {
          console.error("Failed to clean up Google Autocomplete listeners:", e);
        }
      }
    };
  }, [googleMapsLoaded, showAddressForm]);

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          if (googleMapsLoaded) {
            const googleObj = (window as any).google;
            if (!googleObj || !googleObj.maps) {
              throw new Error("Google Maps API not loaded");
            }
            const geocoder = new googleObj.maps.Geocoder();
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
              if (status === "OK" && results && results[0]) {
                const result = results[0];
                const parsed = parseAddressComponents(result.address_components || []);

                if (autocompleteInputRef.current) {
                  autocompleteInputRef.current.value = result.formatted_address || "";
                }

                let streetVal = parsed.streetName || address.street;
                if (!parsed.streetName && result.formatted_address) {
                  const parts = result.formatted_address.split(",");
                  if (parts.length > 0) {
                    streetVal = parts[0].trim();
                  }
                }

                setAddress(prev => ({
                  ...prev,
                  street: streetVal,
                  city: parsed.city || prev.city,
                  state: parsed.state || prev.state,
                  zip: parsed.pincode || prev.zip,
                  lat: latitude,
                  lng: longitude,
                  placeId: result.place_id || prev.placeId,
                }));

                setAddressErrors(prev => {
                  const next = { ...prev };
                  delete next.street;
                  delete next.city;
                  delete next.state;
                  delete next.zip;
                  return next;
                });
                setLocating(false);
              } else {
                console.error("Geocoder failed with status:", status);
                // Fallback to manual
                setError("Unable to resolve address. Please fill manually.");
                setLocating(false);
              }
            });
          } else {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  "Accept-Language": "en",
                  "User-Agent": "ZicaBellaStorefront/1.0"
                },
              }
            );
            if (!response.ok) throw new Error("Failed to resolve address details");
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;

              const roadName = addr.road || addr.suburb || addr.neighbourhood || addr.village || "";
              const postcode = addr.postcode || "";
              const cityName = addr.city || addr.town || addr.village || addr.county || "";
              const stateName = addr.state || "";
              const houseNumber = addr.house_number || addr.building || "";

              let matchedState = "";
              if (stateName) {
                const lowerState = stateName.toLowerCase().trim();
                const found = INDIAN_STATES.find(s =>
                  s.toLowerCase() === lowerState ||
                  lowerState.includes(s.toLowerCase()) ||
                  s.toLowerCase().includes(lowerState)
                );
                if (found) matchedState = found;
              }

              setAddress(prev => ({
                ...prev,
                houseNo: houseNumber || prev.houseNo,
                street: roadName || prev.street,
                zip: postcode ? postcode.replace(/\s/g, "").slice(0, 6) : prev.zip,
                city: cityName || prev.city,
                state: matchedState || prev.state || stateName,
                lat: latitude,
                lng: longitude,
              }));
            }
            setLocating(false);
          }
        } catch (err: any) {
          console.error("Error reverse geocoding:", err);
          setError("Unable to retrieve address details. Please fill manually.");
          setLocating(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Please allow location access in your browser's address settings (click the lock icon in the address bar), then try again.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Please check your signal and try again.");
        } else {
          setError("Unable to detect location. Please fill manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

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

  // Store Credit Wallet state
  const [availableStoreCredit, setAvailableStoreCredit] = useState(0);
  const [useStoreCredit, setUseStoreCredit] = useState(false);

  // Calculate totals including Store Credit deduction
  const totalBeforeStoreCredit = subtotal - (applyAsStoreCredit ? 0 : couponDiscount) + shipping;
  const appliedStoreCredit = useStoreCredit ? Math.min(availableStoreCredit, totalBeforeStoreCredit) : 0;
  const finalTotal = Math.max(0, totalBeforeStoreCredit - appliedStoreCredit);
  const total = finalTotal;

  // Fetch available store credit balance when customer email/phone or session changes
  useEffect(() => {
    const fetchStoreCredits = async () => {
      try {
        const email = address.email || (session?.user as any)?.email;
        const phone = address.phone;
        if (!email && !phone) return;

        const params = new URLSearchParams();
        if (email) params.set('email', email);
        if (phone) params.set('phone', phone);

        const res = await fetch(`/api/user/store-credits?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.balance > 0) {
            setAvailableStoreCredit(data.balance);
          } else {
            setAvailableStoreCredit(0);
          }
        }
      } catch (err) {
        console.error('[Checkout] Error fetching store credits:', err);
      }
    };

    fetchStoreCredits();
  }, [address.email, address.phone, session]);

  // Background prefetch of the Razorpay order when entering Step 2 or changing payment configurations
  useEffect(() => {
    if (step === 2 && items.length > 0 && address.name && address.phone && finalTotal > 0) {
      const prefetchRazorpayOrder = async () => {
        try {
          const fullStreet = [address.houseNo, address.street, address.landmark].filter(Boolean).join(", ");
          const checkoutAddress = { ...address, street: fullStreet || address.street };
          const paymentAmount = paymentMethod === "COD" ? codFee : finalTotal;
          const res = await fetch("/api/checkout/razorpay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: paymentAmount,
              currency: "INR",
              address: checkoutAddress,
              items,
              subtotal,
              total: finalTotal,
              paymentMethod,
              codFee: paymentMethod === "COD" ? codFee : 0,
              couponCode: couponValid ? couponCode : null,
              couponDiscount: couponDiscount,
              storeCreditAmount: appliedStoreCredit,
              notes: {
                name: address.name,
                email: address.email || "",
                contact: address.phone,
              }
            }),
          });
          const orderData = await res.json();
          if (res.ok) {
            setPrefetchedOrder({
              id: orderData.id || orderData.razorpay_order_id,
              amount: orderData.amount,
              keyId: orderData.keyId || orderData.key_id,
            });
          }
        } catch (e) {
          console.error("Failed to prefetch Razorpay order:", e);
        }
      };

      prefetchRazorpayOrder();
    }
  }, [step, paymentMethod, total, codFee, address.name, address.email, address.phone, items.length]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/checkout`);
    } else if (items.length === 0 && !isOrderPlaced) {
      router.push("/cart");
    }
  }, [items, isOrderPlaced, router, status]);

  // Auto-fill address details from session once authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const initialName = session?.user?.name || "";
      const isPhoneName = /^\+?[0-9\s\-]{8,15}$/.test(initialName.trim());
      const cleanName = isPhoneName ? "" : initialName;
      setAddress(prev => ({
        ...prev,
        name: prev.name || cleanName,
        email: prev.email || session?.user?.email || "",
        phone: prev.phone || (session as any)?.customer?.phone || (session?.user as any)?.phone || "",
      }));
    }
  }, [session, status]);

  // Fetch saved addresses callback
  const fetchSavedAddresses = useCallback(async (selectDefault = false) => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setAddressesLoaded(true);
      return;
    }
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
            lat: def.lat || undefined,
            lng: def.lng || undefined,
            placeId: def.placeId || undefined,
          });
          setShowAddressForm(false);
        }
      } else {
        setShowAddressForm(true);
      }
    } catch (err) {
      console.error("Error loading addresses:", err);
      setShowAddressForm(true);
    } finally {
      setAddressesLoaded(true);
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
      lat: addr.lat || undefined,
      lng: addr.lng || undefined,
      placeId: addr.placeId || undefined,
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
          lat: updatedAddress.lat,
          lng: updatedAddress.lng,
          placeId: updatedAddress.placeId,
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
      zbTrackPaymentInitiated(subtotal, { payment_method: paymentMethod, currency: 'INR' });
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

    if (coupon.applicability === "CUSTOM_RATES") {
      if (!isCOD) {
        currentDiscountType = coupon.prepaidDiscountType;
        currentDiscountValue = Number(coupon.prepaidDiscountValue);
      } else {
        currentDiscountType = coupon.codDiscountType;
        currentDiscountValue = Number(coupon.codDiscountValue);
      }
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
    // Synchronous double-submit lock check
    if (paymentLockRef.current) {
      console.warn("[Razorpay] Blocked rapid double-tap trigger.");
      return;
    }
    paymentLockRef.current = true;

    setLoading(true);
    setError("");

    try {
      // Ensure Razorpay SDK is loaded
      if (!(window as any).Razorpay) {
        setError("Payment gateway is loading. Please try again in a moment.");
        setLoading(false);
        paymentLockRef.current = false;
        return;
      }

      // Combine address fields into a single street for storage
      const fullStreet = [address.houseNo, address.street, address.landmark].filter(Boolean).join(", ");
      const checkoutAddress = { ...address, street: fullStreet };

      // Case 1: 100% Store Credit Payment (finalTotal === 0)
      if (finalTotal === 0 && appliedStoreCredit > 0) {
        console.log("[Checkout] Completing order with 100% Store Credit");
        const completeRes = await fetch("/api/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: checkoutAddress,
            paymentMethod: "store_credit",
            items,
            total: 0,
            subtotal,
            codFee: 0,
            couponCode: couponValid ? couponCode : null,
            couponDiscount: couponDiscount,
            storeCreditAmount: appliedStoreCredit,
            guestId: getClientCookie("zb_device_id"),
          }),
        });

        const completeData = await completeRes.json();
        if (completeRes.ok) {
          setIsOrderPlaced(true);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("last_placed_order_id", completeData.orderId);
            const joinedCategories = items.map(item => item.category).filter(Boolean).join(', ');
            sessionStorage.setItem(`order_categories_${completeData.orderId}`, joinedCategories);
          }
          clear();
          router.push(`/orders/${completeData.orderId}/confirmation`);
          return;
        } else {
          throw new Error(completeData.error || "Failed to complete order with store credit.");
        }
      }

      // Case 2: Partial Store Credit or Standard Payment
      const paymentAmount = paymentMethod === "COD" ? codFee : finalTotal;

      let orderId = "";
      let keyId = "";
      let orderData: any = null;

      if (prefetchedOrder && Math.round(prefetchedOrder.amount / 100) === Math.round(paymentAmount)) {
        orderId = prefetchedOrder.id;
        keyId = prefetchedOrder.keyId;
        orderData = prefetchedOrder;
        console.log("[Razorpay] Using pre-fetched order:", orderId);
      } else {
        console.log("[Razorpay] Pre-fetched order missing or mismatch, fetching fresh...");
        const res = await fetch("/api/checkout/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: paymentAmount,
            currency: "INR",
            address: checkoutAddress,
            items,
            subtotal,
            total: finalTotal,
            paymentMethod,
            codFee: paymentMethod === "COD" ? codFee : 0,
            couponCode: couponValid ? couponCode : null,
            couponDiscount: couponDiscount,
            storeCreditAmount: appliedStoreCredit,
            notes: {
              name: address.name,
              email: address.email || "",
              contact: address.phone,
            }
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to initiate payment");
        orderId = data.id || data.razorpay_order_id;
        keyId = data.keyId || data.key_id;
        orderData = data;
      }

      // Track Payment Initiated event
      trackStorefrontEvent('Payment Initiated', {
        customerId: (session?.user as any)?.id || null,
        customerPhone: address.phone || null,
        orderId: orderId,
        metadata: {
          amount: paymentAmount,
          currency: 'INR',
          paymentMethod,
          num_items: items.length
        }
      });

      // ═══════════════════════════════════════════════════════════
      // Shared success handler — called by Razorpay Standard Checkout
      // ═══════════════════════════════════════════════════════════
      const handlePaymentSuccess = async (response: any) => {
        try {
          const verifyRes = await fetch("/api/checkout/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: checkoutAddress,
              paymentMethod,
              items,
              total: finalTotal,
              subtotal,
              codFee: paymentMethod === "COD" ? codFee : 0,
              razorpay: response,
              couponCode: couponValid ? couponCode : null,
              couponDiscount: couponDiscount,
              applyAsStoreCredit,
              cashbackAmount,
              storeCreditAmount: appliedStoreCredit,
              guestId: getClientCookie("zb_device_id"),
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
            // CRITICAL: Payment was captured successfully, but database registration failed.
            // Do not allow retry to prevent double-charging the customer.
            setError(`Your payment of ₹${paymentAmount} was successful (ID: ${response.razorpay_payment_id || "N/A"}), but we encountered an issue registering your order. Please do NOT try paying again. Contact support at support@zicabella.com with your payment ID so we can verify and manually create your order.`);
            setLoading(false);
          }
        } catch {
          setError(`Your payment of ₹${paymentAmount} was successful (ID: ${response.razorpay_payment_id || "N/A"}), but we encountered a connection issue confirming your order. Please do NOT try paying again. Contact support at support@zicabella.com with your payment ID so we can confirm your order manually.`);
          setLoading(false);
        } finally {
          paymentLockRef.current = false;
        }
      };

      // ═══════════════════════════════════════════════════════════
      // Shared error handler for payment.failed event
      // ═══════════════════════════════════════════════════════════
      const handlePaymentError = (error: any) => {
        paymentLockRef.current = false;

        const errorDesc = error?.error?.description || error?.description || "Payment failed. Please try again.";
        const errorCode = error?.error?.code || error?.code || "";
        const errorReason = error?.error?.reason || "";
        console.error('[Razorpay] Payment error:', error?.error || error);

        // Map specific error reasons to friendly messages
        let friendlyMessage = errorDesc;
        if (errorReason === "payment_cancelled") {
          friendlyMessage = "Payment was cancelled. You can try again.";
        } else if (errorReason === "intent_no_apps_error") {
          friendlyMessage = "No UPI app found on this device. Please try entering your UPI ID in the payment window.";
        }

        setError(`${friendlyMessage}${errorCode ? ` (${errorCode})` : ''}`);
        setLoading(false);
      };

      // ═══════════════════════════════════════════════════════════
      // Razorpay Standard Checkout — used for ALL payment methods
      // The Standard Checkout modal handles UPI Intent (auto-detects
      // installed apps on mobile), UPI Collect (VPA entry), QR code
      // (desktop), Cards, Pay Later, EMI — all within its own UI.
      // ═══════════════════════════════════════════════════════════
      const options: any = {
        key: keyId,
        amount: orderData.amount,
        currency: "INR",
        name: "Zica Bella",
        description: paymentMethod === "COD" ? "COD Upfront Fee" : "Order Payment",
        order_id: orderId,
        handler: handlePaymentSuccess,
        prefill: {
          name: address.name,
          email: address.email,
          contact: address.phone,
        },
        theme: {
          color: "#000000",
          backdrop_color: "rgba(0,0,0,0.85)",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            paymentLockRef.current = false;
          },
          confirm_close: true,
        },
      };

      // Configure display blocks to show only the selected method in the Razorpay modal
      if (paymentMethod === "UPI" || paymentMethod === "COD") {
        // UPI: Standard Checkout auto-detects installed UPI apps on mobile,
        // shows QR code on desktop, and supports VPA entry — all handled natively
        options.prefill.method = "upi";
        options.config = {
          display: {
            blocks: {
              upi: {
                name: "Pay using UPI",
                instruments: [
                  { method: "upi", flows: ["intent", "collect", "qr"] }
                ]
              }
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false }
          }
        };
      } else if (paymentMethod === "CARD") {
        options.prefill.method = "card";
        options.config = {
          display: {
            blocks: { card: { name: "Pay via Card", instruments: [{ method: "card" }] } },
            sequence: ["block.card"],
            preferences: { show_default_blocks: false }
          }
        };
      } else if (paymentMethod === "PAYLATER") {
        options.prefill.method = "paylater";
        options.config = {
          display: {
            blocks: { paylater: { name: "Pay Later", instruments: [{ method: "paylater" }] } },
            sequence: ["block.paylater"],
            preferences: { show_default_blocks: false }
          }
        };
      } else if (paymentMethod === "EMI") {
        options.prefill.method = "emi";
        options.config = {
          display: {
            blocks: { emi: { name: "EMI Options", instruments: [{ method: "emi" }] } },
            sequence: ["block.emi"],
            preferences: { show_default_blocks: false }
          }
        };
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        handlePaymentError(response);
      });
      rzp.open();

    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
      paymentLockRef.current = false;
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

  const renderPaymentSelector = (isMobileOnly = false) => {
    return (
      <div className={isMobileOnly ? "md:hidden flex flex-col w-full" : "hidden md:flex flex-col w-full"}>
        {/* Payment selection segment tabs */}
        <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-foreground/[0.03] border border-foreground/5 mb-4">
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

        {/* UPI/COD info — Razorpay Standard Checkout handles UPI app selection natively */}
        {(paymentMethod === "UPI" || paymentMethod === "COD") && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 mb-4 w-full">
            {paymentMethod === "COD" && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/[0.02] border border-foreground/5">
                <Banknote className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                <p className="text-[9px] font-light text-foreground/60 leading-relaxed">
                  Pay ₹{codFee} upfront via UPI (deducted from total). Remaining ₹{(total - codFee).toLocaleString("en-IN")} due at delivery.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/[0.02] border border-foreground/5">
              <CreditCard className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
              <p className="text-[9px] font-light text-foreground/60 leading-relaxed">
                {paymentMethod === "COD"
                  ? "You\u2019ll be redirected to a secure payment window to complete the upfront fee via UPI."
                  : "You\u2019ll be redirected to a secure payment window where you can pay using any UPI app, UPI ID, or scan a QR code."}
              </p>
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderOrderSummary = () => {
    return (
      <div className="flex flex-col gap-3.5 w-full">
        {/* Product Preview Card */}
        <div className="apple-glass-capsule p-4.5 rounded-[24px] flex flex-col gap-3.5">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              <div className="w-10 h-13 rounded-lg bg-foreground/[0.02] border border-foreground/10 overflow-hidden shrink-0 relative">
                {item.image ? (
                  <img src={item.image} className="w-full h-full object-cover animate-in fade-in duration-300" alt={item.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground/20 text-[8px] font-light">ZB</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-normal text-foreground/85 uppercase tracking-wide truncate leading-tight">{item.title}</h4>
                <p className="text-[8px] text-foreground/40 font-light uppercase tracking-wider mt-1 leading-none">
                  Size: {item.size || "Free"} &nbsp;•&nbsp; Qty: {item.quantity}
                </p>
              </div>
              <span className="text-[10px] font-normal text-foreground/80 shrink-0">₹{(parseFloat(item.price) * item.quantity).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>

        {/* Store Credit Wallet Card */}
        {availableStoreCredit > 0 && (
          <div className="apple-glass-capsule p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all duration-300 border-emerald-500/20 bg-emerald-500/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-foreground tracking-wide leading-none">
                    Store Credit Wallet
                  </h4>
                  <p className="text-[8.5px] text-emerald-400 font-light mt-0.5">
                    Available: ₹{availableStoreCredit.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useStoreCredit}
                  onChange={(e) => setUseStoreCredit(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-foreground/15 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            {useStoreCredit && appliedStoreCredit > 0 && (
              <div className="text-[8.5px] font-light text-emerald-400/90 flex justify-between items-center pt-1 border-t border-emerald-500/10">
                <span>Store Credit Discount</span>
                <span className="font-semibold">- ₹{appliedStoreCredit.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        )}

        {/* Calculations Summary */}
        <div className="apple-glass-capsule p-4 rounded-2xl flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
            <span className="text-foreground/40">Subtotal</span>
            <span className="text-foreground/75">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>

          {couponDiscount > 0 && !applyAsStoreCredit && (
            <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
              <span className="text-emerald-400/90">Discount ({couponCode})</span>
              <span className="text-emerald-400/90">- ₹{couponDiscount.toLocaleString("en-IN")}</span>
            </div>
          )}

          {appliedStoreCredit > 0 && (
            <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
              <span className="text-emerald-400/90">Store Credit Applied</span>
              <span className="text-emerald-400/90">- ₹{appliedStoreCredit.toLocaleString("en-IN")}</span>
            </div>
          )}

          {cashbackAmount > 0 && (
            <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
              <span className="text-emerald-400/90">Cashback ({couponCode})</span>
              <span className="text-emerald-400/90">+ ₹{cashbackAmount.toLocaleString("en-IN")}</span>
            </div>
          )}

          {paymentMethod === "COD" && (
            <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
              <span className="text-foreground/45">COD Upfront (included)</span>
              <span className="text-foreground/60">₹{codFee}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
            <span className="text-foreground/40">Shipping</span>
            <span className="text-foreground/75">FREE</span>
          </div>

          <div className="h-[1px] bg-foreground/5 my-0.5" />

          {paymentMethod === "COD" ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
                <span className="text-foreground/40">Order Total</span>
                <span className="text-foreground/75">₹{finalTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-light uppercase tracking-wider">
                <span className="text-foreground/40">Due at Delivery</span>
                <span className="text-foreground/75">₹{Math.max(0, finalTotal - codFee).toLocaleString("en-IN")}</span>
              </div>
              <div className="h-[1px] bg-foreground/5 my-0.5" />
              <div className="flex justify-between items-center">
                <span className="font-light text-[9px] text-foreground/45 uppercase tracking-widest">Pay Now (Upfront)</span>
                <span className="text-base font-medium text-foreground tracking-tight leading-none">₹{codFee}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="font-light text-[9px] text-foreground/45 uppercase tracking-widest">Total</span>
              <span className="text-base font-medium text-foreground tracking-tight leading-none">₹{finalTotal.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Payment Selector (Only if Step 2) */}
        {step === 2 && renderPaymentSelector(true)}

        {/* Apply Discount Banner */}
        <div className="apple-glass-capsule p-3 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-foreground/40" />
            <span className="text-[10px] font-light text-foreground/75">Apply Discount</span>
          </div>

          {couponValid ? (
            <div className="flex items-center gap-2 py-1 px-2.5 rounded-full bg-foreground/[0.08] border border-foreground/10 animate-in scale-in duration-300">
              <span className="text-[9px] font-medium text-foreground uppercase tracking-wider">{couponCode}</span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="w-3.5 h-3.5 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground/20 text-foreground/60 hover:text-foreground"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center flex-1 max-w-[180px]">
              <input
                type="text"
                placeholder="Enter code"
                aria-label="Discount Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="w-full h-8 px-2.5 rounded-lg bg-foreground/[0.02] border border-foreground/5 text-foreground text-[9px] font-mono tracking-wider placeholder:text-foreground/20 uppercase focus:border-foreground/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                disabled={couponLoading || !couponCode.trim()}
                className="h-8 px-2.5 rounded-lg bg-foreground/[0.03] dark:bg-white/[0.05] border border-foreground/10 dark:border-white/10 text-foreground font-light text-[9px] uppercase tracking-[0.12em] hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08] backdrop-blur-md active:scale-[0.98] disabled:opacity-30 transition-all flex items-center justify-center shrink-0 whitespace-nowrap"
              >
                {couponLoading ? <Loader2 className="w-3 animate-spin" /> : "Apply"}
              </button>
            </div>
          )}
        </div>

        {/* Available Offers */}
        {!couponValid && activeCoupons.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 pl-1 mb-0.5 leading-none">
              <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
              <span className="text-[7.5px] font-light text-foreground/40 uppercase tracking-widest">Available Offers</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
              {activeCoupons.map((coupon) => {
                const isCOD = paymentMethod === "COD";
                let benefitText = "";
                let val = 0;
                let type = "";

                if (coupon.applicability === "CUSTOM_RATES") {
                  if (!isCOD) {
                    val = Number(coupon.prepaidDiscountValue);
                    type = coupon.prepaidDiscountType;
                  } else {
                    val = Number(coupon.codDiscountValue);
                    type = coupon.codDiscountType;
                  }
                } else {
                  val = Number(coupon.discountValue);
                  type = coupon.discountType;
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
                    className={`snap-start shrink-0 p-2.5 rounded-xl border text-left w-[150px] flex flex-col gap-1 transition-all duration-300 ${!isEligible || !isMethodApplicable
                      ? "bg-foreground/[0.002] border-foreground/5 opacity-30 cursor-not-allowed"
                      : "bg-foreground/[0.015] border-foreground/5 hover:border-foreground/10 hover:bg-foreground/[0.02]"
                      }`}
                  >
                    <span className="font-mono text-[8px] font-light text-foreground bg-foreground/10 px-1 py-0.5 rounded uppercase tracking-wider self-start leading-none">
                      {coupon.code}
                    </span>
                    <p className="text-[9px] font-light text-foreground/80 leading-tight mt-0.5">
                      {benefitText} {coupon.applyAsStoreCredit ? "credited as cashback" : "instantly at checkout"}
                    </p>
                    <p className="text-[7px] text-foreground/35 font-light">
                      {Number(coupon.minOrderValue) > 0 ? `On orders above ₹${Number(coupon.minOrderValue).toLocaleString("en-IN")}` : "No minimum limit"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Buttons based on Step */}
        <div className="mt-2">
          {step === 1 ? (
            showAddressForm ? (
              <button
                type="submit"
                form="address-form"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98] border border-black/10 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="text-[10px] font-bold tracking-[0.16em] uppercase">Continue to Payment</span>
                    <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading || !selectedSavedId}
                className="w-full h-11 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98] border border-black/10 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase">Deliver to this Address</span>
                <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={loading}
              className={`w-full ${paymentMethod === "COD" ? "h-13 pl-13" : "h-11 pl-11"
                } rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-95 active:scale-[0.98] border border-black/10 dark:border-white/10 transition-all flex items-center justify-between pr-1.5 disabled:opacity-50 shadow-sm`}
            >
              <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase text-center flex-1 whitespace-nowrap">
                {loading
                  ? "PROCESSING..."
                  : finalTotal === 0
                  ? `PAY ₹0 WITH STORE CREDIT`
                  : paymentMethod === "COD"
                  ? `PAY ₹${codFee} & PLACE COD ORDER`
                  : `PAY ₹${finalTotal.toLocaleString("en-IN")} SECURELY`}
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/10 dark:bg-black/10 flex items-center justify-center text-white dark:text-black shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" strokeWidth={2.5} />}
              </div>
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-3 text-foreground/20">
            <Lock className="w-2.5 h-2.5" />
            <span className="text-[7.5px] font-bold uppercase tracking-[0.25em] leading-none">256-bit SSL secured transaction</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] relative bg-background text-foreground font-sans">
      <div className="relative z-10 max-w-xl md:max-w-5xl mx-auto px-4 pt-16 pb-8 md:pt-24 md:pb-12 flex flex-col" style={{ minHeight: '100dvh' }}>

        {/* Page Title & H1 */}
        <div className="mb-4 md:mb-6">
          <p className="text-[8px] font-extrabold uppercase tracking-[0.4em] text-foreground/40 mb-0.5 pl-0.5">YOUR PURCHASE</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-[32px] font-black tracking-tight text-foreground leading-none">Checkout</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start flex-1 w-full">
          {/* Left Column: Flow Steps */}
          <div className="col-span-12 md:col-span-7 flex flex-col w-full">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] backdrop-blur-md text-red-400 text-[10px] font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400 mt-0.5" />
                    <p className="leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col animate-in fade-in duration-300 w-full"
                >
                  <div className="flex flex-col gap-0.5 mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-foreground/80" strokeWidth={2.25} />
                      <h2 className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.12em] text-foreground/90">
                        SHIPPING DETAILS
                      </h2>
                    </div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-foreground/40 pl-5">
                      WHERE SHOULD WE DELIVER?
                    </p>
                  </div>

                  {/* Saved Addresses list */}
                  {savedAddresses.length > 0 && !showAddressForm && (
                    <div className="mb-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 pl-0.5">Saved Addresses</p>
                      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedSavedId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => handleSelectSavedAddress(addr)}
                              className={`snap-start shrink-0 w-[185px] text-left p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-md ${isSelected
                                ? "border-black/50 dark:border-white/40 bg-black/[0.04] dark:bg-white/[0.05] shadow-[0_0_15px_rgba(255,255,255,0.04)] scale-[1.02]"
                                : "border-black/[0.06] dark:border-white/[0.06] bg-white/30 dark:bg-black/20 hover:border-black/20 dark:hover:border-white/20"
                                }`}
                            >
                              {/* Glare effect inside selected card */}
                              {isSelected && (
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08] pointer-events-none" />
                              )}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold truncate pr-1 text-foreground/90 flex items-center gap-1.5">
                                  {isSelected && <CheckCircle2 className="w-3 h-3 text-foreground/80 shrink-0" />}
                                  {addr.name}
                                </span>
                                {addr.isDefault && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[5.5px] font-black uppercase tracking-wider bg-foreground text-background">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-[8.5px] text-foreground/50 truncate leading-relaxed">
                                {addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}
                              </p>
                              <p className="text-[8.5px] text-foreground/50 font-semibold leading-relaxed">
                                {addr.city}, {addr.state}
                              </p>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSavedId("");
                            setAddress({
                              name: session?.user?.name || "",
                              email: session?.user?.email || "",
                              phone: (session as any)?.customer?.phone || (session?.user as any)?.phone || "",
                              houseNo: "", street: "",
                              landmark: "", city: "", state: "", zip: "", country: "India",
                            });
                            setAddressErrors({});
                            setShowAddressForm(true);
                          }}
                          className="snap-start shrink-0 p-3.5 rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.12] bg-white/20 dark:bg-black/10 flex flex-col items-center justify-center gap-1.5 w-[100px] text-center transition-all duration-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:border-black/30 dark:hover:border-white/30"
                        >
                          <Plus className="w-3.5 h-3.5 text-foreground/50" />
                          <span className="text-[7.5px] font-bold uppercase tracking-[0.1em] text-foreground/55">New</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Selected Address Display Card when form is hidden */}
                  {!showAddressForm && selectedSavedId && (
                    <div className="apple-glass-capsule p-5 rounded-2xl flex flex-col gap-4 mb-4 animate-in fade-in duration-300">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/45">Deliver to</p>
                          <span className="flex items-center gap-1 text-[8px] font-bold text-foreground/50 uppercase tracking-widest bg-foreground/[0.04] px-2 py-0.5 rounded-md border border-foreground/5">
                            <ShieldCheck className="w-3 h-3 text-foreground/40" /> Verified
                          </span>
                        </div>
                        <p className="text-sm font-extrabold tracking-tight">{address.name}</p>
                        <p className="text-[11px] text-foreground/60 leading-relaxed font-medium">
                          {address.houseNo}, {address.street}
                          {address.landmark ? `, ${address.landmark}` : ""}
                        </p>
                        <p className="text-[11px] text-foreground/60 leading-relaxed font-semibold">
                          {address.city}, {address.state} — {address.zip}
                        </p>
                        <p className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider flex items-center gap-1.5 pt-1 border-t border-foreground/5 mt-2">
                          <Smartphone className="w-3.5 h-3.5 text-foreground/35" />
                          +91 {address.phone.replace("+91", "").replace("+91", "")}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="w-full h-11 bg-black text-white dark:bg-white dark:text-black rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm md:hidden"
                        >
                          <span>Deliver to this Address</span>
                          <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSavedId("");
                            setAddress({
                              name: session?.user?.name || "",
                              email: session?.user?.email || "",
                              phone: (session as any)?.customer?.phone || (session?.user as any)?.phone || "",
                              houseNo: "", street: "",
                              landmark: "", city: "", state: "", zip: "", country: "India",
                            });
                            setAddressErrors({});
                            setShowAddressForm(true);
                          }}
                          className="w-full h-10 text-[8.5px] font-semibold uppercase tracking-[0.15em] bg-transparent border border-dashed border-black/[0.12] dark:border-white/[0.12] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] rounded-xl text-foreground/75 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add New Address
                        </button>
                      </div>
                    </div>
                  )}

                  {showAddressForm && (
                    <form id="address-form" onSubmit={handleAddressSubmit} className="flex-1 flex flex-col w-full">
                      <style>{`
                        .pac-container {
                          background-color: #121212 !important;
                          border: 1px solid rgba(255, 255, 255, 0.08) !important;
                          border-radius: 12px !important;
                          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5) !important;
                          font-family: inherit !important;
                          margin-top: 4px !important;
                          z-index: 9999 !important;
                        }
                        .pac-item {
                          border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
                          padding: 10px 14px !important;
                          color: rgba(255, 255, 255, 0.8) !important;
                          font-size: 13px !important;
                          cursor: pointer !important;
                          display: flex !important;
                          align-items: center !important;
                        }
                        .pac-item:hover, .pac-item-selected {
                          background-color: rgba(255, 255, 255, 0.05) !important;
                        }
                        .pac-item-query {
                          font-size: 13px !important;
                          color: #ffffff !important;
                          padding-right: 4px !important;
                        }
                        .pac-matched {
                          font-weight: 700 !important;
                        }
                        .pac-icon {
                          margin-right: 10px !important;
                          filter: invert(1) !important;
                        }
                      `}</style>
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
                          className="w-full h-14 px-4 rounded-2xl border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:scale-[0.98] transition-all flex items-center justify-between text-foreground mb-5 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <Folder className="w-5 h-5 text-foreground/70" />
                            <span className="text-[14px] font-medium">Use saved addresses</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-foreground/70" />
                        </button>
                      )}

                      {/* Search and Geolocation Card */}
                      <div className="p-4 mb-5 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/10 dark:bg-white/[0.02] backdrop-blur-md flex flex-col gap-3 shadow-sm">
                        <div className="flex flex-row gap-2.5 w-full">
                          {/* Autocomplete Input */}
                          <div className="flex-1 relative flex items-center h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30">
                            <MapPin className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              ref={autocompleteInputRef}
                              type="text"
                              placeholder="Search area, locality, or landmark"
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                        </div>

                        {/* Use Current Location Button */}
                        <button
                          type="button"
                          onClick={handleDetectLocation}
                          disabled={locating}
                          className="w-full h-[46px] rounded-xl border border-black/[0.08] dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-md text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-[14px] font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer"
                        >
                          {locating ? (
                            <Loader2 className="w-4 h-4 animate-spin text-current" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 rotate-45 text-current shrink-0" />
                          )}
                          <span>Detect my location</span>
                        </button>
                      </div>

                      {/* Section 1: Contact Details */}
                      <div className="flex flex-col gap-0.5 mb-3.5 pl-0.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/45">Contact Details</p>
                      </div>
                      <div className="grid grid-cols-12 gap-3.5 w-full mb-6">
                        {/* Full Name */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.name ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <User className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-name"
                              name="name"
                              type="text"
                              placeholder="Full Name"
                              aria-label="Full Name"
                              autoComplete="name"
                              required
                              value={address.name}
                              onChange={(e) => updateField("name", e.target.value)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.name && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.name}</p>}
                        </div>

                        {/* Email Address */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.email ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <Mail className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-email"
                              name="email"
                              type="email"
                              placeholder="Email Address"
                              aria-label="Email"
                              autoComplete="email"
                              required
                              value={address.email}
                              onChange={(e) => updateField("email", e.target.value)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.email && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.email}</p>}
                        </div>

                        {/* Mobile Number */}
                        <div className="col-span-12">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.phone ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <div className="flex items-center text-[15px] font-semibold text-foreground/60 select-none mr-2 pl-1">
                              <span>+91</span>
                            </div>
                            <div className="h-4 w-[1px] bg-black/[0.08] dark:bg-white/[0.08] mr-2.5 shrink-0" />
                            <input
                              id="address-phone"
                              name="phone"
                              type="tel"
                              placeholder="Mobile Number"
                              aria-label="Mobile Number"
                              autoComplete="tel"
                              inputMode="tel"
                              required
                              value={address.phone.startsWith("+91") ? address.phone.slice(3) : address.phone}
                              onChange={(e) => updateField("phone", e.target.value)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.phone && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.phone}</p>}
                        </div>
                      </div>

                      {/* Section 2: Shipping Address */}
                      <div className="flex flex-col gap-0.5 mb-3.5 pl-0.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/45">Delivery Address</p>
                      </div>
                      <div className="grid grid-cols-12 gap-3.5 w-full">
                        {/* House / Flat / Building */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.houseNo ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <Home className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-house"
                              name="houseNo"
                              type="text"
                              placeholder="House/Flat"
                              aria-label="House, Flat, Tower, or Building Details"
                              autoComplete="address-line2"
                              required
                              value={address.houseNo}
                              onChange={(e) => updateField("houseNo", e.target.value, true)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.houseNo && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.houseNo}</p>}
                        </div>

                        {/* Street / Road / Area */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.street ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <svg
                              className="w-4 h-4 text-foreground/40 mr-2 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 22L14 2M6 22L10 2M12 2v4M12 9v3M12 15v3" />
                            </svg>
                            <input
                              id="address-street"
                              name="street"
                              type="text"
                              placeholder="Street/Road"
                              aria-label="Street, Road, or Area"
                              autoComplete="address-line1"
                              required
                              value={address.street}
                              onChange={(e) => updateField("street", e.target.value, true)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.street && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.street}</p>}
                        </div>

                        {/* Landmark */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30`}>
                            <Tag className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-landmark"
                              name="landmark"
                              type="text"
                              placeholder="Landmark"
                              aria-label="Landmark"
                              autoComplete="address-line3"
                              value={address.landmark}
                              onChange={(e) => updateField("landmark", e.target.value, true)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                        </div>

                        {/* PIN Code */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.zip ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <Map className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-zip"
                              name="zip"
                              type="text"
                              placeholder="PIN Code"
                              aria-label="PIN Code"
                              autoComplete="postal-code"
                              inputMode="numeric"
                              required
                              maxLength={6}
                              value={address.zip}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                updateField("zip", val);
                              }}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                            {zipLoading && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground/30 ml-1.5 shrink-0" />
                            )}
                          </div>
                          {addressErrors.zip && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.zip}</p>}
                        </div>

                        {/* City */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.city ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <Building2 className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <input
                              id="address-city"
                              name="city"
                              type="text"
                              placeholder="City"
                              aria-label="City"
                              autoComplete="address-level2"
                              required
                              value={address.city}
                              onChange={(e) => updateField("city", e.target.value)}
                              className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-[15px] font-sans font-normal text-foreground placeholder:text-foreground/35 p-0"
                            />
                          </div>
                          {addressErrors.city && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.city}</p>}
                        </div>

                        {/* State */}
                        <div className="col-span-6">
                          <div className={`relative flex items-center w-full h-[46px] rounded-xl px-3 transition-all duration-300 backdrop-blur-md ${addressErrors.state ? "border border-red-500/40 bg-red-500/[0.02]" : "border border-black/[0.08] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-foreground/40 dark:focus-within:border-white/30"}`}>
                            <Globe className="w-4 h-4 text-foreground/40 mr-2 shrink-0" />
                            <span className={`text-[15px] font-sans font-normal truncate pr-4 ${!address.state ? "text-foreground/35" : "text-foreground"}`}>
                              {address.state || "Select State"}
                            </span>
                            <ChevronDown className="absolute right-3 w-4 h-4 text-foreground/40 pointer-events-none" />
                            <select
                              id="address-state"
                              name="state"
                              required
                              autoComplete="address-level1"
                              value={address.state}
                              onChange={(e) => updateField("state", e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[15px]"
                            >
                              <option value="" disabled>Select State</option>
                              {INDIAN_STATES.map(s => (
                                <option key={s} value={s} className="bg-background text-foreground text-[15px]">{s}</option>
                              ))}
                            </select>
                          </div>
                          {addressErrors.state && <p className="text-[8px] text-red-500 mt-1 pl-1 leading-none">{addressErrors.state}</p>}
                        </div>
                      </div>

                      {/* Mobile Step 1 CTA button (inside form container) */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-foreground text-background dark:bg-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md mt-6 md:hidden cursor-pointer"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-current" />
                        ) : (
                          <>
                            <span>Continue to Payment</span>
                            <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col w-full"
                >
                  <div className="flex-1 flex flex-col w-full">
                    <div className="flex flex-col gap-0.5 mb-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="p-1 rounded-lg hover:bg-foreground/5 transition-colors -ml-1 mr-1"
                          aria-label="Go back to shipping details"
                        >
                          <ChevronLeft className="w-4 h-4 text-foreground/80" strokeWidth={2.25} />
                        </button>
                        <CreditCard className="w-3.5 h-3.5 text-foreground/80" strokeWidth={2.25} />
                        <h2 className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.12em] text-foreground/90">
                          PAYMENT DETAILS
                        </h2>
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-foreground/40 pl-8">
                        CHOOSE HOW YOU WANT TO PAY
                      </p>
                    </div>

                    {/* Mobile Step 2 Order Summary block */}
                    <div className="md:hidden flex flex-col w-full mb-4">
                      {renderOrderSummary()}
                    </div>

                    {/* Desktop Payment Selector */}
                    {renderPaymentSelector(false)}



                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Order Summary (Desktop only) */}
          <div className="hidden md:flex col-span-12 md:col-span-5 flex-col gap-4 w-full sticky top-24">
            <h2 className="text-[10px] font-black uppercase tracking-[0.12em] text-foreground/80 pl-0.5 leading-none">ORDER SUMMARY</h2>
            {renderOrderSummary()}
          </div>
        </div>
      </div>
    </div>
  );
}
