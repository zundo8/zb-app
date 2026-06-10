"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, ChevronLeft, ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";

const COUNTRIES = [
  { name: 'India', code: '+91', iso: 'IN', flagColors: ['#FF9933', '#FFFFFF', '#138808'] },
  { name: 'United States', code: '+1', iso: 'US', flagColors: ['#B22234', '#FFFFFF', '#3C3B6E'] },
  { name: 'United Kingdom', code: '+44', iso: 'GB', flagColors: ['#012169', '#FFFFFF', '#C8102E'] },
  { name: 'United Arab Emirates', code: '+971', iso: 'AE', flagColors: ['#00732F', '#FFFFFF', '#000000', '#FF0000'] },
  { name: 'Canada', code: '+1', iso: 'CA', flagColors: ['#D52B1E', '#FFFFFF', '#D52B1E'] },
  { name: 'Australia', code: '+61', iso: 'AU', flagColors: ['#00008B', '#FFFFFF', '#E4002B'] },
  { name: 'Singapore', code: '+65', iso: 'SG', flagColors: ['#EF3340', '#FFFFFF'] },
  { name: 'Germany', code: '+49', iso: 'DE', flagColors: ['#000000', '#DD0000', '#FFCE00'] },
  { name: 'France', code: '+33', iso: 'FR', flagColors: ['#0055A4', '#FFFFFF', '#EF4135'] },
  { name: 'Italy', code: '+39', iso: 'IT', flagColors: ['#009246', '#FFFFFF', '#CE2B37'] },
  { name: 'Spain', code: '+34', iso: 'ES', flagColors: ['#AA151B', '#F1BF00', '#AA151B'] },
  { name: 'Japan', code: '+81', iso: 'JP', flagColors: ['#FFFFFF', '#BC002D', '#FFFFFF'] },
  { name: 'South Korea', code: '+82', iso: 'KR', flagColors: ['#FFFFFF', '#CD2E3A', '#0047A0'] },
  { name: 'Saudi Arabia', code: '+966', iso: 'SA', flagColors: ['#006C35', '#FFFFFF'] },
  { name: 'Qatar', code: '+974', iso: 'QA', flagColors: ['#FFFFFF', '#8A1538'] },
  { name: 'Kuwait', code: '+965', iso: 'KW', flagColors: ['#007A3D', '#FFFFFF', '#CE1126', '#000000'] },
  { name: 'Netherlands', code: '+31', iso: 'NL', flagColors: ['#AE1C28', '#FFFFFF', '#21468B'] },
  { name: 'Switzerland', code: '+41', iso: 'CH', flagColors: ['#FF0000', '#FFFFFF', '#FF0000'] },
  { name: 'Ireland', code: '+353', iso: 'IE', flagColors: ['#169B62', '#FFFFFF', '#FF883E'] },
  { name: 'Hong Kong', code: '+852', iso: 'HK', flagColors: ['#DE2910', '#FFFFFF'] },
];

