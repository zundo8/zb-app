"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { ShopifyProduct } from "@/lib/shopify-admin";
import { handleImageError } from "./ImagePlaceholder";

// Lazy-load modal to avoid SSR issues
const QuickAddModal = dynamic(() => import("./QuickAddModal"), { ssr: false });

interface Props {
  product: ShopifyProduct;
  priority?: boolean;
  selectedSize?: string;
}

export default function ProductCard({ product, priority = false, selectedSize }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const image = product.images?.[0]?.src || "/zb-logo-220px.png";
  const variant = product.variants?.[0];
  const price = variant?.price || "0";
  const compareAtPrice = variant?.compare_at_price;
  const isOnSale = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price);

  // Use handle for SEO-friendly URLs — falls back to id if handle unavailable
  const productSlug = product.handle || product.id;

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setTimeout(() => {
      setShowModal(true);
      setIsAdding(false);
    }, 300);
  };

  const totalStock = product.variants?.reduce((acc, v) => acc + (v.inventory_quantity || 0), 0) || 0;
  // Sold out ONLY if all variants are out of stock
  const isSoldOut = product.variants ? !product.variants.some(v => (v.inventory_quantity || 0) > 0) : true;

  return (
    <>
      <div className={`group relative w-full ${isSoldOut ? "opacity-60" : ""}`}>
        {/* Badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {isSoldOut ? (
            <div className="glass-badge" style={{ padding: "2px 6px" }}>
              <span className="text-[6px] font-bold uppercase tracking-tighter text-foreground/80">Sold Out</span>
            </div>
          ) : isOnSale && (
            <div
              className="px-1.5 py-[1px] rounded-[2px] leading-none"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <span className="text-[6px] font-bold uppercase tracking-tighter text-black">Sale</span>
            </div>
          )}
        </div>

        {/* Image */}
        <Link href={`/products/${productSlug}`} className="block">
          <div className="aspect-[3/4.2] relative rounded-[8px] overflow-hidden mb-2"
            style={{
              border: "1px solid rgba(0, 0, 0, 0.04)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
            }}
          >
            <Image
              src={image}
              alt={product.title}
              fill
              priority={priority}
              onError={handleImageError}
              sizes="(max-width: 768px) 50vw, 360px"
              className={`object-cover transition-all duration-700 ${!isSoldOut ? "group-hover:scale-[1.04]" : ""}`}
              style={isSoldOut ? { filter: "grayscale(0.4)" } : image === "/zb-logo-220px.png" ? { objectFit: "contain", padding: "25%", opacity: 0.3 } : {}}
            />
            {/* Hover glass overlay */}
            {!isSoldOut && (
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.25) 100%)",
                }}
              />
            )}
          </div>
        </Link>

        {/* Info row with "+" button */}
        <div className="flex justify-between items-start leading-tight px-1 pb-1">
          <div className="flex-1 min-w-0 pr-1.5 flex flex-col gap-0.5">
            <p className="text-[7.5px] sm:text-[8.5px] font-sans font-bold uppercase tracking-[0.15em] text-foreground/50 leading-none truncate pt-0.5">
              {product.title}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-[8px] sm:text-[9px] font-sans font-medium tracking-tight text-foreground/70 uppercase">
                ₹{parseFloat(price).toLocaleString("en-IN")}
              </p>
              {isOnSale && compareAtPrice && (
                <p className="text-[7px] font-sans font-normal tracking-tight text-foreground/25 uppercase line-through">
                  ₹{parseFloat(compareAtPrice).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </div>

          {!isSoldOut && (
            <button
              onClick={handleOpenModal}
              aria-label="Quick add to cart"
              className="w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0 bg-transparent hover:bg-foreground/5 mt-0.5"
            >
              {isAdding ? (
                <div className="w-2.5 h-2.5 rounded-full border border-foreground/30 border-t-foreground/80 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-foreground/40 transition-colors group-hover:text-foreground/80" strokeWidth={1.5} />
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
