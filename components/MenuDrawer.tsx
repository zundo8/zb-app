"use client";

import { X, User, Package, Info, Users, BookOpen, Handshake, ChevronRight, Search, MessageCircle } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShopifyCollection {
  id: string | number;
  title: string;
  handle: string;
}

const FALLBACK_COLLECTIONS: ShopifyCollection[] = [
  { id: "accessories",  title: "Accessories",  handle: "accessories" },
  { id: "acid-tees",    title: "Acid Tees",    handle: "acid-tees" },
  { id: "leather-room", title: "Leather Room", handle: "leather-room" },
  { id: "rogue-winter", title: "Rogue Winter", handle: "rogue-winter" },
  { id: "drip-denim",   title: "Drip Denim",   handle: "drip-denim" },
  { id: "jortsy",       title: "Jortsy",        handle: "jortsy" },
  { id: "vexee-shirts", title: "Vexee Shirts", handle: "vexee-shirts" },
  { id: "all-drips",    title: "All Drips",    handle: "all-drips" },
];

const PRIMARY_NAV = [
  { title: "Zica AI Chat",   url: "/chat",        icon: MessageCircle },
  { title: "Search Store",   url: "/search",      icon: Search },
  { title: "Collaborations", url: "/collaborations", icon: Handshake },
  { title: "Blogs",          url: "/blogs",       icon: BookOpen },
  { title: "FAQ",            url: "/faq",         icon: Info },
  { title: "Community",      url: "/community",   icon: Users },
];

const SHOP_TERMS = ["T-shirt", "Jeans", "Pants", "Trousers", "Jorts", "Shirts"];