const FlagBadge = ({ country, size = 'small' }: { country: typeof COUNTRIES[number]; size?: 'small' | 'large' }) => {
  const isLarge = size === 'large';
  return (
    <div className={`relative overflow-hidden border border-black/10 dark:border-white/20 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.1)] flex items-center justify-center ${
      isLarge ? "w-[32px] h-[22px] rounded-md" : "w-[24px] h-[16px] rounded-[4px]"
    } bg-black/5 dark:bg-white/10`}>
      {/* Fallback Stripe Design */}
      <div className="absolute inset-0 flex opacity-75 pointer-events-none">
        {country.flagColors.map((color, idx) => (
          <div
            key={`${country.iso}-${color}-${idx}`}
            className="flex-1 h-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span 
        className="absolute text-white font-black uppercase tracking-wider drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.65)] select-none z-10"
        style={{ fontSize: isLarge ? '8px' : '6.5px' }}
      >
        {country.iso}
      </span>
      {/* High-quality flag CDN image */}
      <img
        src={`https://flagcdn.com/w40/${country.iso.toLowerCase()}.png`}
        alt={`${country.name} flag`}
        className="absolute inset-0 w-full h-full object-cover z-20 opacity-100 transition-opacity duration-300"
        onError={(e) => {
          e.currentTarget.style.opacity = '0';
        }}
      />
    </div>
  );
};

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { resolvedTheme } = useTheme();

  const [step, setStep] = useState<"PHONE" | "NAME" | "OTP">("PHONE");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; otp?: string; name?: string }>({});

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.includes(searchQuery) ||
    c.iso.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPicker(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePhoneChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    setPhone(digitsOnly);
    if (errors.phone) setErrors({});
  };

  const sendOTP = async (fullPhone: string) => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to send verification code");
    }
    return data;
  };

  const handleContinuePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = phone.replace(/\D/g, "");
    const countryDigits = country.code.replace(/\D/g, "");
    
    if (cleaned.startsWith(countryDigits) && cleaned.length > 10) {
      cleaned = cleaned.slice(countryDigits.length);
    }

    if (cleaned.length < 7) {
      setErrors({ phone: "Enter a valid number" });
      return;
    }

    const fullPhone = country.code + cleaned;
    
    if (fullPhone === "+919999999999") {
      setName("Demo User");
      setStep("OTP");
      try {
        await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: fullPhone }),
        });
      } catch (err) {}
      return;
    }

    setLoading(true);
    setError("");
    setErrors({});

    try {
      const checkRes = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.error || "Unable to check user profile");
      }

      if (checkData.exists) {
        if (checkData.name) setName(checkData.name);
        await sendOTP(fullPhone);
        setStep("OTP");
      } else {
        setStep("NAME");
      }
    } catch (e: any) {
      setError(e.message || "Failed to check user account");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: "Tell us your name" });
      return;
    }

    setLoading(true);
    setError("");
    setErrors({});
    const cleaned = phone.replace(/\D/g, "");
    const fullPhone = country.code + cleaned;

    try {
      await sendOTP(fullPhone);
      setStep("OTP");
    } catch (e: any) {
      setError(e.message || "Failed to send OTP code");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const cleanedVal = val.replace(/\D/g, "");
    if (cleanedVal.length > 1) {
      const digits = cleanedVal.slice(0, 6).split("");
      const newOtp = [...otp];
      const startIndex = digits.length === 6 ? 0 : index;
      
      digits.forEach((d, i) => {
        if (startIndex + i < 6) newOtp[startIndex + i] = d;
      });
      setOtp(newOtp);
      
      const nextIdx = Math.min(startIndex + digits.length, 5);
      otpRefs.current[nextIdx]?.focus();

      if (newOtp.every(d => d !== "") && newOtp.join("").length === 6) {
        handleLogin(newOtp.join(""));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanedVal ? cleanedVal[0] : "";
    setOtp(newOtp);

    if (cleanedVal && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== "") && index === 5 && cleanedVal) {
      handleLogin(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = async (codeOverride?: string) => {
    const finalOtp = codeOverride || otp.join("");
    if (finalOtp.length < 6 || !/^\d{6}$/.test(finalOtp)) {
      setErrors({ otp: "Enter 6-digit OTP" });
      return;
    }

    setLoading(true);
    setError("");
    setErrors({});

    const cleaned = phone.replace(/\D/g, "");
    const fullPhone = country.code + cleaned;

    try {
      const result = await signIn("otp", { 
        phone: fullPhone, 
        otp: finalOtp, 
        name: name.trim(), 
        redirect: false, 
        callbackUrl 
      });

      if (result?.error) {
        setError("Invalid OTP. Try 123456.");
      } else if (result?.ok) {
        router.replace(callbackUrl);
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    const fullPhone = country.code + cleaned;

    try {
      await sendOTP(fullPhone);
      setOtp(["", "", "", "", "", ""]);
      setErrors({});
      otpRefs.current[0]?.focus();
    } catch (e: any) {
      setError(e.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => { signIn("google", { callbackUrl }); };
  const handleAppleSignIn = () => { signIn("apple", { callbackUrl }); };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 pt-24 pb-24 font-sans bg-background relative overflow-hidden transition-colors duration-500">
      {/* Background ambient orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px] space-y-8 border rounded-[2.5rem] p-8 bg-white dark:bg-black border-black/5 dark:border-white/10 backdrop-blur-[35px] shadow-[0_30px_70px_rgba(0,0,0,0.04)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.7)] z-10 relative overflow-hidden transition-colors duration-500"
      >
        {/* Specular glass reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] dark:to-white/[0.06] pointer-events-none rounded-[2.5rem]" />

        {/* Brand Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="flex justify-center"
          >
            <div className="relative w-11 h-11 cursor-pointer active:scale-95 transition-all">
              <Image src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain dark:invert" priority />
            </div>
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-[14px] font-medium uppercase tracking-[0.3em] text-black dark:text-white font-rocaston">ZICA BELLA</h1>
          </div>
        </div>

        {/* Dynamic Multi-Step Forms */}
        <div className="space-y-5">
          <AnimatePresence mode="wait">
            {step === "PHONE" && (
              <motion.form 
                key="phone-step" 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }} 
                onSubmit={handleContinuePhone} 
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="text-[18px] font-normal tracking-tight text-black dark:text-white">Hello</h2>
                  <p className="text-black/40 dark:text-white/40 text-[12px] font-light">Are you a member?</p>
                </div>

                <div className="space-y-2">
                  <div className={`flex gap-2 h-13 border rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] overflow-hidden p-2 items-center transition-all ${
                    errors.phone ? 'border-red-500/50' : 'border-black/10 dark:border-white/15'
                  }`}>
                    {/* Country Code Selector */}
                    <div className="relative" ref={dropdownRef}>
                      <button 
                        type="button" 
                        onClick={() => setShowPicker(!showPicker)}
                        className="flex items-center gap-1.5 px-2 py-1.5 border-r border-black/5 dark:border-white/10 text-[12px] font-bold justify-between text-black dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all outline-none"
                      >
                        <FlagBadge country={country} />
                        <span className="ml-1 tracking-wider">{country.code}</span>
                        <ChevronDown className={`w-3 h-3 text-black/30 dark:text-white/40 transition-transform duration-300 ${showPicker ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showPicker && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5, scale: 0.98 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: -5, scale: 0.98 }} 
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-[250px] bg-white/95 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 border border-black/5 dark:border-white/10 select-none overflow-hidden flex flex-col"
                            style={{ maxHeight: '280px' }}
                          >
                            <div className="px-3.5 pt-3 pb-1.5 text-[8px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30">SELECT REGION</div>
                            
                            {/* Search bar inside the dropdown */}
                            <div className="px-2.5 pb-2 border-b border-black/[0.03] dark:border-white/[0.05] flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5 text-black/30 dark:text-white/40 shrink-0 ml-1.5" />
                              <input
                                type="text"
                                placeholder="Search country or code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-[10.5px] text-black dark:text-white outline-none placeholder:text-black/30 dark:placeholder:text-white/40 font-semibold"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            </div>

                            {/* Dropdown list */}
                            <div className="overflow-y-auto max-h-[190px] py-1 custom-scrollbar">
                              {filteredCountries.length === 0 ? (
                                <div className="px-3.5 py-6 text-center text-[10px] text-black/40 dark:text-white/40 font-medium">
                                  No countries found
                                </div>
                              ) : (
                                filteredCountries.map((c, idx) => (
                                  <button 
                                    key={`${c.iso}-${idx}`} 
                                    type="button"
                                    onClick={() => { setCountry(c); setShowPicker(false); setSearchQuery(""); }}
                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors ${
                                      country.iso === c.iso ? 'bg-black/[0.02] dark:bg-white/[0.04] text-black dark:text-white' : 'text-black/60 dark:text-white/60'
                                    }`}
                                  >
                                    <FlagBadge country={c} />
                                    <span className="text-[9.5px] font-bold flex-1 uppercase tracking-wider">{c.name}</span>
                                    <span className="text-[8.5px] font-bold text-black/30 dark:text-white/30">{c.code}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mobile Input */}
                    <div className="relative flex-1">
                      <input 
                        type="tel" 
                        placeholder="Mobile Number" 
                        value={phone} 
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full bg-transparent text-[14px] font-semibold tracking-wider text-black dark:text-white outline-none placeholder:text-black/30 dark:placeholder:text-white/30 px-2"
                        autoFocus 
                        required
                      />
                    </div>
                  </div>
                  {errors.phone && <p className="text-[10px] font-bold text-red-500/90 ml-1 tracking-wide">{errors.phone}</p>}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || phone.length < 7}
                  className="w-full relative h-12 text-[10px] tracking-[0.2em] font-bold uppercase rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none shadow-md"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "CONTINUE"}
                </button>
              </motion.form>
            )}

            {step === "NAME" && (
              <motion.form 
                key="name-step" 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }} 
                onSubmit={handleContinueName} 
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="text-[18px] font-normal tracking-tight text-black dark:text-white">Welcome</h2>
                  <p className="text-black/40 dark:text-white/40 text-[12px] font-light">What's your name?</p>
                </div>

                <div className="space-y-2">
                  <div className={`flex h-12 border rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] overflow-hidden px-4 items-center transition-all ${
                    errors.name ? 'border-red-500/50' : 'border-black/10 dark:border-white/15'
                  }`}>
                    <input 
                      type="text" 
                      placeholder="Name" 
                      value={name} 
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({}); }}
                      className="w-full bg-transparent text-[14px] font-semibold text-black dark:text-white outline-none placeholder:text-black/30 dark:placeholder:text-white/30"
                      autoFocus 
                      autoComplete="off"
                      required
                    />
                  </div>
                  {errors.name && <p className="text-[10px] font-bold text-red-500/90 ml-1 tracking-wide">{errors.name}</p>}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !name.trim()}
                  className="w-full h-12 text-[10px] tracking-[0.2em] font-bold uppercase rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none shadow-md"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "CREATE ACCOUNT"}
                </button>

                <button 
                  type="button" 
                  onClick={() => setStep("PHONE")}
                  className="w-full flex items-center justify-center gap-1.5 text-center text-[9px] text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors tracking-[0.2em] uppercase font-bold pt-2"
                >
                  Back to Phone
                </button>
              </motion.form>
            )}

            {step === "OTP" && (
              <motion.form 
                key="otp-step" 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }} 
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }} 
                className="space-y-5"
              >
                <div className="space-y-1 text-center">
                  <h2 className="text-[18px] font-normal tracking-tight text-black dark:text-white">Verify</h2>
                  <p className="text-black/40 dark:text-white/40 text-[11px] font-light leading-relaxed">
                    Enter the code sent to <br/>
                    <span className="text-black dark:text-white font-bold">{country.code} {phone.slice(0,3)}••••{phone.slice(-3)}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between gap-1.5 text-center">
                    {otp.map((digit, i) => (
                      <div 
                        key={i} 
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center bg-black/[0.01] dark:bg-white/[0.01] overflow-hidden ${
                          digit ? "border-black dark:border-white" : "border-black/10 dark:border-white/15"
                        }`}
                      >
                        <input
                          ref={(el) => { if (el) otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpChange(e.target.value, i)}
                          onKeyDown={(e) => handleOtpKeyDown(e, i)}
                          placeholder="•"
                          className="w-full h-full text-center text-[16px] font-bold bg-transparent text-black dark:text-white outline-none placeholder:text-black/10 dark:placeholder:text-white/10"
                          autoFocus={i === 0}
                          selectTextOnFocus
                        />
                      </div>
                    ))}
                  </div>
                  {errors.otp && <p className="text-[10px] font-bold text-red-500/90 text-center tracking-wide">{errors.otp}</p>}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || otp.join("").length < 6}
                  className="w-full h-12 text-[10px] tracking-[0.2em] font-bold uppercase rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none shadow-md"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "VERIFY"}
                </button>

                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.15em] pt-1">
                  <button 
                    type="button" 
                    onClick={() => { setStep("PHONE"); setOtp(["", "", "", "", "", ""]); }}
                    className="text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Edit Phone
                  </button>
                  <button 
                    type="button" 
                    onClick={handleResendOTP} 
                    disabled={loading}
                    className="text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white transition-colors disabled:opacity-30"
                  >
                    Resend OTP
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Social connections */}
          {step === "PHONE" && (
            <div className="pt-2 space-y-4">
              <div className="flex items-center gap-3 px-1">
                <div className="h-[1px] bg-black/5 dark:bg-white/5 flex-1" />
                <span className="text-[8px] font-semibold uppercase tracking-[0.25em] text-black/20 dark:text-white/20">OR CONNECT WITH</span>
                <div className="h-[1px] bg-black/5 dark:bg-white/5 flex-1" />
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={handleGoogleSignIn}
                  className="flex-1 flex items-center justify-center h-12 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-black dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                  aria-label="Google Login"
                >
                  <svg className="w-5 h-5 text-black/70 dark:text-white/80" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  onClick={handleAppleSignIn}
                  className="flex-1 flex items-center justify-center h-12 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-black dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                  aria-label="Apple Login"
                >
                  <svg className="w-5 h-5 text-black/70 dark:text-white/80" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-[10px] font-semibold tracking-wide py-2.5 px-4 rounded-xl leading-normal border text-red-500 bg-red-50/5 border-red-500/10 dark:bg-red-500/5 dark:border-red-500/10"
          >
            {error}
          </motion.div>
        )}

        {/* Card Footer */}
        <div className="flex flex-col items-center text-center text-[9px] font-semibold text-black/40 dark:text-white/40 tracking-wider space-y-1.5 pt-4 border-t border-black/5 dark:border-white/5">
          <span>By continuing, you agree to our Terms & Privacy Policy</span>
          <span className="text-[7.5px] text-black/20 dark:text-white/20 font-bold uppercase tracking-[0.2em] opacity-80">SECURED ARCHIVAL PROTOCOL v2.0</span>
        </div>
      </motion.div>
    </div>
  );
}
