"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Bookmark, ShoppingBag, ChevronLeft, Search, User, Menu, Sun, Moon } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import MenuDrawer from "./MenuDrawer";
import CartDrawer from "./CartDrawer";
import BookmarkDrawer from "./BookmarkDrawer";
import { useBookmarks } from "@/lib/bookmark-context";
import { useRouter, usePathname } from "next/navigation";
import { useShakeToCart } from "@/lib/hooks/useShakeToCart";
import { useTheme } from "next-themes";

export default function StorefrontHeader({ collections: initialCollections = [] }: { collections?: any[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useCart();
  const { bookmarks, isOpen: isBookmarkOpen, setIsOpen: setIsBookmarkOpen } = useBookmarks();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [collections, setCollections] = useState(initialCollections);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleCart = useCallback(() => {
    setIsCartOpen(prev => !prev);
  }, []);
  useShakeToCart(toggleCart);

  useEffect(() => {
    if (initialCollections.length === 0) {
      fetch("/api/shopify/collections?location=header", { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCollections(data);
          }
        })
        .catch(err => console.error("Error fetching collections:", err));
    } else {
      setCollections(initialCollections);
    }
  }, [initialCollections]);

  const isHome = pathname === "/";
  const getPageTitle = () => {
    if (!pathname) return "ZICA BELLA";
    if (isHome) return "ZICA BELLA";
    const segments = pathname?.split("/").filter(Boolean) || [];
    if (segments.length === 0) return "Zica Bella";
    let title = segments[segments.length - 1];
    title = title.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return title;
  };

  return (
    <>
      {/* ── Desktop Header Pill (md and up) ── */}
      <header className="hidden md:flex fixed top-5 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-6xl z-50 px-6 h-14 items-center justify-between pointer-events-auto bg-white/75 dark:bg-white/[0.04] backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_12px_45px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)] rounded-full transition-all duration-300">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-2.5 active:scale-95 transition-all z-10 py-1.5 px-3 rounded-full hover:bg-foreground/5 dark:hover:bg-white/5">
          <div className="relative w-6 h-6 dark:invert">
            <NextImage src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain" />
          </div>
          <span className="font-rocaston text-[11px] font-bold tracking-[0.25em] text-foreground/80 uppercase pt-0.5">ZICA BELLA</span>
        </Link>

        {/* Center: Nav Links */}
        <div className="flex items-center gap-1.5 z-10">
          {collections.slice(0, 5).map((col) => {
            const active = pathname === `/collections/${col.handle}`;
            return (
              <Link
                key={col.id}
                href={`/collections/${col.handle}`}
                className={`text-[9px] font-bold tracking-[0.2em] uppercase transition-all duration-300 py-1.5 px-3.5 rounded-full ${
                  active
                    ? "bg-foreground text-background dark:bg-white dark:text-black font-extrabold shadow-sm"
                    : "text-foreground/50 hover:text-foreground hover:bg-foreground/5 dark:hover:bg-white/5"
                }`}
              >
                {col.title}
              </Link>
            );
          })}
          <Link
            href="/blogs"
            className={`text-[9px] font-bold tracking-[0.2em] uppercase transition-all duration-300 py-1.5 px-3.5 rounded-full ${
              pathname === "/blogs"
                ? "bg-foreground text-background dark:bg-white dark:text-black font-extrabold shadow-sm"
                : "text-foreground/50 hover:text-foreground hover:bg-foreground/5 dark:hover:bg-white/5"
            }`}
          >
            Blogs
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 z-10">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="h-8 w-8 flex items-center justify-center rounded-full text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent transition-all duration-300 active:scale-90"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
              ) : (
                <Moon className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
              )}
            </button>
          )}
          
          <Link
            href="/search"
            aria-label="Search"
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              pathname === "/search"
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <Search className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
          </Link>
          
          <button
            onClick={() => setIsBookmarkOpen(true)}
            aria-label="Bookmarks"
            className={`relative h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              isBookmarkOpen
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <Bookmark className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
            {bookmarks.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-foreground dark:bg-white rounded-full animate-pulse" />
            )}
          </button>
          
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="Cart"
            className={`relative h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              isCartOpen
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <ShoppingBag className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
            {count > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-foreground dark:bg-white rounded-full animate-pulse" />
            )}
          </button>
          
          <Link
            href="/profile"
            aria-label="Profile"
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              pathname === "/profile"
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <User className="w-4 h-4 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
          </Link>
        </div>
      </header>

      {/* ── Mobile Header Capsules ── */}
      <header className="flex md:hidden fixed top-0 left-0 w-full z-50 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 items-center justify-between gap-2 pointer-events-none">
        
        {/* Left */}
        <div className="flex-none pointer-events-auto">
          {isHome ? (
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-full shadow-lg group active:scale-95 transition-all apple-glass-capsule liquid-glass-hover-sweep"
              aria-label="Menu"
            >
              <div className="apple-glass-sweep-glow" />
              <div className="relative w-6 h-6 opacity-80 group-hover:opacity-100 transition-opacity dark:invert z-10">
                <NextImage src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain" />
              </div>
            </button>
          ) : (
            <button 
              onClick={() => router.back()}
              className="h-9 w-9 flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-all group apple-glass-capsule liquid-glass-hover-sweep"
              aria-label="Back"
            >
              <div className="apple-glass-sweep-glow" />
              <ChevronLeft strokeWidth={1.5} className="w-5 h-5 text-foreground/50 transition-transform duration-300 group-hover:text-foreground z-10" />
            </button>
          )}
        </div>

        {/* Center */}
        <div className="flex-1 min-w-0 pointer-events-auto">
          <Link 
            href="/"
            className="h-9 flex items-center justify-center px-6 rounded-full shadow-lg active:scale-[0.98] transition-all max-w-full apple-glass-capsule liquid-glass-hover-sweep"
          >
            <div className="apple-glass-sweep-glow" />
            <span className="text-[10px] sm:text-[11px] font-rocaston tracking-[0.08em] text-foreground/70 uppercase truncate pt-0.5 z-10">
              {getPageTitle()}
            </span>
          </Link>
        </div>

        {/* Right */}
        <div className="flex-none pointer-events-auto">
          <div className="flex items-center gap-0.5 h-9 p-0.5 px-1.5 rounded-full shadow-lg apple-glass-capsule liquid-glass-hover-sweep">
            <div className="apple-glass-sweep-glow" />
            {mounted && (
              <button 
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label="Toggle Theme"
                className="relative h-8 w-8 flex items-center justify-center text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all active:scale-90 z-10"
              >
                {isDark ? <Sun className="w-4 h-4 transition-transform duration-300 hover:scale-110" /> : <Moon className="w-4 h-4 transition-transform duration-300 hover:scale-110" />}
              </button>
            )}
            <button 
              onClick={() => setIsBookmarkOpen(true)}
              aria-label="Bookmarks"
              className="relative h-8 w-8 flex items-center justify-center text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all active:scale-90 z-10"
            >
              <Bookmark className="w-4 h-4 transition-transform duration-300 hover:scale-110" />
              {bookmarks.length > 0 && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground/60 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => setIsCartOpen(true)}
              aria-label="Cart"
              className="relative h-8 w-8 flex items-center justify-center text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all active:scale-90 z-10"
            >
              <ShoppingBag className="w-4 h-4 transition-transform duration-300 hover:scale-110" />
              {count > 0 && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground/60 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </header>
      {/* Drawers */}
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <BookmarkDrawer isOpen={isBookmarkOpen} onClose={() => setIsBookmarkOpen(false)} />
    </>
  );
}
