"use client";

import { useState } from "react";
import { 
  Instagram, 
  Youtube, 
  Info, 
  RotateCcw, 
  Mail, 
  FileText, 
  Truck, 
  Lock, 
  HelpCircle, 
  RefreshCw, 
  MapPin, 
  CreditCard, 
  ChevronDown, 
  ChevronUp, 
  Search
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ThreeDLogo from "./ThreeDLogo";
import LazyVideo from "./LazyVideo";

interface Policy {
  handle: string;
  title: string;
}

interface Shop {
  domain: string;
  instagramUrl?: string;
  appleUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  footerLogo3dUrl?: string;
  footerVideo?: string;
}

interface StorefrontFooterClientProps {
  shop: Shop | null;
  policies: Policy[];
}

export default function StorefrontFooterClient({ shop, policies }: StorefrontFooterClientProps) {
  // Mobile accordion states
  const [shopOpen, setShopOpen] = useState(false);
  const [customerCareOpen, setCustomerCareOpen] = useState(true); // Default open as shown in reference image
  const [supportOpen, setSupportOpen] = useState(false);

  // Newsletter state
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      toast.success("Thank you for joining our newsletter!", {
        description: "You have successfully subscribed to the Zica Bella newsletter.",
      });
      setEmail("");
    }
  };

  // Helper to find policies dynamically
  const findPolicyPath = (keyword: string, fallback: string) => {
    const match = policies.find(
      (p) => p.title.toLowerCase().includes(keyword) || p.handle.toLowerCase().includes(keyword)
    );
    return match ? `/policies/${match.handle}` : fallback;
  };

  // Shorten policy titles for bottom lists
  const shortenPolicyTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("privacy")) return "Privacy";
    if (t.includes("terms") || t.includes("condition")) return "Terms";
    if (t.includes("refund") || t.includes("return") || t.includes("cancellation")) return "Returns";
    if (t.includes("shipping") || t.includes("delivery")) return "Shipping";
    return title.replace(/Policy/gi, "").trim();
  };

  // Fallbacks for URLs
  const instagramUrl = shop?.instagramUrl || "https://www.instagram.com/zica.bella";
  const spotifyUrl = shop?.spotifyUrl || "https://open.spotify.com";
  const appleUrl = shop?.appleUrl || "https://music.apple.com";
  const youtubeUrl = shop?.youtubeUrl || "https://www.youtube.com/@Zicabella";

  const socialLinks = [
    { url: instagramUrl, icon: Instagram, label: "Instagram" },
    { url: appleUrl,     icon: Music2Icon, label: "Apple Music" },
    { url: spotifyUrl,   icon: SpotifyIcon, label: "Spotify" },
    { url: youtubeUrl,   icon: Youtube,   label: "YouTube" },
  ];

  return (
    <footer className="w-full relative z-10 bg-white dark:bg-black" aria-label="Storefront Footer">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      {/* ─── DESKTOP (md+) ─── */}
      <div className="hidden md:block max-w-7xl mx-auto px-8 py-24">
        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* Brand Info (5 Columns) */}
          <div className="col-span-5 space-y-6">
            <div className="flex flex-col items-start gap-4">
              <ThreeDLogo src={shop?.footerLogo3dUrl} size={36} />
              <h2 className="font-rocaston text-[9px] tracking-[0.18em] text-foreground font-light uppercase leading-none">ZICABELLA</h2>
            </div>

            <p className="text-[10px] font-normal text-foreground/35 leading-[2] tracking-wider max-w-xs">
              Redefining everyday boldness through meticulous engineering, premium textiles, and modern architectural standards. Designed in Italy, crafted in India.
            </p>

            {/* Footer video - clean layout */}
            {shop?.footerVideo && (
              <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden group border border-foreground/[0.04] shadow-md bg-foreground/[0.01] max-w-xs">
                <LazyVideo src={shop.footerVideo} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
              </div>
            )}
          </div>

          {/* Discover Column (2 Columns) */}
          <div className="col-span-2 space-y-4 pt-2">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Discover</h3>
            <ul className="space-y-3">
              {[
                { href: "/search", label: "Catalog" },
                { href: "/collections", label: "Collections" },
                { href: "/blogs", label: "Journal" },
                { href: "/wishlist", label: "Wishlist" },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[9.5px] font-normal tracking-[0.12em] uppercase text-foreground/45 hover:text-foreground transition-all duration-300 hover:translate-x-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Column (2 Columns) */}
          <div className="col-span-2 space-y-4 pt-2">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Account</h3>
            <ul className="space-y-3">
              {[
                { href: "/profile", label: "Profile" },
                { href: "/orders", label: "Orders" },
                { href: "/cart", label: "Bag" },
                { href: "/support", label: "Support" },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[9.5px] font-normal tracking-[0.12em] uppercase text-foreground/45 hover:text-foreground transition-all duration-300 hover:translate-x-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect Column (3 Columns) */}
          <div className="col-span-3 space-y-4 pt-2 flex flex-col items-start">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Connect</h3>
            <div className="flex flex-col gap-2.5 w-full">
              {socialLinks.map(({ url, icon: Icon, label }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center justify-between text-foreground/45 hover:text-foreground transition-all duration-300 w-full max-w-[140px] py-1 border-b border-foreground/5 hover:border-foreground/10"
                >
                  <span className="text-[9.5px] font-normal tracking-[0.12em] uppercase">{label}</span>
                  <Icon className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom bar with Copyright & Policies */}
        <div className="mt-20 pt-8 border-t border-foreground/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-foreground/15">
              © {new Date().getFullYear()} ZICABELLA · ALL RIGHTS RESERVED
            </p>
            {policies.map((policy) => (
              <Link 
                key={policy.handle} 
                href={`/policies/${policy.handle}`}
                className="text-[8px] font-bold uppercase tracking-[0.25em] text-foreground/30 hover:text-foreground/80 transition-colors"
              >
                {shortenPolicyTitle(policy.title)}
              </Link>
            ))}
          </div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-foreground/15">
            DESIGNED IN ITALY · CRAFTED IN INDIA
          </p>
        </div>
      </div>

      {/* ─── MOBILE (below md) ─── */}
      <div className="md:hidden px-5 pt-12 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center">
        
        {/* Brand Header: Logo stacked — 3D on top, text below */}
        <div className="flex flex-col items-center gap-8 mb-6 text-center">
          <ThreeDLogo src={shop?.footerLogo3dUrl} size={48} />
          <h2 className="font-rocaston text-[13px] tracking-[0.22em] text-foreground uppercase leading-none font-bold">ZICABELLA</h2>
        </div>

        {/* Premium Minimal Social Row */}
        <div className="flex justify-center gap-4 mb-8">
          {/* Instagram */}
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
            className="w-8 h-8 rounded-full border border-foreground/[0.08] dark:border-white/10 flex items-center justify-center text-foreground/50 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-all bg-foreground/[0.01] dark:bg-white/[0.01] hover:border-foreground/20 dark:hover:border-white/20 active:scale-90 shadow-none">
            <Instagram className="w-4 h-4" />
          </a>
          
          {/* Spotify */}
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Spotify"
            className="w-8 h-8 rounded-full border border-foreground/[0.08] dark:border-white/10 flex items-center justify-center text-foreground/50 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-all bg-foreground/[0.01] dark:bg-white/[0.01] hover:border-foreground/20 dark:hover:border-white/20 active:scale-90 shadow-none">
            <SpotifyIcon className="w-4 h-4" />
          </a>

          {/* Apple Music */}
          <a href={appleUrl} target="_blank" rel="noopener noreferrer" aria-label="Apple Music"
            className="w-8 h-8 rounded-full border border-foreground/[0.08] dark:border-white/10 flex items-center justify-center text-foreground/50 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-all bg-foreground/[0.01] dark:bg-white/[0.01] hover:border-foreground/20 dark:hover:border-white/20 active:scale-90 shadow-none">
            <Music2Icon className="w-4 h-4" />
          </a>

          {/* YouTube */}
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
            className="w-8 h-8 rounded-full border border-foreground/[0.08] dark:border-white/10 flex items-center justify-center text-foreground/50 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-all bg-foreground/[0.01] dark:bg-white/[0.01] hover:border-foreground/20 dark:hover:border-white/20 active:scale-90 shadow-none">
            <Youtube className="w-4 h-4" />
          </a>
        </div>

        {/* Accordions & Newsletter Container */}
        <div className="w-full max-w-md space-y-4">
          
          {/* Panel 1: SHOP (Collapsible) */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-gray-100 dark:border-white/[0.04] rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-colors overflow-hidden">
            <button 
              onClick={() => setShopOpen(!shopOpen)}
              className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground">
                SHOP
              </span>
              {shopOpen ? <ChevronUp className="w-4 h-4 text-foreground/50" /> : <ChevronDown className="w-4 h-4 text-foreground/50" />}
            </button>
            
            <AnimatePresence initial={false}>
              {shopOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0">
                    <div className="h-px w-full bg-gray-50 dark:bg-white/[0.02] mb-3" />
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] font-semibold text-foreground/60">
                      <Link href="/collections" className="hover:text-foreground transition-colors">Collections</Link>
                      <Link href="/blogs" className="hover:text-foreground transition-colors">Journal</Link>
                      <Link href="/profile" className="hover:text-foreground transition-colors">Account</Link>
                      <Link href="/support" className="hover:text-foreground transition-colors">Help</Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Panel 2: CUSTOMER CARE (Collapsible, Expanded by Default) */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-gray-100 dark:border-white/[0.04] rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-colors overflow-hidden">
            <button 
              onClick={() => setCustomerCareOpen(!customerCareOpen)}
              className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground">
                CUSTOMER CARE
              </span>
              {customerCareOpen ? <ChevronUp className="w-4 h-4 text-foreground/50" /> : <ChevronDown className="w-4 h-4 text-foreground/50" />}
            </button>
            
            <AnimatePresence initial={false}>
              {customerCareOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0">
                    <div className="h-px w-full bg-gray-50 dark:bg-white/[0.02] mb-4" />
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      {/* Column 1 */}
                      <div className="space-y-4">
                        <Link href={findPolicyPath("about", "/policies/about-us")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            About Us
                          </span>
                        </Link>

                        <Link href="/support" className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Contact
                          </span>
                        </Link>

                        <Link href={findPolicyPath("contact-information", "/policies/contact-information")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Contact Information
                          </span>
                        </Link>

                        <Link href={findPolicyPath("shipping", "/policies/shipping-policy")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Shipping Policy
                          </span>
                        </Link>
                      </div>

                      {/* Column 2 */}
                      <div className="space-y-4">
                        <Link href="/portal/login" className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Returns
                          </span>
                        </Link>

                        <Link href={findPolicyPath("terms", "/policies/terms-of-service")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Terms of Service
                          </span>
                        </Link>

                        <Link href={findPolicyPath("privacy", "/policies/privacy-policy")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Privacy Policy
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Panel 3: SUPPORT (Collapsible) */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-gray-100 dark:border-white/[0.04] rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-colors overflow-hidden">
            <button 
              onClick={() => setSupportOpen(!supportOpen)}
              className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground">
                SUPPORT
              </span>
              {supportOpen ? <ChevronUp className="w-4 h-4 text-foreground/50" /> : <ChevronDown className="w-4 h-4 text-foreground/50" />}
            </button>
            
            <AnimatePresence initial={false}>
              {supportOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0">
                    <div className="h-px w-full bg-gray-50 dark:bg-white/[0.02] mb-4" />
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      {/* Column 1 */}
                      <div className="space-y-4">
                        <Link href="/faq" className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            FAQ's
                          </span>
                        </Link>

                        <Link href="/orders" className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Track Your Order
                          </span>
                        </Link>
                      </div>

                      {/* Column 2 */}
                      <div className="space-y-4">
                        <Link href="/portal/login" className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Return / Exchange
                          </span>
                        </Link>

                        <Link href={findPolicyPath("refund", "/policies/refund-policy")} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/[0.06] flex items-center justify-center text-foreground/60 bg-gray-50/50 dark:bg-white/[0.01] group-hover:text-foreground group-hover:border-foreground/20 dark:group-hover:border-white/20 transition-all shadow-sm">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-foreground/70 group-hover:text-foreground transition-colors">
                            Refund / Exchange Policy
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Panel 4: STAY IN THE LOOP (Static Card) */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-gray-100 dark:border-white/[0.04] rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground block mb-1">
              STAY IN THE LOOP
            </span>
            <p className="text-[10.5px] text-foreground/45 font-light mb-4 leading-none">
              Join our newsletter.
            </p>
            
            <form onSubmit={handleSubscribe} className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email" 
                  required
                  className="w-full h-11 bg-transparent border border-gray-200 dark:border-white/[0.08] focus:border-foreground dark:focus:border-white/20 rounded-full px-5 pr-11 text-[11px] focus:outline-none placeholder:text-foreground/25 text-foreground transition-colors leading-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5" />
                </div>
              </div>
              <button 
                type="submit"
                className="h-11 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95 rounded-full px-5 text-[9px] font-bold tracking-[0.2em] uppercase transition-all shrink-0 flex items-center justify-center"
              >
                SUBSCRIBE
              </button>
            </form>
          </div>

        </div>

        {/* Mobile Bottom Footer Copyright Details */}
        <div className="w-full max-w-md flex justify-between items-center text-[7.5px] tracking-[0.12em] font-semibold text-foreground/25 px-1.5 mt-8">
          <span>© {new Date().getFullYear()} ZICABELLA</span>
          <span>CRAFTED IN INDIA • ALL RIGHTS RESERVED</span>
        </div>

      </div>
    </footer>
  );
}

// Custom Spotify SVG Icon
function SpotifyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.337.136-.669.472-.745 3.858-.88 7.15-.503 9.82 1.13.297.182.39.567.206.86zm1.226-2.724c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.077-1.182-.413.125-.847-.107-.972-.52-.125-.413.108-.847.52-.972 3.673-1.114 8.243-.57 11.343 1.34.367.227.487.708.26 1.075zm.105-2.82c-3.26-1.937-8.644-2.115-11.753-1.17-.5.152-1.025-.133-1.177-.633-.15-.5.134-1.025.633-1.176 3.585-1.09 9.524-.887 13.284 1.346.45.267.6.845.333 1.295-.266.45-.845.6-1.295.333z"/>
    </svg>
  );
}

// Custom Apple Music / Music SVG Icon
function Music2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 3H9c-1.1 0-2 .9-2 2v11.5c-.75-.41-1.6-.5-2.5-.24-1.62.48-2.5 2.19-2 3.81.49 1.62 2.2 2.5 3.82 2 .98-.3 1.68-1.11 1.68-2.07V9h8v4.5c-.75-.41-1.6-.5-2.5-.24-1.62.48-2.5 2.19-2 3.81.49 1.62 2.2 2.5 3.82 2 .98-.3 1.68-1.11 1.68-2.07V5c0-1.1-.9-2-2-2z"/>
    </svg>
  );
}
