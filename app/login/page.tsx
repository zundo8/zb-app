"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronDown, Shield, Lock, Box } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
];

const FlagBadge = ({ country, size = 'small' }: { country: typeof COUNTRIES[number]; size?: 'small' | 'large' }) => {
  const isLarge = size === 'large';
  return (
    <div className={`relative overflow-hidden border border-neutral-200 dark:border-white/10 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-center ${
      isLarge ? "w-[24px] h-[16px] rounded-[3px]" : "w-[18px] h-[12px] rounded-[2px]"
    } bg-neutral-100 dark:bg-white/5`}>
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
        style={{ fontSize: isLarge ? '6px' : '4.5px' }}
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
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setSettings(data);
        }
      })
      .catch((err) => console.error("Error loading settings:", err));
  }, []);

  // Flow State
  const [step, setStep] = useState<"PHONE" | "NAME" | "OTP">("PHONE");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string; name?: string }>({});
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
    if (loading) return;

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
    if (loading) return;

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
    if (loading) return;

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
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : "Web Browser",
        redirect: false, 
        callbackUrl 
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Incorrect verification code. Please check and try again.");
        } else {
          setError(result.error);
        }
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
    if (loading) return;
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

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between bg-white dark:bg-black text-black dark:text-white overflow-hidden py-10 px-6 font-mono transition-colors duration-500 select-none">
      
      {/* ─── DYNAMIC BACKGROUND STREETWEAR OVERLAYS ─── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        {settings?.loginBgVideo ? (
          <>
            {/* Desktop Video Background */}
            <video
              src={settings.loginBgVideo}
              autoPlay
              loop
              muted
              playsInline
              className={`w-full h-full object-cover ${settings.loginBgVideoMobile ? 'hidden md:block' : 'block'}`}
            />
            {/* Mobile Video Background */}
            {settings.loginBgVideoMobile && (
              <video
                src={settings.loginBgVideoMobile}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover md:hidden"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/75 to-black dark:block hidden" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/85 to-white dark:hidden block" />
          </>
        ) : settings?.loginBgImage ? (
          <>
            {/* Desktop Custom Image Background */}
            <Image
              src={settings.loginBgImage}
              alt="Login Background"
              fill
              className={`object-cover object-center ${settings.loginBgImageMobile ? 'hidden md:block' : 'block'}`}
              priority
            />
            {/* Mobile Custom Image Background */}
            {settings.loginBgImageMobile && (
              <Image
                src={settings.loginBgImageMobile}
                alt="Login Background Mobile"
                fill
                className="object-cover object-center md:hidden"
                priority
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/75 to-black dark:block hidden" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/85 to-white dark:hidden block" />
          </>
        ) : (
          /* Default Fallback static layouts */
          <>
            {/* Dark theme: Atmospheric low exposure models */}
            <div className="absolute inset-0 hidden dark:block opacity-45">
              <Image 
                src="https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1000&auto=format&fit=crop" 
                alt="Streetwear Background Dark" 
                fill 
                className="object-cover object-top filter grayscale contrast-125 brightness-[0.7]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/75 to-black" />
            </div>
            
            {/* Light theme: Soft styled models */}
            <div className="absolute inset-0 dark:hidden opacity-10">
              <Image 
                src="https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1000&auto=format&fit=crop"
                alt="Streetwear Background Light" 
                fill 
                className="object-cover object-top filter grayscale opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/85 to-white" />
            </div>
          </>
        )}
      </div>

      {/* Ambient decorative radial glow (Dark theme only) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-neutral-900/10 dark:bg-violet-600/[0.03] blur-[120px] pointer-events-none z-0" />

      {/* ─── HEADER (Brand Name) ─── */}
      <header className="relative z-10 w-full flex justify-center pt-2">
        <h1 className="text-[12px] font-medium tracking-[0.35em] uppercase text-black/95 dark:text-white/95 font-rocaston leading-none">
          ZICA BELLA
        </h1>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main className="relative z-10 w-full max-w-[340px] flex flex-col justify-center flex-1 my-6">
        
        {/* Dynamic Titles based on Sign-in Step */}
        <div className="space-y-1 mb-8">
          <AnimatePresence mode="wait">
            {step === "PHONE" && (
              <motion.div
                key="phone-title"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-serif text-[42px] font-light tracking-tight text-black dark:text-white block leading-none">
                  enter
                </span>
                <span className="font-serif italic text-[42px] font-light tracking-tight text-black dark:text-white block leading-none mt-1">
                  your world.
                </span>
                <p className="text-[10.5px] font-mono tracking-[0.08em] text-neutral-500 dark:text-neutral-400 mt-5 leading-relaxed font-medium">
                  Luxury streetwear<br />designed for the bold.
                </p>
              </motion.div>
            )}
            
            {step === "NAME" && (
              <motion.div
                key="name-title"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-serif text-[42px] font-light tracking-tight text-black dark:text-white block leading-none">
                  create
                </span>
                <span className="font-serif italic text-[42px] font-light tracking-tight text-black dark:text-white block leading-none mt-1">
                  your profile.
                </span>
                <p className="text-[10.5px] font-mono tracking-[0.08em] text-neutral-500 dark:text-neutral-400 mt-5 leading-relaxed font-medium">
                  Tell us your name<br />to begin the journey.
                </p>
              </motion.div>
            )}

            {step === "OTP" && (
              <motion.div
                key="otp-title"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-serif text-[42px] font-light tracking-tight text-black dark:text-white block leading-none">
                  verify
                </span>
                <span className="font-serif italic text-[42px] font-light tracking-tight text-black dark:text-white block leading-none mt-1">
                  your access.
                </span>
                <p className="text-[10.5px] font-mono tracking-[0.08em] text-neutral-500 dark:text-neutral-400 mt-5 leading-relaxed font-medium">
                  Enter the verification code<br />sent to your device.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Form Area */}
        <div className="space-y-5">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Phone Input View */}
            {step === "PHONE" && (
              <motion.form 
                key="phone-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleContinuePhone}
                className="space-y-4 font-mono"
              >
                <p className="text-neutral-500 dark:text-neutral-400 text-[10.5px] font-normal leading-normal mb-1 font-mono">
                  Enter your mobile number and we'll send you a one-time password.
                </p>

                <div className="space-y-2 font-mono">
                  <div className={`relative flex items-center h-12 w-full border rounded-[8px] bg-transparent transition-all px-3.5 ${
                    errors.phone 
                      ? 'border-red-500/40 ring-1 ring-red-500/10' 
                      : 'border-neutral-200 dark:border-neutral-800 focus-within:border-neutral-950 dark:focus-within:border-white/40'
                  }`}>
                    {/* Country Code Selector */}
                    <div className="relative" ref={dropdownRef}>
                      <button 
                        type="button" 
                        onClick={() => setShowPicker(!showPicker)}
                        className="flex items-center gap-1 pr-2.5 mr-2 border-r border-neutral-200 dark:border-neutral-800 text-[11px] font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/50 dark:hover:bg-white/5 transition-all outline-none font-mono"
                      >
                        <FlagBadge country={country} />
                        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-300 ${showPicker ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showPicker && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5, scale: 0.98 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: -5, scale: 0.98 }} 
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-[240px] bg-white/70 dark:bg-black/55 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] z-50 border border-white/20 dark:border-white/10 overflow-hidden flex flex-col font-mono"
                            style={{ maxHeight: '230px' }}
                          >
                            <div className="px-3.5 pt-3 pb-1.5 text-[8px] font-bold uppercase tracking-widest text-neutral-450 dark:text-neutral-500 font-mono">SELECT REGION</div>
                            
                            {/* Dropdown list */}
                            <div className="overflow-y-auto max-h-[180px] py-1 custom-scrollbar">
                              {COUNTRIES.map((c, idx) => (
                                <button 
                                  key={`${c.iso}-${idx}`} 
                                  type="button"
                                  onClick={() => { setCountry(c); setShowPicker(false); }}
                                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150 ${
                                    country.iso === c.iso 
                                      ? 'bg-black/5 dark:bg-white/15 text-neutral-900 dark:text-white' 
                                      : 'text-neutral-600 dark:text-neutral-350 hover:bg-black/[0.03] dark:hover:bg-white/5'
                                  }`}
                                >
                                  <FlagBadge country={c} />
                                  <span className="text-[10px] font-bold flex-1 uppercase tracking-wider font-mono">{c.name}</span>
                                  <span className="text-[9px] font-bold text-neutral-400 dark:text-white/30 font-mono">{c.code}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Country Code Prefix */}
                    <span className="text-[13px] font-bold tracking-widest text-neutral-800 dark:text-white font-mono pl-1 select-none pr-1">
                      {country.code}
                    </span>

                    {/* Mobile Input */}
                    <input 
                      type="tel" 
                      placeholder="Enter mobile number" 
                      value={phone} 
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="flex-1 bg-transparent text-[13px] font-bold tracking-widest text-neutral-800 dark:text-white outline-none pl-1 border-none focus:ring-0 font-mono"
                      autoFocus 
                      required
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[10px] font-bold text-red-500/90 ml-1 tracking-wide font-mono">{errors.phone}</p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || phone.length < 7}
                  className="w-full h-12 text-[10px] tracking-[0.25em] font-bold uppercase rounded-[6px] bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-black/5 font-mono"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>SEND OTP <span className="text-xs font-mono">→</span></>
                  )}
                </button>
              </motion.form>
            )}

            {/* Step 2: Name Entry View */}
            {step === "NAME" && (
              <motion.form 
                key="name-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleContinueName}
                className="space-y-4 font-mono"
              >
                <p className="text-neutral-455 dark:text-neutral-400 text-[10.5px] leading-normal mb-1 font-mono">
                  Please provide your name to register an account with Zica Bella.
                </p>

                <div className="space-y-2 font-mono">
                  <div className={`flex h-12 border rounded-[8px] bg-transparent overflow-hidden px-4 items-center transition-all ${
                    errors.name 
                      ? 'border-red-500/40 ring-1 ring-red-500/10' 
                      : 'border-neutral-250 dark:border-neutral-800 focus-within:border-neutral-900 dark:focus-within:border-white/40'
                  }`}>
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      value={name} 
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({}); }}
                      className="w-full bg-transparent text-[13px] font-bold text-neutral-850 dark:text-white outline-none border-none focus:ring-0 placeholder:text-neutral-400 dark:placeholder:text-white/20 font-mono"
                      autoFocus 
                      autoComplete="off"
                      required
                    />
                  </div>
                  {errors.name && (
                    <p className="text-[10px] font-bold text-red-500/90 ml-1 tracking-wide font-mono">{errors.name}</p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !name.trim()}
                  className="w-full h-12 text-[11px] tracking-[0.25em] font-bold uppercase rounded-[6px] bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-black/5 font-mono"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>CREATE ACCOUNT &rarr;</>
                  )}
                </button>

                <button 
                  type="button" 
                  onClick={() => setStep("PHONE")}
                  className="w-full flex items-center justify-center gap-1.5 text-center text-[9px] text-neutral-450 dark:text-neutral-550 hover:text-neutral-900 dark:hover:text-white transition-colors tracking-[0.18em] uppercase font-bold pt-2 font-mono"
                >
                  Back to Phone
                </button>
              </motion.form>
            )}

            {/* Step 3: OTP Verification View */}
            {step === "OTP" && (
              <motion.form 
                key="otp-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
                className="space-y-5 font-mono"
              >
                <p className="text-neutral-455 dark:text-neutral-400 text-[10.5px] leading-relaxed mb-1 font-mono">
                  We have sent a verification code to:<br/>
                  <span className="text-neutral-850 dark:text-white font-bold tracking-wider font-mono">{country.code} {phone.slice(0,3)}••••{phone.slice(-3)}</span>
                </p>

                <div className="space-y-2 font-mono">
                  <div className="flex justify-between gap-1.5 text-center font-mono">
                    {otp.map((digit, i) => (
                      <div 
                        key={i} 
                        className={`w-10 h-11 rounded-xl border flex items-center justify-center bg-transparent overflow-hidden ${
                          digit 
                            ? "border-neutral-400 dark:border-white/35 bg-neutral-50 dark:bg-white/[0.04]" 
                            : "border-neutral-255 dark:border-neutral-800"
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
                          className="w-full h-full text-center text-[15px] font-bold bg-transparent text-neutral-850 dark:text-white outline-none placeholder:text-neutral-200 dark:placeholder:text-white/10 font-mono"
                          autoFocus={i === 0}
                          selectTextOnFocus
                        />
                      </div>
                    ))}
                  </div>
                  {errors.otp && (
                    <p className="text-[10px] font-bold text-red-500/90 text-center tracking-wide font-mono">{errors.otp}</p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || otp.join("").length < 6}
                  className="w-full h-12 text-[11px] tracking-[0.25em] font-bold uppercase rounded-[6px] bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-black/5 font-mono"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>VERIFY &rarr;</>
                  )}
                </button>

                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] pt-1 px-1 font-mono">
                  <button 
                    type="button" 
                    onClick={() => { setStep("PHONE"); setOtp(["", "", "", "", "", ""]); }}
                    className="text-neutral-450 dark:text-neutral-550 hover:text-neutral-900 dark:hover:text-white transition-colors font-mono"
                  >
                    Edit Phone
                  </button>
                  <button 
                    type="button" 
                    onClick={handleResendOTP} 
                    disabled={loading}
                    className="text-neutral-450 dark:text-neutral-550 hover:text-neutral-900 dark:hover:text-white transition-colors disabled:opacity-30 font-mono"
                  >
                    Resend OTP
                  </button>
                </div>
              </motion.form>
            )}

          </AnimatePresence>
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-[10px] font-semibold tracking-wide py-2.5 px-3 rounded-xl leading-normal border text-red-500 bg-red-500/5 border-red-500/10 mt-6"
          >
            {error}
          </motion.div>
        )}

      </main>

      {/* ─── FOOTER (Trust Badges & Footnotes) ─── */}
      <footer className="relative z-10 w-full max-w-[340px] flex flex-col items-center">
        
        {/* Trust Badges */}
        <div className="w-full grid grid-cols-3 gap-2 border-t border-neutral-150 dark:border-neutral-900 pt-6 mt-2">
          {/* SECURE Login */}
          <div className="flex flex-col items-center text-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center border border-neutral-200/60 dark:border-white/[0.04] bg-neutral-50/50 dark:bg-white/[0.01] mb-1 text-neutral-450 dark:text-neutral-550">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <span className="text-[8px] font-bold tracking-[0.18em] text-neutral-800 dark:text-neutral-200 uppercase leading-none">SECURE</span>
            <span className="text-[7.5px] font-light text-neutral-400 dark:text-neutral-500 mt-1 leading-none">Login</span>
          </div>
          
          {/* VERIFIED Safe & Fast */}
          <div className="flex flex-col items-center text-center border-x border-neutral-100 dark:border-neutral-900 px-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center border border-neutral-200/60 dark:border-white/[0.04] bg-neutral-50/50 dark:bg-white/[0.01] mb-1 text-neutral-450 dark:text-neutral-550">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-[8px] font-bold tracking-[0.18em] text-neutral-800 dark:text-neutral-200 uppercase leading-none">VERIFIED</span>
            <span className="text-[7.5px] font-light text-neutral-400 dark:text-neutral-500 mt-1 leading-none">Safe & Fast</span>
          </div>

          {/* PREMIUM Experience */}
          <div className="flex flex-col items-center text-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center border border-neutral-200/60 dark:border-white/[0.04] bg-neutral-50/50 dark:bg-white/[0.01] mb-1 text-neutral-450 dark:text-neutral-550">
              <Box className="w-3.5 h-3.5" />
            </div>
            <span className="text-[8px] font-bold tracking-[0.18em] text-neutral-800 dark:text-neutral-200 uppercase leading-none">PREMIUM</span>
            <span className="text-[7.5px] font-light text-neutral-400 dark:text-neutral-500 mt-1 leading-none">Experience</span>
          </div>
        </div>

        {/* Terms & Privacy Policies footnote */}
        <div className="flex flex-col items-center text-center mt-8 space-y-4 px-4 font-mono">
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[280px]">
            By continuing, you agree to our{" "}
            <Link href="/policies/terms-of-service" className="underline underline-offset-4 font-bold text-black dark:text-white">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link href="/policies/privacy-policy" className="underline underline-offset-4 font-bold text-black dark:text-white">
              Privacy Policies
            </Link>
            .
          </p>
          <span className="text-[6px] text-neutral-300 dark:text-white/10 font-bold uppercase tracking-[0.25em] pt-1">
            SECURED ARCHIVAL PROTOCOL v2.5
          </span>
        </div>

      </footer>

    </div>
  );
}
