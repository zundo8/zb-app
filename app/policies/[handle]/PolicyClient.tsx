"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  ChevronDown, 
  ShieldCheck, 
  BadgeCheck, 
  Gem, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Info, 
  FileText, 
  Globe 
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
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const bgImage = isMobile
    ? (isDark ? (bgDarkMobile || bgDark || "/load-image-2.jpg") : (bgLightMobile || bgLight || "/load-image-2.jpg"))
    : (isDark ? (bgDark || "/load-image-2.jpg") : (bgLight || "/load-image-2.jpg"));

  const parseAndFormatPolicyContent = (content: string) => {
    const trimmedContent = content.trim();

    if (trimmedContent.startsWith("<")) {
      return <div className="font-light leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />;
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
                  <span className="text-xs md:text-sm font-semibold text-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-line break-words">{card.value}</span>
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

      if (isAllKeyValue && lines.length > 0) {
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
                <li key={lIdx} className="flex items-start gap-3 text-xs md:text-sm text-foreground/70 dark:text-white/70 leading-[1.7]">
                  <span className="mt-2.5 w-1.2 h-1.2 rounded-full bg-foreground/30 dark:bg-white/30 shrink-0" />
                  <span className="flex-1 font-light">{itemText}</span>
                </li>
              );
            })}
          </ul>
        );
        return;
      }

      const isMarkdownSubheading = trimmedBlock.startsWith("##") || trimmedBlock.startsWith("###") || trimmedBlock.startsWith("####");
      const isHeading = isMarkdownSubheading || (trimmedBlock.length < 60 && !trimmedBlock.endsWith(".") && !trimmedBlock.endsWith(":") && lines.length === 1);
      
      if (isHeading) {
        const headingText = trimmedBlock.replace(/^#+\s*/, "").trim();
        elements.push(
          <div key={idx} className="space-y-2 pt-6 border-b border-foreground/[0.06] dark:border-white/[0.06] pb-2 my-4">
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-[0.25em] text-foreground/90 dark:text-white/90">
              {headingText}
            </h2>
          </div>
        );
        return;
      }

      const cleanBlock = trimmedBlock.replace(/\*\*/g, "");
      elements.push(
        <p key={idx} className="text-xs md:text-sm text-foreground/60 dark:text-white/70 leading-[1.85] font-light whitespace-pre-line my-4">
          {cleanBlock}
        </p>
      );
    });

    flushGrid("end");
    return <div className="space-y-5">{elements}</div>;
  };

  return (
    <div className="zb-login-root">
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
        <div className="zb-login-form-section mt-6">
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

          {/* Minimal Dropdown Selector (matches country selector style) */}
          <div className="zb-login-tab mt-6 pb-2" ref={dropdownRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2 py-2 px-3 rounded-xl bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/10 dark:border-white/10 transition-colors hover:bg-foreground/[0.06] dark:hover:bg-white/[0.06]"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground dark:text-white">
                  {activePolicy.title.replace(/\s*\(.*\)\s*/, "")}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/45 transition-transform duration-250 ${showPicker ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="zb-login-cc-dropdown w-64"
                    style={{ bottom: "auto", top: "calc(100% + 8px)" }}
                  >
                    {allPolicies.map((p) => (
                      <button
                        key={p.handle}
                        type="button"
                        onClick={() => {
                          setShowPicker(false);
                          router.push(`/policies/${p.handle}`);
                        }}
                        className={`zb-login-cc-item py-3 ${activePolicy.handle === p.handle ? "zb-login-cc-item--active font-bold" : ""}`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-left">
                          {p.title.replace(/\s*\(.*\)\s*/, "")}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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

        {/* ─── Bottom Section: Trust Row & Copyright ─── */}
        <div className="zb-login-form-section mt-auto">
          {/* Trust Badges */}
          <div className="zb-login-trust-row border-t border-foreground/5 dark:border-white/5 pt-6">
            <div className="zb-login-trust-item">
              <ShieldCheck className="zb-login-trust-icon" />
              <div>
                <span className="zb-login-trust-label">SECURE</span>
                <span className="zb-login-trust-sub">Browse</span>
              </div>
            </div>
            <div className="zb-login-trust-item">
              <BadgeCheck className="zb-login-trust-icon" />
              <div>
                <span className="zb-login-trust-label">OFFICIAL</span>
                <span className="zb-login-trust-sub">Zica Bella Page</span>
              </div>
            </div>
            <div className="zb-login-trust-item">
              <Gem className="zb-login-trust-icon" />
              <div>
                <span className="zb-login-trust-label">PREMIUM</span>
                <span className="zb-login-trust-sub">Legal Terms</span>
              </div>
            </div>
          </div>

          {/* Copyright and policy links */}
          <div className="zb-login-policies border-t border-foreground/5 dark:border-white/5 pt-6 pb-2">
            <a href="/" className="zb-login-policy-link">Home</a>
            <span className="zb-login-policy-dot">•</span>
            <a href="/support" className="zb-login-policy-link">Support Center</a>
          </div>

          <div className="text-center pb-4 mt-2">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.3em] text-foreground/15 dark:text-white/20">
              © 2026 Zica Bella · Luxury Streetwear · Designed in Italy · Crafted in India
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
