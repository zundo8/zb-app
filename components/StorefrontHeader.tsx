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
      <header className="hidden md:flex fixed top-0 left-0 w-full z-50 px-8 h-16 items-center justify-between pointer-events-auto apple-glass-capsule rounded-none border-x-0 border-t-0 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        {/* Sweep Glow Overlay */}
        <div className="apple-glass-sweep-glow" />

        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-3 active:scale-95 transition-all z-10">
          <div className="relative w-7 h-7 dark:invert">
            <NextImage src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain" />
          </div>
          <span className="font-rocaston text-[12.5px] font-bold tracking-[0.25em] text-foreground/80 uppercase pt-0.5">ZICA BELLA</span>
        </Link>

        {/* Center: Nav Links */}
        <div className="flex items-center gap-9 z-10">
          {collections.slice(0, 5).map((col) => (
            <Link key={col.id} href={`/collections/${col.handle}`} className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground uppercase transition-all duration-300 hover:scale-105 active:scale-95 pt-0.5">
              {col.title}
            </Link>
          ))}
          <Link href="/blogs" className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground uppercase transition-all duration-300 hover:scale-105 active:scale-95 pt-0.5">
            Blogs
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-5 z-10">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all duration-300 active:scale-90"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} /> : <Moon className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />}
            </button>
          )}
          <Link href="/search" aria-label="Search" className="text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all duration-300">
            <Search className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
          </Link>
          <button onClick={() => setIsBookmarkOpen(true)} aria-label="Bookmarks" className="relative text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all duration-300">
            <Bookmark className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
            {bookmarks.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-foreground/60 rounded-full" />}
          </button>
          <button onClick={() => setIsCartOpen(true)} aria-label="Cart" className="relative text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all duration-300">
            <ShoppingBag className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-foreground/60 rounded-full" />}
          </button>
          <Link href="/profile" aria-label="Profile" className="text-foreground/45 hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground transition-all duration-300">
            <User className="w-5 h-5 transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      {/* ── Mobile Header Capsules ── */}
      <header className="flex md:hidden fixed left-0 w-full z-50 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 items-center justify-between gap-2 pointer-events-none">
        
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
