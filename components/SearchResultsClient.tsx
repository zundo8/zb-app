"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShopifyProduct } from "@/lib/shopify-admin";
import ProductCard from "./ProductCard";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useBookmarks } from "@/lib/bookmark-context";
import { handleImageError } from "./ImagePlaceholder";
import { Search, LayoutGrid, Menu, Bookmark, Plus } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load modal to avoid SSR issues
const QuickAddModal = dynamic(() => import("./QuickAddModal"), { ssr: false });

const TRENDING = ["T-shirt", "Jeans", "Pants", "Trousers", "Jorts", "Shirts", "Acid Tees", "Leather"];

interface Props {
  initialProducts: ShopifyProduct[];
  query: string;
  collections: any[];
  trendingProducts: ShopifyProduct[];
  initialSortBy: string;
}

export default function SearchResultsClient({
  initialProducts,
  query,
  collections,
  trendingProducts,
  initialSortBy,
}: Props) {
  const router = useRouter();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [searchTerm, setSearchTerm] = useState(query);
  const [viewMode, setViewMode] = useState<"grid" | "editorial">("grid");
  const [sortBy, setSortBy] = useState<string>(initialSortBy || "relevance");
  const [mounted, setMounted] = useState(false);
  const [activeModalProduct, setActiveModalProduct] = useState<ShopifyProduct | null>(null);

  // Focus search input on mount if no query is present
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize view mode from localStorage safely after mount
  useEffect(() => {
    const savedMode = localStorage.getItem("zb_search_view_mode");
    if (savedMode === "grid" || savedMode === "editorial") {
      setViewMode(savedMode);
    }
    setMounted(true);
  }, []);

  const handleToggleView = (mode: "grid" | "editorial") => {
    setViewMode(mode);
    localStorage.setItem("zb_search_view_mode", mode);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}&sort=${sortBy}`);
    } else {
      router.push(`/search`);
    }
  };

  const handleClear = () => {
    setSearchTerm("");
    router.push("/search");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleTrendingClick = (term: string) => {
    setSearchTerm(term);
    router.push(`/search?q=${encodeURIComponent(term)}&sort=${sortBy}`);
  };

  const handleStoryClick = (term: string) => {
    setSearchTerm(term);
    router.push(`/search?q=${encodeURIComponent(term)}&sort=${sortBy}`);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    const q = searchTerm.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}&sort=${newSort}`);
    }
  };

  // Client-side sorting of search results
  const sortedProducts = useMemo(() => {
    const list = [...initialProducts];
    if (sortBy === "price-asc") {
      list.sort((a, b) => parseFloat(a.variants?.[0]?.price || "0") - parseFloat(b.variants?.[0]?.price || "0"));
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => parseFloat(b.variants?.[0]?.price || "0") - parseFloat(a.variants?.[0]?.price || "0"));
    }
    return list;
  }, [initialProducts, sortBy]);

  // Dynamic editorial banner values
  const { bannerTitle, bannerSubtitle, bannerImage } = useMemo(() => {
    if (query && sortedProducts.length > 0) {
      // Find clean product type or use capitalized query
      const firstProd = sortedProducts[0];
      const title = query.toUpperCase();
      const rawDesc = firstProd.body_html ? firstProd.body_html.replace(/<[^>]*>/g, "").trim() : "";
      const subtitle = rawDesc || "Raw silhouettes, bold graphics, and uncompromising attitude.";
      const image = firstProd.images?.[0]?.src || "/zb-logo-220px.png";
      return { bannerTitle: title, bannerSubtitle: subtitle, bannerImage: image };
    }
    // Default fallback banner details when there's no active query
    const defaultImage = trendingProducts[0]?.images?.[0]?.src || "/zb-logo-220px.png";
    return {
      bannerTitle: "STREET EDIT",
      bannerSubtitle: "Raw silhouettes, bold graphics, and uncompromising attitude. Made for movement, designed for impact.",
      bannerImage: defaultImage,
    };
  }, [query, sortedProducts, trendingProducts]);

  // Curated themed stories mapping dynamic product image cards
  const curatedStoriesData = useMemo(() => {
    return [
      {
        id: "01",
        title: "GRAPHIC REBELS",
        subtitle: "Loud prints. Louder energy.",
        query: "Graphic",
        image: trendingProducts[1]?.images?.[0]?.src || "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "02",
        title: "OVERSIZED ESSENTIALS",
        subtitle: "Comfort that hits different.",
        query: "Oversized",
        image: trendingProducts[2]?.images?.[0]?.src || "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "03",
        title: "BACK PRINTS THAT BITE",
        subtitle: "From subtle to savage.",
        query: "Back Print",
        image: trendingProducts[3]?.images?.[0]?.src || "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=400&q=80",
      },
    ];
  }, [trendingProducts]);

  // List of picks to show in Editorial view: matches search results, or trending products if query is empty
  const editorsPicksProducts = useMemo(() => {
    if (query && sortedProducts.length > 0) {
      return sortedProducts;
    }
    return trendingProducts.slice(0, 10);
  }, [query, sortedProducts, trendingProducts]);

  const handleBannerClick = () => {
    const el = document.getElementById("editors-picks-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-xl mx-auto px-2 animate-pulse mt-4">
        <div className="h-14 rounded-2xl bg-foreground/[0.04] border border-foreground/5 mb-8" />
        <div className="h-4 w-28 bg-foreground/[0.04] rounded mx-auto mb-10" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/5] rounded-2xl bg-foreground/[0.02]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-1">
      {/* ── A. Unified Search Bar & Layout Toggles (Mock Reference) ── */}
      <form onSubmit={handleSearchSubmit} className="mb-6 w-full max-w-xl mx-auto flex items-center gap-2">
        <div className="relative flex-1 flex items-center rounded-2xl overflow-hidden bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/[0.08] dark:border-white/[0.08] focus-within:border-foreground/20 dark:focus-within:border-white/20 focus-within:bg-foreground/[0.01] transition-all duration-300 shadow-sm">
          <Search className="absolute left-4 w-4 h-4 text-foreground/35 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Zica Bella..."
            className="w-full pl-11 pr-14 py-4 bg-transparent text-[13.5px] text-foreground placeholder-foreground/30 focus:outline-none font-light tracking-wide"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 px-2.5 py-1 text-[8.5px] uppercase tracking-widest font-semibold text-foreground/45 hover:text-foreground/85 rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/[0.06] dark:border-white/[0.06] hover:bg-foreground/[0.08] active:scale-95 transition-all"
            >
              Clear
            </button>
          )}
        </div>

        {/* Layout buttons next to the search input */}
        <div className="flex items-center p-0.5 rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/[0.08] dark:border-white/[0.08] h-[52px]">
          <button
            type="button"
            onClick={() => handleToggleView("grid")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
              viewMode === "grid"
                ? "bg-foreground text-background dark:bg-white dark:text-black shadow-sm"
                : "text-foreground/40 dark:text-white/40 hover:text-foreground/75 dark:hover:text-white/75"
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleView("editorial")}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
              viewMode === "editorial"
                ? "bg-foreground text-background dark:bg-white dark:text-black shadow-sm"
                : "text-foreground/40 dark:text-white/40 hover:text-foreground/75 dark:hover:text-white/75"
            }`}
            aria-label="Editorial view"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* ── B. Trending Searches Row ── */}
      <div className="mb-10 text-center">
        <p 
          className="text-[8px] font-mono tracking-[0.25em] text-foreground/35 uppercase mb-3"
          style={{ fontFamily: "var(--font-poppins), -apple-system, sans-serif" }}
        >
          Trending Searches
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center max-w-xl mx-auto px-2">
          {TRENDING.map((term) => (
            <button
              key={term}
              onClick={() => handleTrendingClick(term)}
              className="px-4 py-2 rounded-full text-[8.5px] uppercase tracking-widest text-foreground/50 dark:text-white/50 border border-foreground/[0.08] dark:border-white/[0.08] bg-foreground/[0.01] dark:bg-white/[0.01] hover:border-foreground/20 hover:text-foreground active:scale-95 transition-all duration-200"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* ── C. Sliding Tab Selector (Grid View vs Editorial View) ── */}
      <div className="relative flex w-full border-b border-foreground/5 dark:border-white/5 mb-8 max-w-xl mx-auto px-2">
        {[
          { id: "grid", label: "Grid View" },
          { id: "editorial", label: "Editorial View" },
        ].map((tab) => {
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleToggleView(tab.id as "grid" | "editorial")}
              className={`flex-1 pb-3 text-[9px] uppercase tracking-[0.2em] font-medium transition-all duration-300 relative text-center ${
                isActive ? "text-foreground font-semibold" : "text-foreground/45 hover:text-foreground/75"
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground dark:bg-white"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── D. Sort Filters (Visible on results search) ── */}
      {query && sortedProducts.length > 0 && (
        <div className="flex gap-1.5 mb-8 flex-wrap justify-center animate-fade-up max-w-xl mx-auto">
          {[
            { label: "Relevance", value: "relevance" },
            { label: "Price ↑", value: "price-asc" },
            { label: "Price ↓", value: "price-desc" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={`px-4.5 py-1.5 rounded-full text-[8.5px] uppercase tracking-widest transition-all duration-200 active:scale-95 ${
                sortBy === opt.value
                  ? "bg-foreground text-background dark:bg-white dark:text-black font-semibold shadow-sm"
                  : "bg-foreground/[0.03] dark:bg-white/[0.03] text-foreground/45 dark:text-white/45 border border-foreground/5 hover:border-foreground/15 hover:text-foreground/75"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── E. Main Content View ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode + "-" + query}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full pb-16"
        >
          {viewMode === "grid" ? (
            /* ==================== 1. GRID VIEW LAYOUT ==================== */
            <div>
              {sortedProducts.length > 0 ? (
                <div>
                  <div className="flex justify-between items-center mb-6 px-1 max-w-6xl mx-auto">
                    <p className="text-[8.5px] sm:text-[9.5px] text-foreground/35 uppercase tracking-[0.2em]">
                      {sortedProducts.length} {sortedProducts.length === 1 ? "Result" : "Results"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[3px] px-[2px] md:px-1 max-w-6xl mx-auto">
                    {sortedProducts.map((product, idx) => (
                      <ProductCard key={product.id} product={product} priority={idx < 4} />
                    ))}
                  </div>
                </div>
              ) : query ? (
                /* No Results fallback */
                <div className="text-center py-20 flex flex-col items-center gap-4 animate-fade-up max-w-xl mx-auto">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center border border-foreground/5 bg-foreground/[0.02]">
                    <Search className="w-4 h-4 text-foreground/20" />
                  </div>
                  <div>
                    <p className="text-[9.5px] uppercase tracking-[0.25em] text-foreground/40 font-mono">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[8.5px] text-foreground/25 mt-1 uppercase tracking-widest font-mono">
                      Try searching another keyword or check out trends below
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty state - Collections + Trending products list */
                <div className="max-w-4xl mx-auto mt-4 text-left animate-fade-up">
                  {/* Collections list */}
                  {collections.length > 0 && (
                    <div className="mb-12">
                      <p className="text-[8.5px] font-mono tracking-[0.25em] text-foreground/35 uppercase mb-4 pl-1">
                        Explore Collections
                      </p>
                      <div className="flex overflow-x-auto gap-2.5 pb-4 px-1 snap-x hide-scrollbar scroll-smooth">
                        {collections
                          .filter((c) => c.image?.src)
                          .slice(0, 8)
                          .map((c: any) => (
                            <Link
                              key={c.id}
                              href={`/collections/${c.handle}`}
                              className="group relative min-w-[200px] sm:min-w-[240px] aspect-[4/3] rounded-2xl overflow-hidden border border-foreground/[0.04] bg-foreground/[0.02] shadow-sm hover:shadow-md snap-start transition-all duration-500"
                            >
                              <Image
                                src={c.image?.src}
                                alt={c.title}
                                fill
                                className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                                sizes="(max-width: 768px) 200px, 240px"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent flex flex-col justify-end p-4">
                                <span className="text-[7.5px] font-mono text-white/40 tracking-[0.22em] uppercase mb-0.5">
                                  Collection
                                </span>
                                <h4 className="text-[10px] sm:text-xs font-light uppercase tracking-widest text-white">
                                  {c.title}
                                </h4>
                              </div>
                            </Link>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Trending list */}
                  {trendingProducts.length > 0 && (
                    <div>
                      <p className="text-[8.5px] font-mono tracking-[0.25em] text-foreground/35 uppercase mb-4 pl-1">
                        New Arrivals
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[3px] px-[2px] md:px-0">
                        {trendingProducts.slice(0, 8).map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ==================== 2. EDITORIAL VIEW LAYOUT (Mock Reference) ==================== */
            <div className="max-w-xl mx-auto px-1 animate-fade-up">
              {/* E1. Hero Banner Edit Card */}
              <div className="w-full relative rounded-3xl overflow-hidden aspect-[16/9.5] sm:aspect-[21/9.5] bg-black border border-white/5 shadow-xl flex items-center p-6 sm:p-10 mb-8 group">
                <div className="absolute right-0 top-0 bottom-0 w-3/5 h-full z-0 overflow-hidden">
                  <Image
                    src={bannerImage}
                    alt={bannerTitle}
                    fill
                    sizes="(max-width: 768px) 60vw, 400px"
                    priority
                    className="object-cover object-center group-hover:scale-[1.03] transition-transform duration-[4000ms] ease-out brightness-[0.5] sm:brightness-75"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent z-10" />
                </div>

                <div className="relative z-20 text-left max-w-[190px] sm:max-w-sm">
                  <span className="text-[7.5px] font-mono tracking-[0.35em] text-foreground/45 uppercase mb-1.5 block">
                    Search Edit
                  </span>
                  <h2 
                    className="text-[22px] sm:text-[34px] uppercase tracking-[0.1em] text-white leading-tight mb-2.5 font-light"
                    style={{ fontFamily: "var(--font-poppins), -apple-system, sans-serif" }}
                  >
                    {bannerTitle}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-white/50 leading-relaxed font-light mb-5 line-clamp-3">
                    {bannerSubtitle}
                  </p>
                  <button
                    onClick={handleBannerClick}
                    className="inline-flex items-center gap-1.5 text-[8.5px] uppercase tracking-widest text-white font-semibold hover:opacity-80 transition-opacity active:scale-95"
                  >
                    <span>Explore the edit</span>
                    <span className="text-[10px]">→</span>
                  </button>
                </div>
              </div>

              {/* E2. Curated Stories List */}
              <div className="mb-8 text-left">
                <p 
                  className="text-[8.5px] font-mono tracking-[0.25em] text-foreground/35 uppercase mb-3.5 pl-1"
                  style={{ fontFamily: "var(--font-poppins), -apple-system, sans-serif" }}
                >
                  Curated Stories
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-4 px-1 snap-x hide-scrollbar">
                  {curatedStoriesData.map((story) => (
                    <div
                      key={story.id}
                      onClick={() => handleStoryClick(story.query)}
                      className="group relative min-w-[145px] sm:min-w-[170px] aspect-[3/4.2] rounded-2xl overflow-hidden border border-foreground/[0.04] dark:border-white/[0.04] bg-foreground/[0.02] shadow-sm snap-start cursor-pointer transition-all duration-300 hover:shadow-md hover:border-foreground/[0.08]"
                    >
                      <Image
                        src={story.image}
                        alt={story.title}
                        fill
                        sizes="170px"
                        className="object-cover brightness-[0.35] group-hover:scale-[1.03] transition-transform duration-700"
                        onError={handleImageError}
                      />
                      <span className="absolute top-3.5 left-4 text-[8px] font-mono font-light text-white/40">
                        {story.id}
                      </span>

                      <div className="absolute inset-x-3.5 bottom-3.5 flex flex-col items-start justify-end z-10 text-left">
                        <h4 className="text-[9.5px] sm:text-[10.5px] font-sans font-semibold uppercase tracking-[0.14em] text-white/80 leading-tight mb-0.5 group-hover:text-white transition-colors">
                          {story.title}
                        </h4>
                        <p className="text-[8px] text-white/45 font-light leading-snug">
                          {story.subtitle}
                        </p>

                        <div className="w-5 h-5 rounded-lg border border-white/20 flex items-center justify-center text-white/70 group-hover:text-white group-hover:border-white/40 mt-3.5 transition-all active:scale-90">
                          <span className="text-[8.5px]">→</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* E3. Editor's Picks Stack */}
              <div id="editors-picks-section" className="text-left">
                <p 
                  className="text-[8.5px] font-mono tracking-[0.25em] text-foreground/35 uppercase mb-4 pl-1"
                  style={{ fontFamily: "var(--font-poppins), -apple-system, sans-serif" }}
                >
                  Editor's Picks
                </p>

                {editorsPicksProducts.length > 0 ? (
                  <div className="flex flex-col gap-3.5">
                    {editorsPicksProducts.map((prod) => {
                      const variant = prod.variants?.[0];
                      const price = variant?.price || "0";
                      const compareAtPrice = variant?.compare_at_price;
                      const isOnSale = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price);
                      const isSoldOut = prod.variants ? !prod.variants.some(v => (v.inventory_quantity || 0) > 0) : true;
                      const slug = prod.handle || prod.id;
                      const img = prod.images?.[0]?.src || "/zb-logo-220px.png";

                      const rawDesc = prod.body_html ? prod.body_html.replace(/<[^>]*>/g, "").trim() : "";
                      const description = rawDesc || "Washed to perfection. Built for everyday chaos.";
                      const bookmarked = isBookmarked(prod.id.toString());

                      return (
                        <div
                          key={prod.id}
                          className={`flex gap-3.5 items-center bg-foreground/[0.01] dark:bg-white/[0.01] border border-foreground/[0.04] dark:border-white/[0.04] p-3 rounded-2xl hover:bg-foreground/[0.02] dark:hover:bg-white/[0.02] hover:border-foreground/[0.08] dark:hover:border-white/[0.08] transition-all relative ${
                            isSoldOut ? "opacity-60" : ""
                          }`}
                        >
                          {/* Image Box */}
                          <Link
                            href={`/products/${slug}`}
                            className="w-24 sm:w-28 aspect-[3/4.4] rounded-xl overflow-hidden relative bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/[0.04] dark:border-white/[0.04] flex-shrink-0 group block"
                          >
                            <Image
                              src={img}
                              alt={prod.title}
                              fill
                              sizes="(max-width: 768px) 100px, 120px"
                              className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                              onError={handleImageError}
                            />
                            {isSoldOut && (
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                <span className="text-[6.5px] font-bold uppercase tracking-widest text-white/90">Sold Out</span>
                              </div>
                            )}
                          </Link>

                          {/* Details Column */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <Link href={`/products/${slug}`} className="block text-left min-w-0 flex-1">
                                  <h3 
                                    className="text-[10px] sm:text-xs uppercase tracking-[0.14em] text-foreground/80 font-light truncate"
                                    style={{ fontFamily: "var(--font-poppins), -apple-system, sans-serif" }}
                                  >
                                    {prod.title}
                                  </h3>
                                  {prod.product_type && (
                                    <span className="text-[6.5px] font-mono text-foreground/30 dark:text-white/30 uppercase tracking-[0.2em] mt-0.5 block">
                                      {prod.product_type}
                                    </span>
                                  )}
                                </Link>

                                <button
                                  onClick={() => toggleBookmark(prod)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors ${
                                    bookmarked ? "text-foreground dark:text-white" : "text-foreground/35 dark:text-white/35"
                                  }`}
                                  aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
                                >
                                  <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-foreground dark:fill-white" : ""}`} />
                                </button>
                              </div>

                              <div className="flex items-baseline gap-1.5 mt-1.5 text-left">
                                <span className="text-[9.5px] font-mono text-foreground/75 dark:text-white/75 font-semibold">
                                  ₹{parseFloat(price).toLocaleString("en-IN")}
                                </span>
                                {isOnSale && compareAtPrice && (
                                  <span className="text-[8px] font-mono text-foreground/25 dark:text-white/25 line-through">
                                    ₹{parseFloat(compareAtPrice).toLocaleString("en-IN")}
                                  </span>
                                )}
                              </div>

                              <p className="text-[9px] sm:text-[9.5px] text-foreground/40 dark:text-white/40 leading-relaxed font-light mt-2 line-clamp-2 text-left">
                                {description}
                              </p>
                            </div>

                            {/* Cart / Info CTA */}
                            <div className="mt-3 flex gap-2 justify-start">
                              {!isSoldOut ? (
                                <button
                                  onClick={() => setActiveModalProduct(prod)}
                                  className="py-1 px-3 rounded-lg border border-foreground/[0.08] dark:border-white/[0.08] text-[8px] uppercase tracking-widest text-foreground/60 dark:text-white/60 hover:bg-foreground dark:hover:bg-white hover:text-background dark:hover:text-black transition-all active:scale-95 flex items-center gap-1 font-medium bg-background/50 dark:bg-black/50"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Add</span>
                                </button>
                              ) : (
                                <span className="py-1 px-3 rounded-lg bg-foreground/5 dark:bg-white/5 text-foreground/25 dark:text-white/25 text-[8px] uppercase tracking-widest font-mono">
                                  Sold Out
                                </span>
                              )}
                              <Link
                                href={`/products/${slug}`}
                                className="py-1 px-3 rounded-lg border border-foreground/[0.08] dark:border-white/[0.08] text-[8px] uppercase tracking-widest text-foreground/50 dark:text-white/50 hover:text-foreground dark:hover:text-white hover:border-foreground/20 dark:hover:border-white/20 text-center transition-all active:scale-95 font-medium block"
                              >
                                Details
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Editorial view empty state picks fallback */
                  <div className="text-center py-10 text-foreground/25 font-mono text-[9px] uppercase tracking-wider">
                    No matching editorial edits found
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Quick Add Modal for Editorial picks ── */}
      {activeModalProduct && (
        <QuickAddModal product={activeModalProduct} onClose={() => setActiveModalProduct(null)} />
      )}
    </div>
  );
}
