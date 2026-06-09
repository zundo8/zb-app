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

  const isProductPage = pathname?.startsWith("/products/");

  if (isProductPage) {
    return (
      <>
        {/* Floating Back Button (Top Left) */}
        <div className="fixed top-4 left-4 z-50 pointer-events-auto">
          <button 
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)] text-foreground/60 hover:text-foreground hover:bg-white/80 dark:hover:bg-black/80 active:scale-90 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            aria-label="Back"
          >
            <ChevronLeft strokeWidth={1.25} className="w-4.5 h-4.5 -ml-0.5" />
          </button>
        </div>

        {/* Floating Actions (Top Right) */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
          {mounted && (
            <button 
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle Theme"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)] text-foreground/60 hover:text-foreground hover:bg-white/80 dark:hover:bg-black/80 active:scale-90 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            >
              {isDark ? <Sun strokeWidth={1.25} className="w-4 h-4" /> : <Moon strokeWidth={1.25} className="w-4 h-4" />}
            </button>
          )}
          <button 
            onClick={() => setIsCartOpen(true)}
            aria-label="Cart"
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)] text-foreground/60 hover:text-foreground hover:bg-white/80 dark:hover:bg-black/80 active:scale-90 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <ShoppingBag strokeWidth={1.25} className="w-4 h-4" />
            {count > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
            )}
          </button>
        </div>

        {/* Drawers */}
        <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        <BookmarkDrawer isOpen={isBookmarkOpen} onClose={() => setIsBookmarkOpen(false)} />
      </>
    );
  }

  return (
    <>
      {/* ── Desktop Header Pill (md and up) ── */}
      <header className="hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-5xl z-50 px-5 h-11 items-center justify-between pointer-events-auto bg-white/75 dark:bg-white/[0.04] backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.05)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.4)] rounded-full transition-all duration-300">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-2 active:scale-95 transition-all z-10 py-1 px-2.5 rounded-full hover:bg-foreground/5 dark:hover:bg-white/5">
          <div className="relative w-4.5 h-4.5 dark:invert">
            <NextImage src="/zb-logo-220px.png" alt="Zica Bella" fill className="object-contain" />
          </div>
          <span className="font-rocaston text-[9.5px] font-bold tracking-[0.22em] text-foreground/80 uppercase pt-0.5">ZICA BELLA</span>
        </Link>

        {/* Center: Nav Links */}
        <div className="flex items-center gap-1.5 z-10">
          {collections.slice(0, 5).map((col) => {
            const active = pathname === `/collections/${col.handle}`;
            return (
              <Link
                key={col.id}
                href={`/collections/${col.handle}`}
                className={`text-[7.5px] font-bold tracking-[0.22em] uppercase transition-all duration-300 py-1 px-3 rounded-full ${
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
            className={`text-[7.5px] font-bold tracking-[0.22em] uppercase transition-all duration-300 py-1 px-3 rounded-full ${
              pathname === "/blogs"
                ? "bg-foreground text-background dark:bg-white dark:text-black font-extrabold shadow-sm"
                : "text-foreground/50 hover:text-foreground hover:bg-foreground/5 dark:hover:bg-white/5"
            }`}
          >
            Blogs
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 z-10">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="h-[30px] w-[30px] flex items-center justify-center rounded-full text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent transition-all duration-300 active:scale-90"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
              ) : (
                <Moon className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
              )}
            </button>
          )}
          
          <Link
            href="/search"
            aria-label="Search"
            className={`h-[30px] w-[30px] flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              pathname === "/search"
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <Search className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
          </Link>
          
          <button
            onClick={() => setIsBookmarkOpen(true)}
            aria-label="Bookmarks"
            className={`relative h-[30px] w-[30px] flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              isBookmarkOpen
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
            {bookmarks.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-foreground dark:bg-white rounded-full animate-pulse" />
            )}
          </button>
          
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="Cart"
            className={`relative h-[30px] w-[30px] flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              isCartOpen
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
            {count > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-foreground dark:bg-white rounded-full animate-pulse" />
            )}
          </button>
          
          <Link
            href="/profile"
            aria-label="Profile"
            className={`h-[30px] w-[30px] flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
              pathname === "/profile"
                ? "text-foreground dark:text-white bg-foreground/[0.06] dark:bg-white/[0.08] border border-foreground/[0.08] dark:border-white/10 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.02)]"
                : "text-foreground/50 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            <User className="w-3.5 h-3.5 transition-transform duration-300 hover:scale-105" strokeWidth={1.25} />
          </Link>
        </div>
      </header>

      {/* ── Mobile Header Pill ── */}
      <header className="flex md:hidden fixed top-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] z-50 px-4 h-11 items-center justify-between pointer-events-auto bg-white/75 dark:bg-white/[0.04] backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] rounded-full transition-all duration-300">
        
        {/* Left Section: Back or Menu Toggle */}
        <div className="flex items-center gap-0.5">
          {!isHome && (
            <button 
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all"
              aria-label="Back"
            >
              <ChevronLeft strokeWidth={1.5} className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all"
            aria-label="Menu"
          >
            <Menu strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Brand Title */}
        <Link 
          href="/"
          className="flex items-center gap-1 active:scale-95 transition-all"
        >
          <span className="text-[8.5px] font-rocaston tracking-[0.22em] text-foreground/80 uppercase pt-0.5 font-medium">
            {getPageTitle()}
          </span>
        </Link>

        {/* Right Section: Theme & Cart */}
        <div className="flex items-center gap-1">
          {mounted && (
            <button 
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle Theme"
              className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all"
            >
              {isDark ? <Sun strokeWidth={1.5} className="w-4 h-4" /> : <Moon strokeWidth={1.5} className="w-4 h-4" />}
            </button>
          )}
          <button 
            onClick={() => setIsCartOpen(true)}
            aria-label="Cart"
            className="relative w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all"
          >
            <ShoppingBag strokeWidth={1.5} className="w-4 h-4" />
            {count > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
            )}
          </button>
        </div>

      </header>

      {/* Drawers */}
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <BookmarkDrawer isOpen={isBookmarkOpen} onClose={() => setIsBookmarkOpen(false)} />
    </>
  );
}
