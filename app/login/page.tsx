"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, ChevronDown, Search, ShieldCheck } from "lucide-react";
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
    <div className="login-page-root">
      {/* Subtle background texture lines (light mode) / dark gradient (dark mode) */}
      <div className="login-page-bg" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="login-card"
      >
        {/* Inner glass reflection */}
        <div className="login-card-reflection" />

        {/* ─── Brand Header ─── */}
        <div className="login-brand">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="login-logo-wrap"
          >
            <div className="login-logo">
              <Image src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain dark:invert" priority />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="login-brand-name"
          >
            ZICA BELLA
          </motion.h1>
        </div>

        {/* ─── Dynamic Multi-Step Forms ─── */}
        <div className="login-form-area">
          <AnimatePresence mode="wait">
            {/* ══════════ STEP 1: PHONE ══════════ */}
            {step === "PHONE" && (
              <motion.form
                key="phone-step"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleContinuePhone}
                className="login-step-form"
              >
                {/* Heading */}
                <div className="login-step-heading">
                  <h2 className="login-title">Welcome</h2>
                  <p className="login-subtitle">Continue with your mobile number</p>
                </div>

                {/* Phone Input Row */}
                <div className="login-input-group">
                  <div className={`login-phone-row ${errors.phone ? 'login-phone-row--error' : ''}`}>
                    {/* Country Code Selector */}
                    <div className="login-country-selector" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowPicker(!showPicker)}
                        className="login-country-btn"
                      >
                        <FlagBadge country={country} size="large" />
                        <span className="login-country-code">{country.code}</span>
                        <ChevronDown className={`login-chevron ${showPicker ? 'login-chevron--open' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.18 }}
                            className="login-dropdown"
                          >
                            <div className="login-dropdown-header">SELECT REGION</div>

                            {/* Search */}
                            <div className="login-dropdown-search">
                              <Search className="login-dropdown-search-icon" />
                              <input
                                type="text"
                                placeholder="Search country or code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="login-dropdown-search-input"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            </div>

                            {/* List */}
                            <div className="login-dropdown-list custom-scrollbar">
                              {filteredCountries.length === 0 ? (
                                <div className="login-dropdown-empty">No countries found</div>
                              ) : (
                                filteredCountries.map((c, idx) => (
                                  <button
                                    key={`${c.iso}-${idx}`}
                                    type="button"
                                    onClick={() => { setCountry(c); setShowPicker(false); setSearchQuery(""); }}
                                    className={`login-dropdown-item ${country.iso === c.iso ? 'login-dropdown-item--active' : ''}`}
                                  >
                                    <FlagBadge country={c} />
                                    <span className="login-dropdown-item-name">{c.name}</span>
                                    <span className="login-dropdown-item-code">{c.code}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Separator */}
                    <div className="login-phone-separator" />

                    {/* Phone Input */}
                    <input
                      type="tel"
                      placeholder="Enter Mobile Number"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="login-phone-input"
                      autoFocus
                      required
                    />
                  </div>
                  {errors.phone && <p className="login-field-error">{errors.phone}</p>}
                </div>

                {/* Security message */}
                <div className="login-security-msg">
                  <ShieldCheck className="login-security-icon" />
                  <span>We&apos;ll send a secure verification code to continue.</span>
                </div>

                {/* Continue Button */}
                <button
                  type="submit"
                  disabled={loading || phone.length < 7}
                  className="login-continue-btn"
                >
                  <span className="login-continue-text">
                    {loading ? <Loader2 className="login-spinner" /> : "Continue"}
                  </span>
                  {!loading && <ArrowRight className="login-continue-arrow" />}
                </button>

                {/* Terms */}
                <div className="login-terms">
                  <span>By continuing, you agree to our</span>
                  <span>
                    <a href="/policies/terms" className="login-terms-link">Terms &amp; Conditions</a>
                    {" "}and{" "}
                    <a href="/policies/privacy" className="login-terms-link">Privacy Policy</a>
                  </span>
                </div>
              </motion.form>
            )}

            {/* ══════════ STEP 2: NAME ══════════ */}
            {step === "NAME" && (
              <motion.form
                key="name-step"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleContinueName}
                className="login-step-form"
              >
                <div className="login-step-heading">
                  <h2 className="login-title">Welcome</h2>
                  <p className="login-subtitle">What&apos;s your name?</p>
                </div>

                <div className="login-input-group">
                  <div className={`login-name-row ${errors.name ? 'login-phone-row--error' : ''}`}>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({}); }}
                      className="login-name-input"
                      autoFocus
                      autoComplete="off"
                      required
                    />
                  </div>
                  {errors.name && <p className="login-field-error">{errors.name}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="login-continue-btn"
                >
                  <span className="login-continue-text">
                    {loading ? <Loader2 className="login-spinner" /> : "Create Account"}
                  </span>
                  {!loading && <ArrowRight className="login-continue-arrow" />}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("PHONE")}
                  className="login-back-btn"
                >
                  ← Back to Phone
                </button>
              </motion.form>
            )}

            {/* ══════════ STEP 3: OTP ══════════ */}
            {step === "OTP" && (
              <motion.form
                key="otp-step"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
                className="login-step-form"
              >
                <div className="login-step-heading" style={{ textAlign: 'center' }}>
                  <h2 className="login-title">Verify</h2>
                  <p className="login-subtitle">
                    Enter the code sent to<br />
                    <strong className="login-phone-display">{country.code} {phone.slice(0,3)}••••{phone.slice(-3)}</strong>
                  </p>
                </div>

                <div className="login-otp-group">
                  <div className="login-otp-boxes">
                    {otp.map((digit, i) => (
                      <div
                        key={i}
                        className={`login-otp-box ${digit ? 'login-otp-box--filled' : ''}`}
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
                          className="login-otp-input"
                          autoFocus={i === 0}
                        />
                      </div>
                    ))}
                  </div>
                  {errors.otp && <p className="login-field-error" style={{ textAlign: 'center' }}>{errors.otp}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join("").length < 6}
                  className="login-continue-btn"
                >
                  <span className="login-continue-text">
                    {loading ? <Loader2 className="login-spinner" /> : "Verify"}
                  </span>
                  {!loading && <ArrowRight className="login-continue-arrow" />}
                </button>

                <div className="login-otp-actions">
                  <button
                    type="button"
                    onClick={() => { setStep("PHONE"); setOtp(["", "", "", "", "", ""]); }}
                    className="login-otp-action-btn"
                  >
                    Edit Phone
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="login-otp-action-btn"
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
            className="login-error-banner"
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* ─── Scoped Styles ─── */}
      <style jsx global>{`
        /* =============================================
           LOGIN PAGE — SCOPED STYLES
           Light: elegant white/off-white glass
           Dark: premium pure black glass
           ============================================= */

        .login-page-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
        }

        /* ── Background ── */
        .login-page-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: 
            radial-gradient(ellipse at 30% 20%, rgba(245, 245, 247, 0.9) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 80%, rgba(232, 232, 237, 0.7) 0%, transparent 50%),
            linear-gradient(180deg, #fafafa 0%, #f2f2f5 50%, #eaeaef 100%);
        }

        .dark .login-page-bg {
          background:
            radial-gradient(ellipse at 30% 20%, rgba(20, 20, 30, 0.8) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 80%, rgba(10, 10, 18, 0.6) 0%, transparent 50%),
            linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000000 100%);
        }

        /* ── Card ── */
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          padding: 48px 32px 40px;
          border-radius: 36px;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow:
            0 0 0 0.5px rgba(255, 255, 255, 0.5) inset,
            0 20px 60px -10px rgba(0, 0, 0, 0.06),
            0 1px 3px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
          gap: 32px;
          overflow: hidden;
        }

        .dark .login-card {
          background: rgba(18, 18, 22, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 0 0 0.5px rgba(255, 255, 255, 0.06) inset,
            0 20px 60px -10px rgba(0, 0, 0, 0.6),
            0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .login-card-reflection {
          position: absolute;
          inset: 0;
          background: linear-gradient(165deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%);
          pointer-events: none;
          border-radius: 36px;
        }

        .dark .login-card-reflection {
          background: linear-gradient(165deg, rgba(255,255,255,0.04) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.01) 100%);
        }

        /* ── Brand ── */
        .login-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .login-logo-wrap {
          display: flex;
          justify-content: center;
        }

        .login-logo {
          position: relative;
          width: 64px;
          height: 64px;
        }

        .login-brand-name {
          font-family: 'Rocaston', -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.35em;
          color: #000;
          text-transform: uppercase;
        }

        .dark .login-brand-name {
          color: #fff;
        }

        /* ── Form Area ── */
        .login-form-area {
          display: flex;
          flex-direction: column;
        }

        .login-step-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Headings ── */
        .login-step-heading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .login-title {
          font-size: 32px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: #000;
          line-height: 1.2;
          font-family: 'Georgia', 'Times New Roman', serif;
        }

        .dark .login-title {
          color: #fff;
        }

        .login-subtitle {
          font-size: 14px;
          font-weight: 400;
          color: rgba(0, 0, 0, 0.45);
          line-height: 1.4;
        }

        .dark .login-subtitle {
          color: rgba(255, 255, 255, 0.45);
        }

        /* ── Input Group ── */
        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* ── Phone Row ── */
        .login-phone-row {
          display: flex;
          align-items: center;
          height: 56px;
          border-radius: 28px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 4px 4px 4px 16px;
          transition: all 0.25s ease;
          overflow: visible;
        }

        .dark .login-phone-row {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .login-phone-row:focus-within {
          border-color: rgba(0, 0, 0, 0.18);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
        }

        .dark .login-phone-row:focus-within {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
        }

        .login-phone-row--error {
          border-color: rgba(220, 38, 38, 0.5) !important;
        }

        /* ── Country Selector ── */
        .login-country-selector {
          position: relative;
          flex-shrink: 0;
        }

        .login-country-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 4px 6px 0;
          background: none;
          border: none;
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }

        .login-country-code {
          font-size: 15px;
          font-weight: 600;
          color: #000;
          letter-spacing: 0.02em;
        }

        .dark .login-country-code {
          color: #fff;
        }

        .login-chevron {
          width: 14px;
          height: 14px;
          color: rgba(0, 0, 0, 0.3);
          transition: transform 0.25s ease;
          flex-shrink: 0;
        }

        .dark .login-chevron {
          color: rgba(255, 255, 255, 0.3);
        }

        .login-chevron--open {
          transform: rotate(180deg);
        }

        /* ── Country Dropdown ── */
        .login-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: -16px;
          width: 280px;
          max-height: 320px;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .dark .login-dropdown {
          background: rgba(22, 22, 26, 0.97);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .login-dropdown-header {
          padding: 14px 18px 6px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(0, 0, 0, 0.3);
          text-transform: uppercase;
        }

        .dark .login-dropdown-header {
          color: rgba(255, 255, 255, 0.3);
        }

        .login-dropdown-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 14px 10px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.04);
        }

        .dark .login-dropdown-search {
          border-bottom-color: rgba(255, 255, 255, 0.06);
        }

        .login-dropdown-search-icon {
          width: 14px;
          height: 14px;
          color: rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .dark .login-dropdown-search-icon {
          color: rgba(255, 255, 255, 0.3);
        }

        .login-dropdown-search-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px !important;
          font-weight: 500;
          color: #000;
          outline: none;
        }

        .dark .login-dropdown-search-input {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .login-dropdown-search-input::placeholder {
          color: rgba(0, 0, 0, 0.3);
        }

        .dark .login-dropdown-search-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .login-dropdown-list {
          overflow-y: auto;
          max-height: 220px;
          padding: 4px 0;
        }

        .login-dropdown-empty {
          padding: 24px 18px;
          text-align: center;
          font-size: 12px;
          color: rgba(0, 0, 0, 0.35);
          font-weight: 500;
        }

        .dark .login-dropdown-empty {
          color: rgba(255, 255, 255, 0.35);
        }

        .login-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 18px;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .login-dropdown-item:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .dark .login-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .login-dropdown-item--active {
          background: rgba(0, 0, 0, 0.03);
        }

        .dark .login-dropdown-item--active {
          background: rgba(255, 255, 255, 0.04);
        }

        .login-dropdown-item-name {
          flex: 1;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(0, 0, 0, 0.7);
        }

        .dark .login-dropdown-item-name {
          color: rgba(255, 255, 255, 0.7);
        }

        .login-dropdown-item--active .login-dropdown-item-name {
          color: #000;
        }

        .dark .login-dropdown-item--active .login-dropdown-item-name {
          color: #fff;
        }

        .login-dropdown-item-code {
          font-size: 11px;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.3);
        }

        .dark .login-dropdown-item-code {
          color: rgba(255, 255, 255, 0.3);
        }

        /* ── Separator ── */
        .login-phone-separator {
          width: 1px;
          height: 24px;
          background: rgba(0, 0, 0, 0.1);
          margin: 0 12px;
          flex-shrink: 0;
        }

        .dark .login-phone-separator {
          background: rgba(255, 255, 255, 0.1);
        }

        /* ── Phone Input ── */
        .login-phone-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 15px !important;
          font-weight: 400;
          color: #000;
          letter-spacing: 0.01em;
          padding: 0;
          min-width: 0;
        }

        .dark .login-phone-input {
          color: #fff;
        }

        .login-phone-input::placeholder {
          color: rgba(0, 0, 0, 0.3);
          font-weight: 400;
        }

        .dark .login-phone-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        /* ── Name Row ── */
        .login-name-row {
          display: flex;
          align-items: center;
          height: 56px;
          border-radius: 28px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 4px 20px;
          transition: all 0.25s ease;
        }

        .dark .login-name-row {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .login-name-row:focus-within {
          border-color: rgba(0, 0, 0, 0.18);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
        }

        .dark .login-name-row:focus-within {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
        }

        .login-name-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 15px !important;
          font-weight: 500;
          color: #000;
          padding: 0;
        }

        .dark .login-name-input {
          color: #fff;
        }

        .login-name-input::placeholder {
          color: rgba(0, 0, 0, 0.3);
          font-weight: 400;
        }

        .dark .login-name-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        /* ── Security Message ── */
        .login-security-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 400;
          color: rgba(0, 0, 0, 0.5);
          padding: 0 4px;
        }

        .dark .login-security-msg {
          color: rgba(255, 255, 255, 0.45);
        }

        .login-security-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          color: rgba(0, 0, 0, 0.4);
        }

        .dark .login-security-icon {
          color: rgba(255, 255, 255, 0.4);
        }

        /* ── Continue Button ── */
        .login-continue-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 100%;
          height: 56px;
          border-radius: 28px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          cursor: pointer;
          position: relative;
          transition: all 0.25s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .dark .login-continue-btn {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .login-continue-btn:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.07);
          border-color: rgba(0, 0, 0, 0.12);
        }

        .dark .login-continue-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .login-continue-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .login-continue-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          pointer-events: none;
        }

        .login-continue-text {
          font-size: 16px;
          font-weight: 500;
          color: #000;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
        }

        .dark .login-continue-text {
          color: #fff;
        }

        .login-continue-arrow {
          width: 20px;
          height: 20px;
          color: #000;
          position: absolute;
          right: 20px;
        }

        .dark .login-continue-arrow {
          color: #fff;
        }

        .login-spinner {
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Terms ── */
        .login-terms {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          font-weight: 400;
          color: rgba(0, 0, 0, 0.4);
          text-align: center;
          line-height: 1.5;
        }

        .dark .login-terms {
          color: rgba(255, 255, 255, 0.4);
        }

        .login-terms-link {
          color: #000;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 500;
          transition: opacity 0.2s;
        }

        .dark .login-terms-link {
          color: #fff;
        }

        .login-terms-link:hover {
          opacity: 0.7;
        }

        /* ── Field Error ── */
        .login-field-error {
          font-size: 11px;
          font-weight: 600;
          color: #dc2626;
          padding-left: 16px;
          margin: 0;
        }

        /* ── Back Button ── */
        .login-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.4);
          transition: color 0.2s;
          padding: 8px;
          -webkit-tap-highlight-color: transparent;
        }

        .dark .login-back-btn {
          color: rgba(255, 255, 255, 0.4);
        }

        .login-back-btn:hover {
          color: #000;
        }

        .dark .login-back-btn:hover {
          color: #fff;
        }

        /* ── OTP ── */
        .login-otp-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-otp-boxes {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .login-otp-box {
          width: 48px;
          height: 52px;
          border-radius: 14px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background: rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .dark .login-otp-box {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .login-otp-box--filled {
          border-color: #000;
        }

        .dark .login-otp-box--filled {
          border-color: #fff;
        }

        .login-otp-input {
          width: 100%;
          height: 100%;
          text-align: center;
          font-size: 18px !important;
          font-weight: 700;
          background: transparent;
          border: none;
          outline: none;
          color: #000;
          padding: 0;
        }

        .dark .login-otp-input {
          color: #fff;
        }

        .login-otp-input::placeholder {
          color: rgba(0, 0, 0, 0.12);
        }

        .dark .login-otp-input::placeholder {
          color: rgba(255, 255, 255, 0.12);
        }

        .login-otp-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
        }

        .login-otp-action-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(0, 0, 0, 0.4);
          transition: color 0.2s;
          padding: 6px 2px;
          -webkit-tap-highlight-color: transparent;
        }

        .dark .login-otp-action-btn {
          color: rgba(255, 255, 255, 0.4);
        }

        .login-otp-action-btn:hover {
          color: #000;
        }

        .dark .login-otp-action-btn:hover {
          color: #fff;
        }

        .login-otp-action-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .login-phone-display {
          color: #000;
          font-weight: 600;
        }

        .dark .login-phone-display {
          color: #fff;
        }

        /* ── Error Banner ── */
        .login-error-banner {
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          padding: 10px 16px;
          border-radius: 14px;
          color: #dc2626;
          background: rgba(220, 38, 38, 0.06);
          border: 1px solid rgba(220, 38, 38, 0.12);
        }

        .dark .login-error-banner {
          background: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.15);
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .login-card {
            padding: 40px 24px 32px;
            border-radius: 28px;
            max-width: 100%;
          }

          .login-title {
            font-size: 28px;
          }

          .login-dropdown {
            width: 260px;
            left: -12px;
          }
        }
      `}</style>
    </div>
  );
}
