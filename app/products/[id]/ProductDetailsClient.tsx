"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Bookmark, X, Plus, ChevronLeft, ArrowLeft, ArrowRight } from "lucide-react";
import * as fp from "@/lib/meta-pixel";
import { ShopifyProduct } from "@/lib/shopify-admin";
import { parseShopifyRichText, matchKey } from "@/lib/utils";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart-context";
import { useBookmarks } from "@/lib/bookmark-context";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { handleImageError } from "@/components/ImagePlaceholder";
import dynamic from "next/dynamic";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const CheckoutWebView = dynamic(() => import("@/components/CheckoutWebView"), { ssr: false });
const OrderSuccess = dynamic(() => import("@/components/OrderSuccess"), { ssr: false });
const QuickAddModal = dynamic(() => import("@/components/QuickAddModal"), { ssr: false });

interface ShopSettings {
  showProductVideo: boolean;
  showSizeChart: boolean;
  showBrand: boolean;
  showShippingReturn: boolean;
  showCare: boolean;
  showSizeFit: boolean;
  showDetails: boolean;
  pdpBackground?: string;
}

export default function ProductDetailsClient({ 
  product, 
  shopSettings, 
  recommendedProducts = [],
  allImages = []
}: { 
  product: ShopifyProduct; 
  shopSettings?: ShopSettings | null;
  recommendedProducts?: ShopifyProduct[];
  allImages?: any[];
}) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("details");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [winHeight, setWinHeight] = useState(800);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isAdded, setIsAdded] = useState(false);
  const [[page, dragDirection], setPage] = useState([0, 0]);
  const [quickAddProduct, setQuickAddProduct] = useState<ShopifyProduct | null>(null);

  const imageIndex = ((page % allImages.length) + allImages.length) % allImages.length;
  
  useEffect(() => {
    setActiveImg(imageIndex);
  }, [imageIndex]);

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };


  // Refs for scroll sync — avoids fragile querySelector
  const bgScrollRef = useRef<HTMLDivElement>(null);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  const { add: addToCart } = useCart();
  const { toggleBookmark, isBookmarked, setIsOpen } = useBookmarks();
  const { addProduct: recordVisit, recentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    setWinHeight(window.innerHeight);
    recordVisit(product);
  }, [product, recordVisit]);

  // Optimized Scroll Effects for Safari
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scroll = window.scrollY;
          setScrollPos(scroll);
          
          const overlay = document.getElementById('pdp-blur-overlay-internal');
          if (overlay) {
            const opacity = Math.min(scroll / 600, 0.4);
            overlay.style.backgroundColor = `rgba(0,0,0, ${opacity})`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Robust helper to get metafield by key (case-insensitive, space/hyphen agnostic)
  const getMeta = (key: string) => {
    if (!product.metafields) return null;
    const found = product.metafields.find(m => matchKey(m.key, key));
    return found?.value;
  };

  const sizes = product.variants
    ?.map(v => v.option1) // Assuming option1 is Size
    .filter((v, i, a) => v && a.indexOf(v) === i) || [];

  const handleAddToBag = () => {
    if (!selectedSize && sizes.length > 0) {
      alert("Please select a size first!");
      return;
    }

    const variant = product.variants?.find(v => v.option1 === selectedSize) || product.variants?.[0];

    if (!variant) {
      alert("This product is currently unavailable.");
      return;
    }

    if ((variant.inventory_quantity || 0) <= 0) {
      alert("This size is currently sold out.");
      return;
    }

    addToCart({
      productId: product.id.toString(),
      handle: product.handle,
      variantId: variant.id.toString(),
      title: product.title,
      size: selectedSize,
      price: variant.price,
      image: product.image?.src || product.images[0]?.src || "/zb-logo-220px.png"
    });

    // Track AddToCart in Meta Pixel
    fp.event("AddToCart", {
      content_ids: [product.id.toString()],
      content_name: product.title,
      content_type: "product",
      value: parseFloat(variant.price || "0"),
      currency: "INR"
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNow = async () => {
    if (!selectedSize && sizes.length > 0) {
      alert("Please select a size first!");
      return;
    }

    const variant = product.variants?.find((v) => v.option1 === selectedSize) || product.variants?.[0];

    if (!variant) {
      alert("This product is currently unavailable.");
      return;
    }

    if ((variant.inventory_quantity || 0) <= 0) {
      alert("This size is currently sold out.");
      return;
    }

    addToCart({
      productId: product.id.toString(),
      handle: product.handle,
      variantId: variant.id.toString(),
      title: product.title,
      size: selectedSize,
      price: variant.price,
      image: product.image?.src || product.images[0]?.src || "/zb-logo-220px.png"
    });

    // Track AddToCart in Meta Pixel
    fp.event("AddToCart", {
      content_ids: [product.id.toString()],
      content_name: product.title,
      content_type: "product",
      value: parseFloat(variant.price || "0"),
      currency: "INR"
    });

    router.push("/checkout");
  };

  const initialPrice = product.variants?.[0]?.price || "0.00";
  const comparePrice = product.variants?.[0]?.compare_at_price;
  const activeVariant = product.variants?.find(v => v.option1 === selectedSize) || product.variants?.[0];
  const isVariantSoldOut = activeVariant ? (activeVariant.inventory_quantity || 0) <= 0 : true;
  const productVideoUrl = getMeta('product-video');
  const sizeChartImageUrl = getMeta('size-chart-image');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    if (index !== activeImg) {
      setActiveImg(index);
    }
  };

  const tabs = [
    { id: 'details', label: 'Description', show: shopSettings?.showDetails ?? true },
    { id: 'more-details', label: 'Details', show: (shopSettings?.showDetails ?? true) && !!getMeta('DETAILS') },
    { id: 'size-fit', label: 'Size & Fit', show: (shopSettings?.showSizeFit ?? true) && !!getMeta('SIZE & FIT') },
    { id: 'care', label: 'Care', show: (shopSettings?.showCare ?? true) && !!getMeta('CARE') },
    { id: 'shipping', label: 'Shipping & Return', show: (shopSettings?.showShippingReturn ?? true) && !!getMeta('SHIPPING & RETURN') },
    { id: 'brand', label: 'Brand', show: (shopSettings?.showBrand ?? true) && !!getMeta('BRAND') },
  ].filter(t => t.show);

  // Client-side randomization for Recommended Products
  const [shuffledRecommended, setShuffledRecommended] = useState<ShopifyProduct[]>([]);

  useEffect(() => {
    if (recommendedProducts.length > 0) {
      const shuffled = [...recommendedProducts].sort(() => Math.random() - 0.5);
      setShuffledRecommended(shuffled);
    }
  }, [recommendedProducts]);

  // Curated Pairs Carousel Logic - Mirroring RingCarouselSection smoothness
  const curatedScrollRef = useRef<HTMLDivElement>(null);
  const [isCuratedDragging, setIsCuratedDragging] = useState(false);
  const [curatedStartX, setCuratedStartX] = useState(0);
  const [curatedScrollLeft, setCuratedScrollLeft] = useState(0);

  const onCuratedMouseDown = (e: React.MouseEvent) => {
    setIsCuratedDragging(true);
    if (curatedScrollRef.current) {
        setCuratedStartX(e.pageX - curatedScrollRef.current.offsetLeft);
        setCuratedScrollLeft(curatedScrollRef.current.scrollLeft);
    }
  };

  const onCuratedMouseMove = (e: React.MouseEvent) => {
    if (!isCuratedDragging || !curatedScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - curatedScrollRef.current.offsetLeft;
    const walk = (x - curatedStartX) * 1.8;
    curatedScrollRef.current.scrollLeft = curatedScrollLeft - walk;
  };

  const stopCuratedDrag = () => setIsCuratedDragging(false);

  return (
    <>
      {/* ─── DESKTOP VIEW (md and up) ─── */}
      <div className="hidden md:block min-h-screen pt-28 pb-20 px-6 max-w-7xl mx-auto relative z-10 text-foreground">
        <div className="grid grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Media Gallery */}
          <div className="col-span-6 sticky top-28 space-y-6 flex flex-col items-center w-full">
            <div className="relative aspect-[4/5] w-full max-w-[450px] rounded-3xl overflow-hidden border border-foreground/5 shadow-2xl bg-foreground/[0.01]">
              <Image
                src={allImages[activeImg]?.src || "/zb-logo-220px.png"}
                alt={product.title}
                fill
                className="object-cover transition-all duration-[1200ms]"
                priority
                sizes="(max-width: 1200px) 50vw, 600px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            </div>
            
            {/* Gallery Thumbnails List */}
            <div className="flex flex-wrap gap-2 justify-center">
              {allImages.map((img, i) => (
                <button
                  key={`gal-desk-${i}`}
                  onClick={() => setActiveImg(i)}
                  className={`relative w-14 h-14 rounded-xl overflow-hidden border transition-all duration-500 shadow-md ${
                    activeImg === i ? "border-foreground scale-105 shadow-lg" : "border-foreground/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={img.src} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Checkout Info & Tabs */}
          <div className="col-span-6 space-y-4 glass-panel border border-black/5 dark:border-white/5 rounded-3xl p-6 bg-white/30 dark:bg-black/30 backdrop-blur-[30px] shadow-[0_15px_35px_rgba(0,0,0,0.1)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-[14px] font-bold tracking-[0.2em] uppercase text-foreground font-heading mb-1.5 leading-snug">{product.title}</h1>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground/60 tracking-tight">₹{parseFloat(initialPrice).toLocaleString('en-IN')}</span>
                  {comparePrice && parseFloat(comparePrice) > parseFloat(initialPrice) && (
                    <span className="text-[10px] font-light text-foreground/20 line-through tracking-wider">₹{parseFloat(comparePrice).toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectedSize && sizes.length > 0) {
                    alert("Please select a size first!");
                    return;
                  }
                  toggleBookmark(product);
                  setIsOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-foreground/5 border border-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-all active:scale-90 flex-shrink-0"
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked(product.id.toString()) ? "text-primary fill-primary" : "text-foreground/50"}`} />
              </button>
            </div>

            {/* Size Selector */}
            {sizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[7.5px] font-bold uppercase tracking-[0.3em] text-foreground/40">Select Size</span>
                  {(shopSettings?.showSizeChart ?? true) && sizeChartImageUrl && (
                    <button onClick={() => setShowSizeChart(true)} className="text-[7.5px] font-bold text-foreground/40 hover:text-foreground transition-all uppercase tracking-[0.15em] border-b border-foreground/10">
                      Guide
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {sizes.map((size) => {
                    const variant = product.variants?.find(v => v.option1 === size);
                    const isOutOfStock = (variant?.inventory_quantity || 0) <= 0;
                    return (
                      <button
                        key={`desk-size-${size}`}
                        onClick={() => setSelectedSize(size)}
                        className={`h-8 flex items-center justify-center rounded-lg text-[8px] font-medium uppercase tracking-widest transition-all border relative overflow-hidden ${
                          selectedSize === size
                            ? "bg-foreground text-background border-transparent shadow-sm"
                            : isOutOfStock
                            ? "bg-foreground/[0.01] border-foreground/5 text-foreground/15 cursor-not-allowed"
                            : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:border-foreground/20 hover:text-foreground/90"
                        }`}
                      >
                        {size}
                        {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-[120%] h-[1px] bg-foreground/10 rotate-[35deg] transform-gpu" /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Call to Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleAddToBag}
                disabled={isAdded || isVariantSoldOut}
                className="w-full py-3 flex items-center justify-center text-[9px] font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.99] rounded-lg bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 text-foreground/90 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isAdded ? "Added to Bag!" : isVariantSoldOut ? "Sold Out" : "Add to Bag"}
              </button>
              {!isVariantSoldOut && (
                <button
                  onClick={handleBuyNow}
                  disabled={isCheckingOut}
                  className="w-full py-3 rounded-lg text-background text-[9px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-[0.99] shadow-md flex items-center justify-center gap-2 disabled:opacity-60 bg-foreground"
                >
                  {isCheckingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Buy Now"}
                </button>
              )}
            </div>

            {/* Tabs details */}
            <div className="p-3.5 rounded-xl border border-foreground/5 bg-foreground/[0.01] space-y-3">
              <div className="flex overflow-x-auto hide-scrollbar gap-1.5 border-b border-foreground/5 pb-1.5">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 px-2.5 py-1 rounded-full text-[7.5px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-foreground text-background font-bold shadow-md" : "text-foreground/40 hover:text-foreground/60 bg-transparent"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="text-[9.5px] font-light leading-relaxed text-foreground/60 min-h-[50px]">
                {activeTab === "details" ? (
                  <div>
                    <div className={`space-y-2 ${!isDescriptionExpanded ? 'line-clamp-2' : ''}`} dangerouslySetInnerHTML={{ __html: product.body_html || "" }} />
                    <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="mt-2.5 px-2 py-0.5 rounded-full text-[5.5px] font-bold uppercase tracking-[0.15em] transition-all bg-foreground/5 border border-foreground/5 text-foreground/60 hover:text-foreground">
                      {isDescriptionExpanded ? "View Less" : "View More"}
                    </button>
                  </div>
                ) : (
                  tabs.map(tab => activeTab === tab.id && (
                    <div key={tab.id} className="animate-in fade-in duration-700" dangerouslySetInnerHTML={{ __html: parseShopifyRichText(getMeta(tab.label.toUpperCase())) }} />
                  ))
                )}
              </div>
            </div>

            {/* Experimental Reference Video */}
            {(shopSettings?.showProductVideo ?? true) && productVideoUrl && (
              <div className="space-y-2">
                <span className="text-[7.5px] font-bold uppercase tracking-[0.3em] text-foreground/40 block">Experimental Reference</span>
                <div className="relative aspect-[9/16] max-w-[200px] mx-auto rounded-2xl overflow-hidden border border-foreground/5 shadow-inner cursor-pointer" onClick={() => setIsMuted(!isMuted)}>
                  <video src={productVideoUrl} autoPlay loop muted={isMuted} playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 right-4 z-10">{isMuted ? <X className="w-3 h-3 text-white/50" /> : <div className="flex items-center gap-0.5 opacity-80"><div className="w-[1px] h-1.5 bg-white animate-pulse" /><div className="w-[1px] h-2 bg-white animate-pulse" style={{ animationDelay: '0.1s' }} /></div>}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recommended & Curated Pairs Row inside Widescreen */}
        {shuffledRecommended.length > 0 && (
          <div className="mt-20 border-t border-foreground/10 pt-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs uppercase tracking-[0.25em] text-foreground font-rocaston flex items-center">
                CURATED PAIR
                <span className="inline-flex items-center justify-center border border-foreground rounded-full w-3.5 h-3.5 text-[6.5px] ml-1.5 font-sans font-bold leading-none pt-[0.5px]">S</span>
              </h2>
              <div className="flex items-center gap-4">
                <button 
                  className="flex items-center justify-center p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground transition-all hover:border-foreground/30 active:scale-95"
                  onClick={() => curatedScrollRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
                  aria-label="Previous Curated Items"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1} />
                </button>
                <button 
                  className="flex items-center justify-center p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground transition-all hover:border-foreground/30 active:scale-95"
                  onClick={() => curatedScrollRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}
                  aria-label="Next Curated Items"
                >
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1} />
                </button>
              </div>
            </div>
            
            <div 
              ref={curatedScrollRef}
              className="flex overflow-x-auto hide-scrollbar scroll-smooth snap-x border-y border-foreground/10 py-6 gap-4"
            >
              {shuffledRecommended.map((p, idx) => {
                const initialPrice = p.variants?.[0]?.price || "0.00";
                return (
                  <div 
                    key={`desk-pair-${p.id}`}
                    className="min-w-[240px] w-[240px] snap-start flex flex-col group cursor-pointer border-r border-foreground/10 last:border-r-0 pr-4 transition-all duration-300"
                    onClick={() => router.push(`/products/${p.handle}`)}
                  >
                    <div className="relative aspect-[3/5] w-full rounded-2xl overflow-hidden mb-3 bg-foreground/[0.02]">
                      <Image 
                        src={p.image?.src || p.images?.[0]?.src || "/zb-logo-220px.png"} 
                        alt={p.title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-700" 
                        sizes="300px"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 px-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-rocaston tracking-[0.15em] uppercase text-foreground/80 line-clamp-1">
                          {p.title}
                        </span>
                        <span className="text-[10px] font-light text-foreground/45">
                          ₹{parseFloat(initialPrice).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground active:scale-90 transition-all border border-foreground/10 hover:border-foreground/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickAddProduct(p);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={1} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── MOBILE VIEW (sm and below) ─── */}
      <div className="md:hidden">
        {/* Sticky Background Gallery with Rounded Bottom Corners */}
        <div className="sticky top-0 w-full h-[85dvh] overflow-hidden z-0 rounded-b-[1rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div 
            className="relative w-full h-full"
            style={{
              background: "hsla(var(--glass-bg), 0.1)",
            }}
          >
            <AnimatePresence initial={false} custom={dragDirection} mode="popLayout">
              <motion.div
                key={page}
                custom={dragDirection}
                initial={{ opacity: 0, x: dragDirection > 0 ? '100%' : '-100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dragDirection > 0 ? '-100%' : '100%' }}
                transition={{
                  x: { 
                      type: "spring", 
                      stiffness: 280, 
                      damping: 32, 
                      mass: 0.8,
                      restDelta: 0.001
                  },
                  opacity: { duration: 0.5, ease: "circOut" }
                }}
                className="absolute inset-0"
              >
                <Image
                  src={allImages[imageIndex]?.src || "/zb-logo-220px.png"}
                  alt={product.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                  quality={100}
                  draggable={false}
                  onError={handleImageError}
                />
              </motion.div>
            </AnimatePresence>
            
            {/* Parallax Overlay - darkens slightly as user scrolls down */}
            <motion.div 
              className={`absolute inset-0 z-10 pointer-events-none transition-colors duration-1000`}
              id="pdp-blur-overlay-internal"
              style={{
                backgroundColor: "rgba(0,0,0,0)",
              }}
            />
          </div>
        </div>

        {/* Scrollable Layer - iOS Optimized */}
        <div className="relative z-20 -mt-[85dvh] min-h-[100vh]">
          
          {/* Transparent Gesture & Spacer Layer - FEATHER TOUCH READY */}
          <div className="relative h-[85dvh] w-full group">
            <motion.div 
              className="absolute inset-0 z-0 touch-pan-y cursor-zoom-in"
              onClick={() => setIsGalleryOpen(true)}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = Math.abs(offset.x) > 20 || Math.abs(velocity.x) > 300;
                if (swipe) {
                  paginate(offset.x > 0 ? -1 : 1);
                }
              }}
            />
            {/* Precise 1px Gap at the bottom of the sticky area */}
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-background/5 transition-opacity" />
          </div>

          {/* Repositioned Thumbnails - Looping Sync */}
          <div className="relative z-30 px-4 pb-2 mt-[1px]">
            <div className="flex overflow-x-auto gap-1 py-2 hide-scrollbar snap-x justify-start sm:justify-center items-center -mx-2 px-2">
              {allImages.map((img, i) => (
                <button
                  key={`thumb-ios-loop-v4-${img.src || i}`}
                  onClick={() => {
                    const currentImageIndex = imageIndex;
                    const diff = i - currentImageIndex;
                    if (diff !== 0) paginate(diff);
                  }}
                  className={`relative w-28 h-28 rounded-[2rem] overflow-hidden flex-shrink-0 snap-center border transition-all duration-500 shadow-xl outline-none ${
                      imageIndex === i 
                      ? "border-white/90 scale-105 ring-2 ring-white/30" 
                      : "border-white/10 scale-95 hover:border-white/30"
                  }`}
                >
                  <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none" />
                  <Image 
                    src={img.src || "/zb-logo-220px.png"} 
                    alt="variant" 
                    fill 
                    className="object-cover transition-transform duration-700" 
                    sizes="120px" 
                    quality={100} 
                    priority={i < 4}
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 1px Gap before the details box */}
          <div className="h-[1px] w-full" />

          <main className="relative z-20 product-page px-[1px] pb-[1px]">
            <div 
              className="min-h-[60vh] rounded-[2rem] px-4 pt-6 pb-6 border border-white/5 glass-panel bg-black/60 shadow-2xl backdrop-blur-[35px]"
            >

              <div className="flex justify-between items-start mb-2 px-1">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-[11px] sm:text-[12px] font-bold tracking-[0.25em] uppercase leading-tight text-foreground/90 font-heading">
                      {product.title}
                    </h1>
                    {comparePrice && parseFloat(comparePrice) > parseFloat(initialPrice) && (
                      <div className="bg-foreground text-background px-1.5 py-[1px] rounded-[2px] leading-none mb-1">
                        <span className="text-[6px] font-bold uppercase tracking-tighter whitespace-nowrap">Sale</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-normal text-foreground/60 dark:text-foreground/40 tracking-tight">₹{parseFloat(initialPrice).toLocaleString('en-IN')}</span>
                    {comparePrice && parseFloat(comparePrice) > parseFloat(initialPrice) && (
                      <span className="text-[10px] font-light text-foreground/15 line-through tracking-wider">₹{parseFloat(comparePrice).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedSize && sizes.length > 0) {
                      alert("Please select a size first!");
                      return;
                    }
                    toggleBookmark(product);
                    setIsOpen(true);
                  }}
                  className="w-8 h-8 rounded-full bg-foreground/5 border border-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-all active:scale-90"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked(product.id.toString()) ? "text-primary fill-primary" : "text-foreground/60 dark:text-foreground/40"}`} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {/* Size Section - Ultra Tiny */}
                {sizes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[7px] font-bold uppercase tracking-[0.4em] text-foreground/40 dark:text-foreground/20">Select Size</span>
                      {(shopSettings?.showSizeChart ?? true) && sizeChartImageUrl && (
                        <button onClick={() => setShowSizeChart(true)} className="text-[7px] font-bold text-foreground/40 dark:text-foreground/20 hover:text-foreground transition-all uppercase tracking-[0.2em] border-b border-foreground/5">
                          Guide
                        </button>
                      )}
                    </div>
                    {/* Equal-size 6-column grid — matches QuickAddModal */}
                    <div className="grid grid-cols-6 gap-1.5 px-0.5">
                      {sizes.map((size) => {
                        const variant = product.variants?.find(v => v.option1 === size);
                        const isOutOfStock = (variant?.inventory_quantity || 0) <= 0;
                        return (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`h-9 w-full flex items-center justify-center rounded-lg text-[8px] font-medium uppercase tracking-widest transition-all border relative overflow-hidden ${
                              selectedSize === size
                                ? "bg-foreground text-background border-transparent shadow-sm"
                                : isOutOfStock
                                ? "bg-foreground/[0.01] border-foreground/[0.04] text-foreground/15 cursor-not-allowed"
                                : "bg-foreground/[0.03] border-foreground/[0.07] text-foreground/60 dark:text-foreground/40 hover:border-foreground/20 hover:text-foreground/70"
                            }`}
                          >
                            {size}
                            {isOutOfStock && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-[120%] h-[1px] bg-foreground/10 rotate-[35deg] transform-gpu" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-0.5">
                  {(() => {
                    const variant = product.variants?.find(v => v.option1 === selectedSize) || product.variants?.[0];
                    const isVariantSoldOut = (variant?.inventory_quantity || 0) <= 0;
                    
                    return (
                      <>
                        <button
                          onClick={handleAddToBag}
                          disabled={isAdded || isVariantSoldOut}
                          className="w-full py-3.5 flex items-center justify-center text-[9px] font-bold uppercase tracking-[0.25em] transition-all active:scale-[0.99] glass-button rounded-xl bg-foreground/5 border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 text-foreground/90 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <AnimatePresence mode="wait">
                            {isAdded ? (
                              <motion.span
                                key="added"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="flex items-center gap-2"
                              >
                                Added to Bag!
                              </motion.span>
                            ) : isVariantSoldOut ? (
                              <motion.span
                                key="soldout"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                              >
                                Sold Out
                              </motion.span>
                            ) : (
                              <motion.span
                                key="add"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                              >
                                Add to Bag
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                        {!isVariantSoldOut && (
                          <button
                            onClick={handleBuyNow}
                            disabled={isCheckingOut}
                            className="w-full py-3.5 rounded-[0.8rem] text-background text-[9px] font-bold uppercase tracking-[0.25em] hover:opacity-90 transition-all active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{
                              background: "hsl(var(--foreground))",
                              boxShadow: "0 8px 32px -8px hsl(var(--foreground) / 0.3)"
                            }}
                          >
                            {isCheckingOut ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…</>
                            ) : (
                              "Buy Now"
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  {checkoutError && (
                    <p className="text-[8px] text-red-400/80 text-center mt-1 px-2">{checkoutError}</p>
                  )}
                </div>

                <div 
                  className="mt-0.5 p-3 rounded-[1.5rem] glass-panel border-foreground/5 bg-foreground/[0.01]"
                >
                  <div className="flex overflow-x-auto hide-scrollbar gap-1.5 mb-2 px-0.5">
                    {tabs.map((tab) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-[7px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-foreground text-background font-bold shadow-lg" : "text-foreground/40 hover:text-foreground/60 bg-transparent"}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div 
                    className="rounded-[1rem] p-3 border border-foreground/5 bg-foreground/[0.01]"
                  >
                    {activeTab === "details" ? (
                      <div className="relative">
                        <div className={`text-[9.5px] font-light leading-[1.6] tracking-wide text-foreground/80 dark:text-foreground/60 space-y-3 ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`} dangerouslySetInnerHTML={{ __html: product.body_html || "" }} />
                        <button 
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} 
                          className="mt-3 px-3 py-1 rounded-full text-[6px] font-bold uppercase tracking-[0.15em] transition-all bg-foreground/5 border border-foreground/5 text-foreground/60 dark:text-foreground/40 hover:text-foreground"
                        >
                          {isDescriptionExpanded ? "View Less" : "View More"}
                        </button>
                      </div>
                    ) : (
                      tabs.map(tab => activeTab === tab.id && (
                        <div key={tab.id} className="animate-in fade-in duration-700 text-[9.5px] font-light leading-[1.6] text-foreground/80 dark:text-foreground/60" dangerouslySetInnerHTML={{ __html: parseShopifyRichText(getMeta(tab.label.toUpperCase())) }} />
                      ))
                    )}
                  </div>
                </div>

                {(shopSettings?.showProductVideo ?? true) && productVideoUrl && (
                  <div className="mt-1 -mx-0.5">
                    <span className="text-[7.5px] font-bold uppercase tracking-[0.4em] text-foreground/40 dark:text-foreground/20 ml-1 mb-1.5 block">Experimental Reference</span>
                    <div 
                      className="relative aspect-[9/16] rounded-[2.2rem] overflow-hidden bg-foreground/[0.02] border border-foreground/[0.05] shadow-inner cursor-pointer"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      <video 
                        key={productVideoUrl} 
                        autoPlay 
                        loop 
                        muted={isMuted} 
                        playsInline 
                        className="w-full h-full object-cover pointer-events-none"
                      >
                        <source src={productVideoUrl} type="video/mp4" />
                      </video>
                      {/* Premium Minimal Audio Indicator */}
                      <div className="absolute bottom-4 right-4 z-10">
                        {isMuted ? (
                          <X className="w-2.5 h-2.5 text-white/50" />
                        ) : (
                          <div className="flex items-center gap-0.5 opacity-80">
                            <div className="w-[1.5px] h-2 bg-white animate-pulse" />
                            <div className="w-[1.5px] h-2.5 bg-white animate-pulse" style={{ animationDelay: '0.1s' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommended Products - Curated Pairs Minimal Glass Overhaul */}
                {shuffledRecommended.length > 0 && (
                  <div className="mt-8 mb-6 -mx-1 border-t border-foreground/5 bg-transparent">
                      <div className="flex items-center justify-between px-4 py-3">
                          <h2 className="text-xs uppercase tracking-[0.25em] text-foreground font-rocaston flex items-center">
                            CURATED PAIR
                            <span className="inline-flex items-center justify-center border border-foreground rounded-full w-3.5 h-3.5 text-[6.5px] ml-1.5 font-sans font-bold leading-none pt-[0.5px]">S</span>
                          </h2>
                          <div className="flex items-center gap-4">
                            <button 
                              className="flex items-center justify-center p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground active:scale-95 transition-all"
                              onClick={() => {
                                if (curatedScrollRef.current) {
                                  curatedScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' });
                                }
                              }}
                              aria-label="Previous Curated Items"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1} />
                            </button>
                            <button 
                              className="flex items-center justify-center p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground active:scale-95 transition-all"
                              onClick={() => {
                                if (curatedScrollRef.current) {
                                  curatedScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
                                }
                              }}
                              aria-label="Next Curated Items"
                            >
                              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1} />
                            </button>
                          </div>
                      </div>
                      
                      <div 
                        ref={curatedScrollRef}
                        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar scroll-smooth gap-4 px-4 pb-6"
                        style={{ 
                            scrollbarWidth: "none", 
                            msOverflowStyle: "none", 
                            WebkitOverflowScrolling: "touch",
                            scrollSnapType: 'x mandatory'
                        }}
                        onMouseDown={onCuratedMouseDown}
                        onMouseLeave={stopCuratedDrag}
                        onMouseUp={stopCuratedDrag}
                        onMouseMove={onCuratedMouseMove}
                      >
                        {shuffledRecommended.map((p, idx) => {
                          const initialPrice = p.variants?.[0]?.price || "0.00";
                          return (
                            <div 
                              key={`stark-pair-${p.id}-${idx}`}
                              className="min-w-[85vw] w-[85vw] sm:min-w-[320px] sm:w-[320px] flex-shrink-0 snap-center flex flex-col group cursor-pointer"
                              onClick={(e) => { 
                                if (isCuratedDragging) e.preventDefault(); 
                                else router.push(`/products/${p.handle}`);
                              }}
                            >
                              {/* Large Image Container */}
                              <div className="relative w-full aspect-[3/5] rounded-[20px] overflow-hidden bg-foreground/[0.03] mb-3">
                                <Image 
                                  src={p.image?.src || p.images?.[0]?.src || "/zb-logo-220px.png"} 
                                  alt={p.title} 
                                  fill 
                                  className="object-cover" 
                                  sizes="350px" 
                                  quality={95} 
                                  onError={handleImageError}
                                />
                              </div>
                              
                              {/* Bottom Details - Minimal React Native style */}
                              <div className="flex items-center justify-between mt-1 px-1">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-rocaston tracking-[0.15em] uppercase text-foreground/80 line-clamp-1">
                                    {p.title}
                                  </span>
                                  <span className="text-[10px] font-light text-foreground/45">
                                    ₹{parseFloat(initialPrice).toLocaleString('en-IN')}
                                  </span>
                                </div>
                                <button
                                  className="w-7 h-7 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground active:scale-90 transition-all border border-foreground/10 hover:border-foreground/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickAddProduct(p);
                                  }}
                                  aria-label="Quick Add to Bag"
                                >
                                  <Plus className="w-3.5 h-3.5" strokeWidth={1} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                  </div>
                )}

                {/* Recently Viewed */}
                {recentlyViewed.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-foreground/[0.05] -mx-0.5">
                    <div className="flex items-center justify-between mb-[1px] px-1">
                      <h2 className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/60 dark:text-foreground/40 font-heading">Recently Viewed</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-x-[6px] gap-y-[1px]">
                      {recentlyViewed.filter(p => p.id !== product.id).slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {showSizeChart && sizeChartImageUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60" onClick={() => setShowSizeChart(false)}>
          <div className="relative w-full max-w-sm glass border border-foreground/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/60 dark:text-foreground/40">Sizing Reference</span>
              <button onClick={() => setShowSizeChart(false)} className="px-4 py-1.5 rounded-full bg-foreground/5 text-[7px] uppercase tracking-widest font-bold">Dismiss</button>
            </div>
            <div className="aspect-square w-full overflow-auto rounded-2xl bg-foreground/[0.03] border border-foreground/5 hide-scrollbar overscroll-none">
              <div className="min-w-full min-h-full flex items-center justify-center">
                <img 
                  src={sizeChartImageUrl} 
                  alt="Size Guide" 
                  className="max-w-none w-auto h-auto" 
                  style={{ minWidth: '100%', minHeight: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN GALLERY MODAL */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] bg-background flex flex-col"
          >
            {/* Gallery Header */}
            <div className="flex justify-between items-center p-6 pt-10">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-tighter text-foreground mb-0.5">{product.title}</span>
                <span className="text-[8px] font-medium text-foreground/50 dark:text-foreground/30 uppercase tracking-widest">{activeImg + 1} of {allImages.length}</span>
              </div>
              <button 
                onClick={() => {
                  setIsGalleryOpen(false);
                }}
                className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center active:scale-90 transition-all"
              >
                <X className="w-4.5 h-4.5 text-foreground/80 dark:text-foreground/60" />
              </button>
            </div>

            {/* Gallery Main Carousel */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <div
                ref={galleryScrollRef}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
                style={{ scrollSnapType: 'x mandatory' }}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const index = Math.round(target.scrollLeft / target.clientWidth);
                  if (activeImg !== index) {
                    setActiveImg(index);
                    // Sync bg scroll via ref
                    bgScrollRef.current?.scrollTo({ left: index * window.innerWidth, behavior: 'auto' });
                  }
                }}
              >
                {allImages.map((img, i) => (
                  <div key={`gallery-${img.src}`} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-2">
                    <TransformWrapper
                      initialScale={1}
                      minScale={1}
                      maxScale={4}
                      doubleClick={{ step: 1.5 }}
                      wheel={{ wheelDisabled: false }}
                    >
                      <TransformComponent wrapperClass="!w-full !h-full flex items-center justify-center" contentClass="!w-full !h-full flex items-center justify-center">
                        <div className="relative w-full h-[80dvh] cursor-zoom-in">
                          <Image 
                            src={img.src || "/zb-logo-220px.png"} 
                            alt={product.title} 
                            fill 
                            className="object-contain" 
                            sizes="100vw"
                            priority={i === activeImg}
                            onError={handleImageError}
                          />
                        </div>
                      </TransformComponent>
                    </TransformWrapper>
                  </div>
                ))}
              </div>
            </div>

            {/* Gallery Nav Thumbnails */}
            <div className="p-8 pb-12 flex justify-center gap-2">
              {allImages.map((_, i) => (
                <button
                  key={`gal-thumb-${i}`}
                  onClick={() => {
                    galleryScrollRef.current?.scrollTo({ left: i * window.innerWidth, behavior: 'smooth' });
                  }}
                  className={`w-1 h-1 rounded-full transition-all duration-500 ${activeImg === i ? "w-4 bg-foreground" : "bg-foreground/20"}`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Checkout WebView (Buy Now) */}
      {checkoutUrl && (
        <CheckoutWebView
          checkoutUrl={checkoutUrl}
          onSuccess={() => { setCheckoutUrl(null); setShowSuccess(true); }}
          onClose={() => setCheckoutUrl(null)}
        />
      )}

      {/* Order Success Screen */}
      <AnimatePresence>
        {showSuccess && (
          <OrderSuccess
            onContinue={() => {
              setShowSuccess(false);
              setCheckoutUrl(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick-Add Modal for Curated Pairs */}
      {quickAddProduct && (
        <QuickAddModal product={quickAddProduct} onClose={() => setQuickAddProduct(null)} />
      )}
    </>
  );
}
