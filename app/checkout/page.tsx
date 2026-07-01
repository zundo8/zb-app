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
  MapPin,
  ShieldCheck,
  Plus,
  AlertCircle,
  Loader2,
  Lock,
  Sparkles,
  User,
  Mail,
  Smartphone,
  Home,
  Map,
  Building2,
  Globe,
  Locate,
  ChevronDown
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

const BLOCKED_CHARS = /[`~!@#$%^&*()_+={}[\]|\\:;"'<>?/]/g;
const sanitizeAddress = (val: string) => val.replace(BLOCKED_CHARS, "");

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry"
];

export default function CheckoutAddressPage() {
  const { data: session, status } = useSession();
  const { items, subtotal } = useCart();
  const router = useRouter();
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initiatedPixel, setInitiatedPixel] = useState(false);
  const [paymentInfoFired, setPaymentInfoFired] = useState(false);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<DBAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [showAddressForm, setShowAddressForm] = useState(false);

  // Location and profile autofill states
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);

  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [zipLoading, setZipLoading] = useState(false);

  // Mount logic & localStorage restore
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("zica_checkout_address");
    if (saved) {
      try {
        setAddress(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to restore saved address:", e);
      }
    }
  }, []);

  // Sync to local storage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("zica_checkout_address", JSON.stringify(address));
    }
  }, [address, mounted]);

  // Auth & Cart Check
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/checkout`);
    } else if (mounted && items.length === 0) {
      router.push("/cart");
    }
  }, [items, router, status, mounted]);

  // Initiate Pixel Event
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
  }, [items, subtotal, initiatedPixel, session, address.phone, trackInitiateCheckout]);

  // PIN Code API Lookup
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
            setAddressErrors(prev => {
              const n = { ...prev };
              delete n.zip;
              delete n.city;
              delete n.state;
              return n;
            });
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
          // Parse saved address into fields
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

  // Load customer profile details to prefill form
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/customer/profile");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setProfile({
              name: data.name || "",
              email: data.email || "",
              phone: data.phone || ""
            });
            // If the user doesn't have any addresses, prefill the address form with these details
            if (!savedAddresses.length) {
              setAddress(prev => ({
                ...prev,
                name: data.name || prev.name,
                email: data.email || prev.email,
                phone: data.phone || prev.phone,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching profile details:", err);
      }
    };
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, savedAddresses.length]);

  // Reverse Geocoding via Geolocation
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch address details");
          }
          const data = await response.json();
          if (data && data.address) {
            const addr = data.address;

            const pincode = addr.postcode || "";
            const stateVal = addr.state || "";
            const cityVal = addr.city || addr.town || addr.village || addr.city_district || "";
            const streetVal = [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(", ");
            const houseNoVal = addr.house_number || addr.building || addr.amenity || "";

            const matchedState = INDIAN_STATES.find(
              (s) => s.toLowerCase() === stateVal.toLowerCase()
            ) || "";

            setAddress((prev) => ({
              ...prev,
              zip: pincode,
              state: matchedState || stateVal,
              city: cityVal,
              street: streetVal,
              houseNo: houseNoVal,
            }));
            
            setAddressErrors(prev => {
              const n = { ...prev };
              delete n.zip;
              delete n.state;
              delete n.city;
              delete n.street;
              delete n.houseNo;
              return n;
            });
          } else {
            setLocationError("Could not resolve address for this location.");
          }
        } catch (err: any) {
          console.error("Error reverse geocoding:", err);
          setLocationError("Failed to fetch address details. Please fill manually.");
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError("Permission denied or location unavailable.");
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
    setTouched({});
    setShowAddressForm(false);

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

  // Validation logic
  const validateField = (field: keyof Address) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const errors = { ...addressErrors };

    if (field === "name") {
      if (!address.name.trim() || address.name.trim().length < 2) {
        errors.name = "Enter your full name";
      } else {
        delete errors.name;
      }
    }
    if (field === "email") {
      if (!address.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
        errors.email = "Enter a valid email address";
      } else {
        delete errors.email;
      }
    }
    if (field === "phone") {
      const digits = address.phone.replace(/\D/g, "");
      let baseNumber = digits;
      if (digits.length === 12 && digits.startsWith("91")) {
        baseNumber = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith("0")) {
        baseNumber = digits.slice(1);
      }
      if (baseNumber.length !== 10) {
        errors.phone = "Enter a valid 10-digit number";
      } else {
        delete errors.phone;
      }
    }
    if (field === "houseNo") {
      if (!address.houseNo.trim()) {
        errors.houseNo = "Flat / House number is required";
      } else {
        delete errors.houseNo;
      }
    }
    if (field === "street") {
      if (!address.street.trim() || address.street.trim().length < 3) {
        errors.street = "Street / Road name must be at least 3 characters";
      } else {
        delete errors.street;
      }
    }
    if (field === "zip") {
      if (!/^\d{6}$/.test(address.zip.trim())) {
        errors.zip = "Enter a valid 6-digit PIN code";
      } else {
        delete errors.zip;
      }
    }
    if (field === "city") {
      if (!address.city.trim()) {
        errors.city = "City is required";
      } else {
        delete errors.city;
      }
    }
    if (field === "state") {
      if (!address.state.trim()) {
        errors.state = "Select your state";
      } else {
        delete errors.state;
      }
    }

    setAddressErrors(errors);
  };

  const validateAddress = (): boolean => {
    const errors: Record<string, string> = {};

    if (!address.name.trim() || address.name.trim().length < 2) {
      errors.name = "Enter your full name";
    }
    if (!address.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      errors.email = "Enter a valid email address";
    }

    const digits = address.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) {
      baseNumber = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      baseNumber = digits.slice(1);
    }
    if (baseNumber.length !== 10) {
      errors.phone = "Enter a valid 10-digit number";
    }

    if (!address.houseNo.trim()) {
      errors.houseNo = "Flat / House number is required";
    }
    if (!address.street.trim() || address.street.trim().length < 3) {
      errors.street = "Street / Road name is required";
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

  // Form submission / Proceed
  const handleAddressSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    // Save to database
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
          await fetchSavedAddresses(false);
        }
      }
    } catch (err) {
      console.error("Failed to auto-save address on proceed:", err);
    } finally {
      setLoading(false);
    }

    // Save state locally
    localStorage.setItem("zica_checkout_address", JSON.stringify(updatedAddress));

    // Analytics
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

    saveUserDataToCookiesAndReinit({
      email: updatedAddress.email || undefined,
      phone: formattedPhone || undefined,
      name: updatedAddress.name || undefined,
      city: updatedAddress.city || undefined,
      state: updatedAddress.state || undefined,
      zip: updatedAddress.zip || undefined,
      country: updatedAddress.country || "India",
    });

    // PUSH to step 2 (Payment step)
    router.push("/checkout/payment");
  };

  const updateField = useCallback((field: keyof Address, value: string, sanitize = false) => {
    setSelectedSavedId("");
    setAddress(prev => ({ ...prev, [field]: sanitize ? sanitizeAddress(value) : value }));
    setAddressErrors(prev => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }, []);

  const handleBackClick = useCallback(() => {
    router.push("/cart");
  }, [router]);

  // Check if form fields are fully filled and valid (to enable Proceed CTA button dynamically)
  const isFormValid = useMemo(() => {
    return (
      address.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email) &&
      address.phone.replace(/\D/g, "").replace(/^91/, "").length === 10 &&
      address.houseNo.trim().length >= 1 &&
      address.street.trim().length >= 3 &&
      /^\d{6}$/.test(address.zip.trim()) &&
      address.city.trim().length >= 1 &&
      address.state.trim().length >= 1
    );
  }, [address]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] text-slate-800 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Loading Checkout...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-slate-850 font-sans pb-36">
      {/* Shared Custom Checkout Header */}
      <CheckoutHeader step={1} onBack={handleBackClick} />

      {/* Main Layout Container */}
      <main className="max-w-md mx-auto px-4 pt-24 flex flex-col">
        {/* Step Section Intro Block */}
        <section className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50">
            <MapPin className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">Shipping Address</h1>
            <p className="text-xs text-slate-450 mt-0.5 leading-none">Enter your details so we can deliver to you.</p>
          </div>
        </section>

        {/* Saved Addresses Selector (if logged in and has saved addresses) */}
        {savedAddresses.length > 0 && !showAddressForm && (
          <section className="mb-6">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 block font-mono">
              SAVED ADDRESSES
            </span>
            <div className="flex gap-3 overflow-x-auto pb-3.5 snap-x snap-mandatory hide-scrollbar">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`snap-start shrink-0 w-[170px] text-left p-3.5 rounded-2xl bg-white border transition-all flex flex-col justify-between ${
                    selectedSavedId === addr.id
                      ? "border-black ring-1 ring-black shadow-md"
                      : "border-slate-100 opacity-75 hover:opacity-100 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10.5px] font-extrabold truncate pr-1 text-slate-800 uppercase tracking-tight">
                        {addr.name}
                      </span>
                      {addr.isDefault && (
                        <span className="px-1.5 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider bg-slate-950 text-white shrink-0">
                          DEF
                        </span>
                      )}
                    </div>
                    <p className="text-[9.5px] text-slate-500 line-clamp-2 leading-relaxed">
                      {addr.address1}
                      {addr.address2 ? `, ${addr.address2}` : ""}
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold mt-2 pt-2 border-t border-slate-50">
                    {addr.city}, {addr.state}
                  </p>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setSelectedSavedId("");
                  setAddress({
                    name: profile?.name || session?.user?.name || "",
                    email: profile?.email || session?.user?.email || "",
                    phone: profile?.phone || (session as any)?.customer?.phone || "",
                    houseNo: "",
                    street: "",
                    landmark: "",
                    city: "",
                    state: "",
                    zip: "",
                    country: "India",
                  });
                  setAddressErrors({});
                  setTouched({});
                  setShowAddressForm(true);
                }}
                className="snap-start shrink-0 p-3.5 border-2 border-dashed border-slate-200 bg-white/50 hover:bg-white flex flex-col items-center justify-center gap-1.5 w-[100px] text-center transition-all rounded-2xl shadow-sm"
              >
                <Plus className="w-5 h-5 text-slate-400" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  NEW ADDR
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Selected Saved Address Info Display (when form is collapsed) */}
        {!showAddressForm && selectedSavedId && (
          <section className="bg-white rounded-2xl p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-slate-100/50 flex flex-col gap-4 mb-6 animate-in fade-in duration-200">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-450 font-mono">
                DELIVERING TO
              </span>
              <p className="text-xs font-black text-slate-800 mt-1 uppercase tracking-tight">
                {address.name}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mt-1">
                {address.houseNo}, {address.street}
                {address.landmark ? `, ${address.landmark}` : ""}
              </p>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                {address.city}, {address.state} — {address.zip}
              </p>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-1 mt-2.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                +91 {address.phone.replace("+91", "")}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="text-[9.5px] font-bold uppercase tracking-widest font-mono text-blue-600 hover:text-blue-700"
              >
                Edit Address Details
              </button>
            </div>
          </section>
        )}

        {/* Shipping Fields Address Form */}
        {(showAddressForm || !selectedSavedId) && (
          <form onSubmit={handleAddressSubmit} className="flex flex-col gap-5 animate-in fade-in duration-200">
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
                className="w-full h-10 text-[9.5px] font-bold uppercase tracking-widest font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all flex items-center justify-center rounded-xl"
              >
                Back to Saved Addresses
              </button>
            )}

            {locationError && (
              <div className="flex items-center gap-2.5 p-3.5 border border-red-200 bg-red-50 text-red-650 text-[10.5px] font-bold leading-snug rounded-2xl shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <p>{locationError}</p>
              </div>
            )}

            {/* Fields grid */}
            <div className="flex flex-col gap-4">
              {/* Full Name & Email Row */}
              <div className="grid grid-cols-2 gap-3.5">
                <CheckoutInput
                  id="name"
                  label="Full Name"
                  icon={<User className="w-4.5 h-4.5" />}
                  error={touched.name ? addressErrors.name : undefined}
                >
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Recipient Name"
                    value={address.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    onBlur={() => validateField("name")}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                </CheckoutInput>

                <CheckoutInput
                  id="email"
                  label="Email Address"
                  icon={<Mail className="w-4.5 h-4.5" />}
                  error={touched.email ? addressErrors.email : undefined}
                >
                  <input
                    id="email"
                    type="email"
                    required
                    inputMode="email"
                    placeholder="name@email.com"
                    value={address.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    onBlur={() => validateField("email")}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                </CheckoutInput>
              </div>

              {/* Mobile Phone Field */}
              <CheckoutInput
                id="phone"
                label="Mobile Number"
                icon={<Smartphone className="w-4.5 h-4.5" />}
                error={touched.phone ? addressErrors.phone : undefined}
              >
                <div className="flex items-center w-full">
                  <div className="flex items-center gap-0.5 text-xs font-bold text-slate-800 select-none pr-2">
                    <span>+91</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="h-4 w-[1px] bg-slate-200 mr-2.5 shrink-0" />
                  <input
                    id="phone"
                    type="tel"
                    required
                    inputMode="numeric"
                    placeholder="10-digit number"
                    value={address.phone.startsWith("+91") ? address.phone.slice(3) : address.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      updateField("phone", val);
                    }}
                    onBlur={() => validateField("phone")}
                    className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none font-mono"
                  />
                </div>
              </CheckoutInput>

              {/* House / Flat No */}
              <CheckoutInput
                id="houseNo"
                label="Flat / House No / Building"
                icon={<Home className="w-4.5 h-4.5" />}
                error={touched.houseNo ? addressErrors.houseNo : undefined}
              >
                <input
                  id="houseNo"
                  type="text"
                  required
                  placeholder="Flat, Villa, Apartment name"
                  value={address.houseNo}
                  onChange={(e) => updateField("houseNo", e.target.value, true)}
                  onBlur={() => validateField("houseNo")}
                  className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                />
              </CheckoutInput>

              {/* Street + Detect Location */}
              <CheckoutInput
                id="street"
                label="Street / Road / Area"
                icon={<Map className="w-4.5 h-4.5" />}
                error={touched.street ? addressErrors.street : undefined}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <input
                    id="street"
                    type="text"
                    required
                    placeholder="Street, Sector, Layout"
                    value={address.street}
                    onChange={(e) => updateField("street", e.target.value, true)}
                    onBlur={() => validateField("street")}
                    className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100/70 text-[9.5px] font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {detectingLocation ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : (
                      <Locate className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>{detectingLocation ? "Detecting" : "Detect Location"}</span>
                  </button>
                </div>
              </CheckoutInput>

              {/* Landmark & PIN Code */}
              <div className="grid grid-cols-2 gap-3.5">
                <CheckoutInput
                  id="landmark"
                  label="Landmark (Optional)"
                  icon={<Building2 className="w-4.5 h-4.5" />}
                >
                  <input
                    id="landmark"
                    type="text"
                    placeholder="E.g., Near Apollo Hospital"
                    value={address.landmark}
                    onChange={(e) => updateField("landmark", e.target.value, true)}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                </CheckoutInput>

                <CheckoutInput
                  id="zip"
                  label="PIN Code"
                  icon={<Globe className="w-4.5 h-4.5" />}
                  error={touched.zip ? addressErrors.zip : undefined}
                >
                  <div className="flex items-center w-full">
                    <input
                      id="zip"
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit PIN"
                      value={address.zip}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        updateField("zip", val);
                      }}
                      onBlur={() => validateField("zip")}
                      className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none font-mono tracking-widest"
                    />
                    {zipLoading && (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0 ml-1.5" />
                    )}
                  </div>
                </CheckoutInput>
              </div>

              {/* City & State Dropdown */}
              <div className="grid grid-cols-2 gap-3.5">
                <CheckoutInput
                  id="city"
                  label="City / Town"
                  icon={<MapPin className="w-4.5 h-4.5" />}
                  error={touched.city ? addressErrors.city : undefined}
                >
                  <input
                    id="city"
                    type="text"
                    required
                    placeholder="City Name"
                    value={address.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    onBlur={() => validateField("city")}
                    className="w-full bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  />
                </CheckoutInput>

                <CheckoutInput
                  id="state"
                  label="State"
                  icon={<Globe className="w-4.5 h-4.5" />}
                  error={touched.state ? addressErrors.state : undefined}
                >
                  <div className="relative w-full flex items-center justify-between">
                    <span className={`text-sm font-semibold truncate ${!address.state ? "text-slate-400" : "text-slate-800"}`}>
                      {address.state || "Select State"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none shrink-0" />
                    <select
                      id="state"
                      required
                      value={address.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      onBlur={() => validateField("state")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-sm"
                    >
                      <option value="" disabled>Select State</option>
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </CheckoutInput>
              </div>
            </div>
          </form>
        )}

        {/* Security / Trust Card */}
        <section className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-slate-100/50 flex items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5.5 h-5.5 text-slate-500" strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Secure & Safe</h4>
              <p className="text-[10px] text-slate-450 mt-0.5">Your data is encrypted & protected.</p>
            </div>
          </div>
          <div className="relative opacity-25 shrink-0 w-8 h-8 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-650" />
            <Sparkles className="w-3.5 h-3.5 text-slate-650 absolute -top-1 -right-1" />
          </div>
        </section>

        {/* Centered trust footer below CTA */}
        <div className="flex items-center justify-center gap-1 mt-6 text-slate-400">
          <Lock className="w-3 h-3 text-slate-400" />
          <span className="text-[9px] font-bold font-mono tracking-wider">zicabella.com</span>
        </div>
      </main>

      {/* Dynamic Sticky Bottom CTA */}
      {selectedSavedId && !showAddressForm ? (
        <StickyCTA
          label="Deliver to this Address"
          loading={loading}
          onClick={handleAddressSubmit}
        />
      ) : (
        <StickyCTA
          label="Continue to Payment"
          disabled={!isFormValid}
          loading={loading}
          onClick={handleAddressSubmit}
        />
      )}
    </div>
  );
}
