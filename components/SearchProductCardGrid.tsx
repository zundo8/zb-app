"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { ShopifyProduct } from "@/lib/shopify-admin";
import ProductCardImage from "./ProductCardImage";
import { useCountry } from "@/lib/country-context";

// Lazy-load modal to avoid SSR issues
const QuickAddModal = dynamic(() => import("./QuickAddModal"), { ssr: false });

interface Props {
  product: ShopifyProduct;
  priority?: boolean;
  selectedSize?: string;
}

export default function SearchProductCardGrid({ product, priority = false, selectedSize }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const variant = product.variants?.[0];
  const price = variant?.price || "0";
  const compareAtPrice = variant?.compare_at_price;
  const isOnSale = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price);
  const { formatPrice: fmtPrice } = useCountry();

  const productSlug = product.handle || product.id;

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setTimeout(() => {
      setShowModal(true);
      setIsAdding(false);
    }, 300);
  };

  const isSoldOut = product.variants ? !product.variants.some(v => (v.inventory_quantity || 0) > 0) : true;

  // Extract unique sizes for quick hover view
  const sizes = product.variants
    ?.map((v) => ({ size: v.option1 ?? "One Size", inventory: v.inventory_quantity || 0 }))
    .filter((v, i, a) => a.findIndex((x) => x.size === v.size) === i) || [];

  return (
    <>
      <div 
        className={`group relative w-full flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-500 bg-foreground/[0.01] border border-foreground/[0.03] hover:bg-foreground/[0.02] hover:border-foreground/[0.08] hover:shadow-lg hover:-translate-y-1 ${
          isSoldOut ? "opacity-60" : ""
        }`}
      >
        {/* Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
          {isSoldOut ? (
            <div className="bg-black/50 border border-white/10 px-2 py-0.5 rounded-[4px] backdrop-blur-md">
              <span className="text-[6px] md:text-[7px] font-bold uppercase tracking-widest text-white/90">Sold Out</span>
            </div>
          ) : isOnSale && (
            <div className="bg-black/90 px-2 py-0.5 rounded-[4px] border border-white/5">
              <span className="text-[6px] md:text-[7px] font-bold uppercase tracking-widest text-white">Sale</span>
            </div>
          )}
        </div>

        {/* Product Image Wrapper */}
        <div className="relative w-full overflow-hidden">
          <ProductCardImage
            images={product.images || []}
            title={product.title}
            priority={priority}
            isSoldOut={isSoldOut}
            productSlug={productSlug}
          />

          {/* Floating Size pills overlay on hover (desktop only) */}
          {sizes.length > 0 && !isSoldOut && (
            <div className="absolute bottom-3 inset-x-2 z-10 flex flex-wrap gap-1 justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 pointer-events-none sm:pointer-events-auto">
              {sizes.map((s) => {
                const isOutOfStock = s.inventory <= 0;
                return (
                  <span
                    key={s.size}
                    className={`px-1.5 py-0.5 rounded-[4px] text-[7px] uppercase tracking-wider font-light transition-all ${
                      isOutOfStock
                        ? "bg-black/20 text-white/25 border border-white/5 line-through decoration-white/20 backdrop-blur-sm"
                        : "bg-background/95 hover:bg-foreground hover:text-background text-foreground/80 border border-foreground/5 shadow-sm"
                    }`}
                  >
                    {s.size}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Row */}
        <div className="flex flex-col flex-1 justify-between p-3.5 leading-tight">
          <Link href={`/products/${productSlug}`} className="block flex-1 min-w-0 mb-3">
            {/* Category / Vendor if available */}
            {product.product_type && (
              <p className="text-[6.5px] font-mono text-foreground/35 uppercase tracking-[0.25em] mb-1">
                {product.product_type}
              </p>
            )}
            
            <p 
              className="text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-foreground/85 leading-normal truncate group-hover:text-foreground transition-colors font-light"
              style={{ fontFamily: "var(--font-geist-sans), -apple-system, sans-serif" }}
            >
              {product.title}
            </p>
            
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[9px] md:text-[10px] font-normal tracking-tight text-foreground/60">
                {fmtPrice(parseFloat(price)).formatted}
              </p>
              {isOnSale && compareAtPrice && (
                <p className="text-[8px] md:text-[9px] font-normal tracking-tight text-foreground/25 line-through decoration-foreground/15">
                  {fmtPrice(parseFloat(compareAtPrice)).formatted}
                </p>
              )}
            </div>
          </Link>

          {/* Quick-Add button */}
          {!isSoldOut && (
            <button
              onClick={handleOpenModal}
              aria-label="Quick add to cart"
              className="w-full py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-300 bg-foreground/[0.02] border border-foreground/[0.06] hover:bg-foreground hover:text-background text-[8px] uppercase tracking-widest text-foreground/60 hover:text-background active:scale-[0.98] mt-auto font-medium"
            >
              {isAdding ? (
                <div className="w-2.5 h-2.5 rounded-full border border-foreground/30 border-t-foreground/85 animate-spin" />
              ) : (
                <>
                  <Plus className="w-3 h-3 text-current" strokeWidth={2} />
                  <span>Quick Add</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Quick-Add Modal */}
      {showModal && (
        <QuickAddModal product={product} initialSize={selectedSize} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