export default function MenuDrawer({ isOpen, onClose }: MenuDrawerProps) {
  const [collections, setCollections] = useState<ShopifyCollection[]>(FALLBACK_COLLECTIONS);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const profileImage = session?.user?.image || (session as any)?.customer?.image;

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/shopify/collections?location=menu")
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) setCollections(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-md"
          />

          {/* Floating Glass Drawer — Left */}
          <motion.div
            initial={{ x: "-100%", opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: "-100%", opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 32, stiffness: 220, mass: 0.8 }}
            className="fixed inset-y-3 left-3 w-[88vw] max-w-[340px] z-[100] flex flex-col rounded-[2rem] overflow-hidden pointer-events-auto apple-glass-capsule"
          >
            {/* Top Glow sweep glare */}
            <div className="apple-glass-sweep-glow" />

            {/* ─── TOP BAR ─────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0 z-10">
              <span className="text-[7.5px] tracking-[0.6em] uppercase text-foreground/30 font-bold font-rocaston">
                ZICA BELLA
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-all active:scale-90"
                aria-label="Close menu"
              >
                <X className="w-3.5 h-3.5 text-foreground/45" strokeWidth={1.5} />
              </button>
            </div>

            {/* ─── ZONE A: Collections + Shop (TOP) ─── */}
            <div className="flex flex-1 min-h-0 z-10">
              {/* Left half: Collections */}
              <div className="flex-1 px-6 pt-3 pb-2 flex flex-col min-h-0">
                <p className="text-[6.5px] tracking-[0.4em] uppercase text-foreground/30 mb-4 font-bold">COLLECTIONS</p>
                <div className="flex flex-col gap-3.5 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  {loading
                    ? [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-3 w-4/5 bg-foreground/[0.04] rounded-md animate-pulse" />
                      ))
                    : collections.map((c) => (
                        <Link
                          key={c.id}
                          href={`/collections/${c.handle}`}
                          onClick={onClose}
                          className="group flex items-center justify-between transition-transform duration-300 hover:translate-x-1"
                        >
                          <span className="text-[11px] text-foreground/50 group-hover:text-foreground dark:text-foreground/50 dark:group-hover:text-foreground transition-colors duration-300 font-medium uppercase tracking-[0.12em]">
                            {c.title}
                          </span>
                          <ChevronRight className="w-3 h-3 text-foreground/0 group-hover:text-foreground/45 transition-all duration-300" strokeWidth={1.5} />
                        </Link>
                      ))}
                </div>
              </div>

              {/* Central Divider */}
              <div className="w-[1px] bg-foreground/[0.06] my-6" />

              {/* Right half: Shop terms */}
              <div className="w-[32%] pt-3 pb-2 px-4 flex flex-col">
                <p className="text-[6.5px] tracking-[0.4em] uppercase text-foreground/30 mb-4 font-bold">SHOP</p>
                <div className="flex flex-col gap-3">
                  {SHOP_TERMS.map((term) => (
                    <Link 
                      key={term} 
                      href={`/search?q=${term}`} 
                      onClick={onClose} 
                      className="group transition-transform duration-300 hover:translate-x-0.5"
                    >
                      <span className="text-[10px] text-foreground/40 group-hover:text-foreground/80 dark:text-foreground/45 dark:group-hover:text-foreground/85 transition-colors font-medium tracking-[0.08em] uppercase">
                        {term}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── ZONE B: Primary Nav (BOTTOM) ─────── */}
            <nav className="px-6 pt-5 pb-3 flex flex-col border-t border-foreground/[0.06] z-10">
              {PRIMARY_NAV.map(({ title, url, icon: Icon }) => (
                <Link
                  key={title}
                  href={url}
                  onClick={onClose}
                  className="group flex items-center justify-between py-2 transition-transform duration-300 hover:translate-x-1"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                    <span className="text-[14px] font-medium text-foreground/50 group-hover:text-foreground dark:text-foreground/50 dark:group-hover:text-foreground transition-colors uppercase tracking-[0.08em]">
                      {title}
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-foreground/0 group-hover:text-foreground/45 transition-all duration-300" strokeWidth={1.5} />
                </Link>
              ))}
            </nav>

            {/* ─── ZONE C: Icon Dock (VERY BOTTOM) ──── */}
            <div className="mx-5 mb-5 mt-1 p-1 rounded-[1.5rem] flex items-center justify-around bg-foreground/[0.03] border border-foreground/[0.04] z-10">
              <Link 
                href={session ? "/profile" : "/login"} 
                onClick={onClose} 
                className="group flex flex-col items-center gap-1.5 flex-1 py-2 rounded-[1.1rem] hover:bg-foreground/[0.05] active:scale-95 transition-all"
              >
                {profileImage ? (
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-foreground/10 group-hover:border-foreground/30 transition-all">
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <User className="w-4.5 h-4.5 text-foreground/30 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                )}
                <span className="text-[6px] font-semibold tracking-[0.25em] uppercase text-foreground/40 group-hover:text-foreground/75 transition-colors">Profile</span>
              </Link>
              
              <div className="w-[1px] h-6 bg-foreground/[0.06]" />
              
              <Link 
                href="/orders" 
                onClick={onClose} 
                className="group flex flex-col items-center gap-1.5 flex-1 py-2 hover:bg-foreground/[0.05] active:scale-95 rounded-[1.1rem] transition-all"
              >
                <Package className="w-4.5 h-4.5 text-foreground/30 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                <span className="text-[6px] font-semibold tracking-[0.25em] uppercase text-foreground/40 group-hover:text-foreground/75 transition-colors">Orders</span>
              </Link>
              
              <div className="w-[1px] h-6 bg-foreground/[0.06]" />
              
              <Link 
                href="/story" 
                onClick={onClose} 
                className="group flex flex-col items-center gap-1.5 flex-1 py-2 hover:bg-foreground/[0.05] active:scale-95 rounded-[1.1rem] transition-all"
              >
                <Info className="w-4.5 h-4.5 text-foreground/30 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                <span className="text-[6px] font-semibold tracking-[0.25em] uppercase text-foreground/40 group-hover:text-foreground/75 transition-colors">Story</span>
              </Link>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
