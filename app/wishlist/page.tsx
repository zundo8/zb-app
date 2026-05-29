"use client";

import { Bookmark, ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useBookmarks } from "@/lib/bookmark-context";
import { useCart } from "@/lib/cart-context";
import { motion, AnimatePresence } from "framer-motion";

export default function WishlistPage() {
  const { bookmarks, removeBookmark } = useBookmarks();
  const { add: addToCart } = useCart();

  const handleQuickAdd = (product: any) => {
    const variant = product.variants?.[0];
    if (!variant) return;

    addToCart({
      productId: product.id.toString(),
      handle: product.handle,
      variantId: variant.id.toString(),
      title: product.title,
      size: variant.option1 || null,
      price: variant.price,
      image: product.image?.src || product.images?.[0]?.src || "/zb-logo-220px.png"
    });
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 min-h-[80vh] pb-32">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <p className="text-[8px] font-bold uppercase tracking-[0.5em] text-white/40 mb-3">Saved Pieces</p>
          <h1 className="font-heading text-[22px] uppercase tracking-[0.1em] text-white/95">Your Bookmarks</h1>
          <div className="w-8 h-[1px] bg-white/10 mx-auto mt-4" />
        </div>

        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6 border border-white/5">
              <Bookmark className="w-6 h-6 text-white/30" />
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest leading-relaxed max-w-[240px] mb-10">
              Your collection of saved luxury pieces is currently empty.
            </p>
            <Link 
              href="/" 
              className="px-10 py-4 bg-white text-black text-[9px] uppercase font-bold tracking-[0.3em] rounded-full hover:opacity-90 transition-all shadow-xl active:scale-95"
            >
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <AnimatePresence>
              {bookmarks.map((product) => (
                <motion.div 
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative flex gap-5 p-4 rounded-[2rem] glass-panel border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
                >
                  <Link href={`/products/${product.handle}`} className="shrink-0">
                    <div className="relative w-28 h-36 rounded-2xl overflow-hidden border border-white/5 shadow-lg">
                      <Image 
                        src={product.image?.src || product.images?.[0]?.src || "/zb-logo-220px.png"} 
                        alt={product.title} 
                        fill 
                        className="object-cover transition-transform duration-700 group-hover:scale-110" 
                      />
                    </div>
                  </Link>

                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="text-[12px] font-bold uppercase tracking-tight text-white/90 mb-1 line-clamp-1">
                        {product.title}
                      </h3>
                      <p className="text-[13px] font-medium tracking-tighter text-white/50">
                        ₹{parseFloat(product.variants[0].price).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleQuickAdd(product)}
                        className="flex-1 py-3.5 rounded-xl bg-white text-black text-[9px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Add to Bag
                      </button>
                      <button 
                        onClick={() => removeBookmark(product.id.toString())}
                        className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}
