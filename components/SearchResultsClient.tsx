"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShopifyProduct } from "@/lib/shopify-admin";
import ProductCard from "./ProductCard";
import SearchProductCardEditorial from "./SearchProductCardEditorial";

interface Props {
  products: ShopifyProduct[];
  query: string;
}

export default function SearchResultsClient({ products, query }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "editorial">("grid");
  const [mounted, setMounted] = useState(false);

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

  if (!mounted) {
    // Return a simple server-matching grid placeholder to avoid SSR mismatch flicker
    return (
      <div className="max-w-6xl mx-auto px-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[3px] px-[2px] md:px-1">
          {products.map((product) => (
            <div key={product.id} className="opacity-0">
              <div style={{ aspectRatio: "3 / 5.2" }} className="bg-foreground/[0.02] rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Results header & View Toggler ── */}
      <div className="flex justify-between items-center mb-8 px-1">
        <div className="flex flex-col gap-1 text-left">
          {query && (
            <h1 className="text-[10px] md:text-[11px] font-medium text-foreground/60 uppercase tracking-widest leading-none">
              &ldquo;{query}&rdquo;
            </h1>
          )}
          <p className="text-[8px] md:text-[9.5px] text-foreground/30 uppercase tracking-[0.2em] leading-none mt-1">
            {products.length} {products.length === 1 ? "result" : "results"}
          </p>
        </div>

        {/* Apple style View Toggle Pill */}
        <div className="relative flex items-center p-0.5 rounded-full bg-foreground/[0.03] border border-foreground/5 backdrop-blur-md">
          {[
            { id: "grid", label: "Grid" },
            { id: "editorial", label: "Editorial" },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleToggleView(mode.id as "grid" | "editorial")}
              className={`relative z-10 px-4 py-1.5 rounded-full text-[8.5px] uppercase tracking-widest font-medium transition-all duration-300 ${
                viewMode === mode.id
                  ? "text-background font-bold"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {mode.label}
              {viewMode === mode.id && (
                <motion.div
                  layoutId="activeSearchLayoutPill"
                  className="absolute inset-0 bg-foreground rounded-full -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Products Display (Grid vs Editorial) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full px-1 pb-16"
        >
          {viewMode === "grid" ? (
            /* Standard grid view layout matches collections page */
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[3px] px-[2px] md:px-1">
              {products.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={idx < 4}
                />
              ))}
            </div>
          ) : (
            /* Magazine/Lookbook layout blocks */
            <div className="flex flex-col gap-16 max-w-6xl mx-auto">
              {(() => {
                const chunks: ShopifyProduct[][] = [];
                for (let i = 0; i < products.length; i += 4) {
                  chunks.push(products.slice(i, i + 4));
                }
                return chunks.map((chunk, idx) => (
                  <SearchProductCardEditorial
                    key={`lookbook-chunk-${idx}`}
                    chunk={chunk}
                    index={idx}
                    priority={idx === 0}
                  />
                ));
              })()}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
