"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  ChevronDown, 
  ShieldCheck, 
  BadgeCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Info, 
  FileText, 
  Globe,
  CheckCircle2,
  X
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

interface Policy {
  handle: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface PolicyClientProps {
  activePolicy: Policy;
  allPolicies: { handle: string; title: string }[];
}

function getIconForLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("email")) return <Mail className="w-3.5 h-3.5" />;
  if (l.includes("address") || l.includes("location") || l.includes("physical") || l.includes("office")) return <MapPin className="w-3.5 h-3.5" />;
  if (l.includes("phone") || l.includes("call") || l.includes("contact") || l.includes("support")) return <Phone className="w-3.5 h-3.5" />;
  if (l.includes("hours") || l.includes("time") || l.includes("days")) return <Clock className="w-3.5 h-3.5" />;
  if (l.includes("name") || l.includes("trade") || l.includes("company")) return <Info className="w-3.5 h-3.5" />;
  if (l.includes("social") || l.includes("instagram") || l.includes("youtube")) return <Globe className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function getPolicyIcon(handle: string) {
  switch (handle) {
    case "about-us":
      return <Info className="w-4 h-4" />;
    case "contact-information":
      return <Phone className="w-4 h-4" />;
    case "privacy-policy":
      return <ShieldCheck className="w-4 h-4" />;
    case "refund-policy":
      return <BadgeCheck className="w-4 h-4" />;
    case "shipping-policy":
      return <Clock className="w-4 h-4" />;
    case "terms-of-service":
      return <FileText className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

export default function PolicyClient({ activePolicy, allPolicies }: PolicyClientProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Background image state matching login page
  const [bgLight, setBgLight] = useState("");
  const [bgDark, setBgDark] = useState("");
  const [bgLightMobile, setBgLightMobile] = useState("");
  const [bgDarkMobile, setBgDarkMobile] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetch("/api/app/settings")
      .then(r => r.json())
      .then(data => {
        if (data.loginBgImageLight) setBgLight(data.loginBgImageLight);
        if (data.loginBgImageDark) setBgDark(data.loginBgImageDark);
        if (data.loginBgImageLightMobile) setBgLightMobile(data.loginBgImageLightMobile);
        if (data.loginBgImageDarkMobile) setBgDarkMobile(data.loginBgImageDarkMobile);
        if (!data.loginBgImageLight && data.loginBgImage) setBgLight(data.loginBgImage);
        if (!data.loginBgImageDark && data.loginBgImage) setBgDark(data.loginBgImage);
        if (!data.loginBgImageLightMobile && data.loginBgImageMobile) setBgLightMobile(data.loginBgImageMobile);
        if (!data.loginBgImageDarkMobile && data.loginBgImageMobile) setBgDarkMobile(data.loginBgImageMobile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      // Don't interfere — the modal overlay handles its own dismissal via onClick
      if (showPicker) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPicker]);

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const bgImage = isMobile
    ? (isDark ? (bgDarkMobile || bgDark || "/load-image-2.jpg") : (bgLightMobile || bgLight || "/load-image-2.jpg"))
    : (isDark ? (bgDark || "/load-image-2.jpg") : (bgLight || "/load-image-2.jpg"));

  const renderFormattedInlineText = (text: string) => {
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^([\s\S]*?)(\*\*|__)(.*?)\2([\s\S]*)$/);
      if (boldMatch) {
        const [, prefix, , boldText, rest] = boldMatch;
        if (prefix) tokens.push(<span key={key++}>{prefix}</span>);
        tokens.push(
          <strong key={key++} className="font-semibold text-foreground dark:text-white">
            {boldText}
          </strong>
        );
        remaining = rest;
        continue;
      }

      const italicMatch = remaining.match(/^([\s\S]*?)(\*|_)(.*?)\2([\s\S]*)$/);
      if (italicMatch) {
        const [, prefix, , italicText, rest] = italicMatch;
        if (prefix) tokens.push(<span key={key++}>{prefix}</span>);
        tokens.push(
          <em key={key++} className="italic text-foreground/90 dark:text-white/90">
            {italicText}
          </em>
        );
        remaining = rest;
        continue;
      }

      tokens.push(<span key={key++}>{remaining}</span>);
      break;
    }

    return <>{tokens}</>;
  };

  const parseAndFormatPolicyContent = (content: string) => {
    const trimmedContent = content.trim();

    if (trimmedContent.startsWith("<")) {
      return <div className="font-light leading-relaxed text-xs md:text-sm text-foreground/80 dark:text-white/80 font-sans" dangerouslySetInnerHTML={{ __html: content }} />;
    }

    const blocks = content.split(/\r?\n\r?\n/);
    const elements: React.ReactNode[] = [];
    let currentCardGrid: { label: string; value: string }[] = [];

    const flushGrid = (key: string | number) => {
      if (currentCardGrid.length > 0) {
        elements.push(
          <div key={`grid-${key}`} className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            {currentCardGrid.map((card, cIdx) => (
              <div 
                key={cIdx} 
                className="flex items-start gap-4 p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 dark:bg-white/[0.02] dark:border-white/10 shadow-sm transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/[0.05] dark:bg-white/[0.03] dark:border-white/[0.05] text-foreground/60 dark:text-white/60 shrink-0 flex items-center justify-center">
                  {getIconForLabel(card.label)}
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-[8.5px] font-bold text-foreground/35 dark:text-white/35 uppercase tracking-[0.25em]">{card.label}</span>
                  <span className="text-xs md:text-sm font-semibold text-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-line break-words">{renderFormattedInlineText(card.value)}</span>
                </div>
              </div>
            ))}
          </div>
        );
        currentCardGrid = [];
      }
    };

    blocks.forEach((block, idx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return;

      const lines = trimmedBlock.split("\n").map(l => l.trim());

      if (lines[0].endsWith(":") && lines.length > 1) {
        const label = lines[0].slice(0, -1).trim();
        const value = lines.slice(1).join("\n").trim();
        currentCardGrid.push({ label, value });
        return;
      }

      const isAllKeyValue = lines.every(line => {
        const colonIdx = line.indexOf(":");
        return colonIdx > 0 && colonIdx < 30;
      });

      if (isAllKeyValue && lines.length > 0 && !lines.some(l => l.startsWith("-") || l.startsWith("*") || l.startsWith("#"))) {
        lines.forEach(line => {
          const colonIdx = line.indexOf(":");
          const label = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          currentCardGrid.push({ label, value });
        });
        return;
      }

      flushGrid(idx);

      const isList = lines.every(line => line.startsWith("-") || line.startsWith("*") || line.startsWith("•"));
      if (isList) {
        elements.push(
          <ul key={idx} className="space-y-3.5 pl-1.5 my-6">
            {lines.map((line, lIdx) => {
              const itemText = line.replace(/^[-*•]\s*/, "").trim();
              return (
                <li key={lIdx} className="flex items-start gap-3 text-xs md:text-sm text-foreground/80 dark:text-white/80 leading-[1.75]">
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground/40 dark:bg-white/40 shrink-0" />
                  <span className="flex-1 font-light">{renderFormattedInlineText(itemText)}</span>
                </li>
              );
            })}
          </ul>
        );
        return;
      }

      if (trimmedBlock.startsWith("# ")) {
        const titleText = trimmedBlock.replace(/^#\s*/, "").trim();
        elements.push(
          <div key={idx} className="pt-4 pb-2 my-4 border-b border-foreground/10 dark:border-white/10">
            <h1 className="text-sm md:text-base font-bold uppercase tracking-[0.2em] text-foreground dark:text-white font-poppins">
              {titleText}
            </h1>
          </div>
        );
        return;
      }

      if (trimmedBlock.startsWith("## ")) {
        const titleText = trimmedBlock.replace(/^##\s*/, "").trim();
        elements.push(
          <div key={idx} className="pt-6 pb-2 my-4 border-b border-foreground/10 dark:border-white/10">
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-foreground dark:text-white font-poppins">
              {titleText}
            </h2>
          </div>
        );
        return;
      }

      if (trimmedBlock.startsWith("### ") || trimmedBlock.startsWith("#### ")) {
        const titleText = trimmedBlock.replace(/^#+\s*/, "").trim();
        elements.push(
          <div key={idx} className="pt-4 my-2">
            <h3 className="text-xs md:text-sm font-semibold uppercase tracking-[0.15em] text-foreground/90 dark:text-white/90 font-poppins">
              {titleText}
            </h3>
          </div>
        );
        return;
      }

      const isShortHeading = trimmedBlock.length < 50 && !trimmedBlock.endsWith(".") && !trimmedBlock.endsWith(":") && lines.length === 1;
      if (isShortHeading) {
        elements.push(
          <div key={idx} className="pt-4 pb-1 my-3 border-b border-foreground/[0.08] dark:border-white/[0.08]">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-foreground dark:text-white font-poppins">
              {trimmedBlock}
            </h3>
          </div>
        );
        return;
      }

      elements.push(
        <p key={idx} className="text-xs md:text-sm text-foreground/75 dark:text-white/80 leading-[1.85] font-light whitespace-pre-line my-4 font-sans">
          {renderFormattedInlineText(trimmedBlock)}
        </p>
      );
    });

    flushGrid("end");
    return <div className="space-y-5">{elements}</div>;
  };

  const DEFAULT_POLICIES_FALLBACK = [
    { handle: "about-us", title: "About Us" },
    { handle: "contact-information", title: "Contact Information" },
    { handle: "privacy-policy", title: "Privacy Policy" },
    { handle: "refund-policy", title: "Refund Policy" },
    { handle: "shipping-policy", title: "Shipping Policy" },
    { handle: "terms-of-service", title: "Terms of Service" },
  ];

  const policyMap = new Map<string, { handle: string; title: string }>();
  DEFAULT_POLICIES_FALLBACK.forEach(p => policyMap.set(p.handle, p));
  (allPolicies || []).forEach(p => policyMap.set(p.handle, { handle: p.handle, title: p.title }));
  const effectivePolicies = Array.from(policyMap.values());

  const handleSelectPolicy = (handle: string) => {
    setShowPicker(false);
    router.push(`/policies/${handle}`);
  };

  return (
    <div className={`zb-login-root ${!isDark ? 'light' : ''}`}>
      <div className="zb-login-container max-w-4xl mx-auto w-full flex flex-col justify-between">
        
        {/* Ken Burns Background Animation */}
        <div className="zb-login-hero-wrap">
          {bgImage && (
            <motion.img
              key={bgImage}
              src={bgImage}
              alt=""
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ 
                scale: [1.05, 1.12, 1.05],
                opacity: 1
              }}
              transition={{
                scale: {
                  duration: 25,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut"
                },
                opacity: { duration: 0.8 }
              }}
              className="zb-login-hero-img"
            />
          )}
          {/* Glow Orb */}
          <div 
            className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full blur-[80px] pointer-events-none mix-blend-screen opacity-60 dark:opacity-40 animate-pulse" 
            style={{ 
              background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, rgba(120,40,200,0.05) 50%, transparent 100%)',
              animationDuration: '8s'
            }} 
          />
          <div className="zb-login-hero-overlay" />
        </div>

        {/* ─── Header: Brand Title & Document Details ─── */}
        <div className="zb-login-form-section mt-6 relative z-30">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zb-login-hero-text"
          >
            <h1 className="zb-login-hero-title">
              legal<br />
              <em className="text-foreground/75 italic">{activePolicy.title.replace(/\s*\(.*\)\s*/, "").toLowerCase()}.</em>
            </h1>
            <p className="text-[8.5px] uppercase tracking-[0.2em] font-semibold text-foreground/35 dark:text-white/35 mt-2">
              Last Updated: {new Date(activePolicy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </motion.div>

          {/* Dropdown Selector Trigger */}
          <div className="zb-login-tab mt-6 pb-2" ref={dropdownRef}>
            <div className="relative z-30">
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2.5 py-2.5 px-4 rounded-xl bg-foreground/[0.04] dark:bg-white/[0.05] border border-foreground/10 dark:border-white/15 transition-all hover:bg-foreground/[0.08] dark:hover:bg-white/[0.1] active:scale-95 shadow-sm"
              >
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground dark:text-white font-poppins">
                  {activePolicy.title.replace(/\s*\(.*\)\s*/, "")}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/50 dark:text-white/50 transition-transform duration-300 ${showPicker ? "rotate-180" : ""}`} />
              </button>

              {/* Modal rendered via portal at document.body to escape all stacking contexts */}
              {mounted && showPicker && createPortal(
                <AnimatePresence>
                  <div 
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
                    style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                    onMouseDown={(e) => { e.stopPropagation(); setShowPicker(false); }}
                    onTouchStart={(e) => { e.stopPropagation(); }}
                    onClick={() => setShowPicker(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 12 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden p-3 relative"
                      style={{
                        backgroundColor: isDark ? "#121216" : "#ffffff",
                        color: isDark ? "#ffffff" : "#000000",
                        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                        zIndex: 100000,
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2.5 mb-2" style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)" }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>
                          Select Policy Page
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPicker(false)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Policy Options */}
                      <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
                        {effectivePolicies.map((p) => {
                          const isActive = activePolicy.handle === p.handle;
                          const icon = getPolicyIcon(p.handle);
                          return (
                            <button
                              key={p.handle}
                              type="button"
                              onClick={() => {
                                setShowPicker(false);
                                router.push(`/policies/${p.handle}`);
                              }}
                              className="flex items-center justify-between w-full p-3 rounded-xl transition-all text-left cursor-pointer"
                              style={{
                                backgroundColor: isActive
                                  ? (isDark ? "#ffffff" : "#000000")
                                  : "transparent",
                                color: isActive
                                  ? (isDark ? "#000000" : "#ffffff")
                                  : (isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)"),
                                fontWeight: isActive ? 800 : 600,
                                boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="p-2 rounded-lg"
                                  style={{
                                    backgroundColor: isActive
                                      ? (isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)")
                                      : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                                    color: isActive
                                      ? (isDark ? "#000000" : "#ffffff")
                                      : (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"),
                                  }}
                                >
                                  {icon}
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em]">
                                  {p.title.replace(/\s*\(.*\)\s*/, "")}
                                </span>
                              </div>
                              {isActive && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                </AnimatePresence>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* ─── Policy Core Content Redesign ─── */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="zb-login-form-section my-10 relative z-10"
        >
          {parseAndFormatPolicyContent(activePolicy.content)}

          {/* Quick Support Link Block */}
          <div className="mt-12 p-6 rounded-2xl bg-foreground/[0.02] border border-foreground/10 dark:bg-white/[0.02] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground dark:text-white">Need help or clarification?</h4>
              <p className="text-[8.5px] text-foreground/45 dark:text-white/45 uppercase tracking-[0.1em] mt-1">Get in touch with our client support center.</p>
            </div>
            <Link 
              href="/support"
              className="px-6 py-2.5 rounded-full bg-foreground dark:bg-white text-background dark:text-black hover:opacity-90 active:scale-95 text-[9px] font-bold tracking-[0.2em] uppercase transition-all shadow-md shrink-0"
            >
              Contact Support
            </Link>
          </div>
        </motion.div>

        {/* Minimal Bottom Padding */}
        <div className="w-full pt-10 pb-6 mt-auto" />

      </div>
    </div>
  );
}
