"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Collection {
  id: string | number;
  title: string;
  handle: string;
  image?: { src: string } | null;
}

const FALLBACKS = [
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800&auto=format&fit=crop",
];

export default function CollectionCarousel({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = collections.length;
  const [isMobile, setIsMobile] = useState(false);

  // Drag / Swipe States
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setStartX(e.clientX);
    setIsDragging(true);
    setOffsetX(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diffX = currentX - startX;
    setOffsetX(diffX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 55; // swipe threshold in px
    if (offsetX < -threshold) {
      setIndex((i) => (i + 1) % total);
    } else if (offsetX > threshold) {
      setIndex((i) => (i - 1 + total) % total);
    } else {
      // It is a click/tap
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (clickX < width * 0.3) {
        setIndex((i) => (i - 1 + total) % total);
      } else if (clickX > width * 0.7) {
        setIndex((i) => (i + 1) % total);
      } else {
        router.push(`/collections/${collections[index].handle}`);
      }
    }
    setOffsetX(0);
  };

  if (!total) return null;

  const spacing = isMobile ? 65 : 130;

  return (
    <div 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full py-10 group overflow-visible select-none touch-pan-y"
      style={{ touchAction: "pan-y" }}
    >
      <div className="relative h-[320px] md:h-[450px] w-full flex items-center justify-center overflow-visible">
        {/* Left/Right Arrow Buttons (Desktop only) */}
        {total > 1 && (
          <>
            <div className="hidden md:flex absolute left-4 lg:left-12 z-35">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i - 1 + total) % total);
                }}
                className="w-12 h-12 rounded-full border border-foreground/[0.06] bg-background/60 hover:bg-background dark:bg-zinc-900/60 dark:hover:bg-zinc-900 backdrop-blur-md flex items-center justify-center text-foreground/45 hover:text-foreground transition-all duration-300 active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                aria-label="Previous Collection"
              >
                <ChevronLeft className="w-5 h-5 text-foreground/60 hover:text-foreground" />
              </button>
            </div>
            <div className="hidden md:flex absolute right-4 lg:right-12 z-35">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i + 1) % total);
                }}
                className="w-12 h-12 rounded-full border border-foreground/[0.06] bg-background/60 hover:bg-background dark:bg-zinc-900/60 dark:hover:bg-zinc-900 backdrop-blur-md flex items-center justify-center text-foreground/45 hover:text-foreground transition-all duration-300 active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                aria-label="Next Collection"
              >
                <ChevronRight className="w-5 h-5 text-foreground/60 hover:text-foreground" />
              </button>
            </div>
          </>
        )}

        {/* Stacked Cards Area */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {collections.map((col, i) => {
            let diff = i - index;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            return (
              <CollectionCard
                key={col.id}
                collection={col}
                diff={diff}
                isActive={Math.abs(diff) < 0.1}
                fallback={FALLBACKS[i % FALLBACKS.length]}
                isMobile={isMobile}
                spacing={spacing}
                offsetX={offsetX}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CollectionCard({
  collection,
  diff,
  isActive,
  fallback,
  isMobile,
  spacing,
  offsetX
}: {
  collection: Collection;
  diff: number;
  isActive: boolean;
  fallback: string;
  isMobile: boolean;
  spacing: number;
  offsetX: number;
}) {
  const maxDiff = isMobile ? 1 : 2;
  const isVisible = Math.abs(diff) <= maxDiff;
  const opacityVal = Math.abs(diff) > maxDiff ? 0 : 1 - Math.abs(diff) * 0.35;

  if (!isVisible) return null;

  return (
    <motion.div
      initial={false}
      animate={{
        x: diff * spacing + offsetX,
        scale: isActive ? 1 : 0.88,
        rotateY: 0,
        z: 0,
        opacity: opacityVal,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 32,
        mass: 1
      }}
      className="absolute w-[65vw] max-w-[280px] md:w-[320px] md:max-w-none aspect-[3/4] rounded-[2rem] overflow-hidden origin-center select-none transition-shadow duration-500 pointer-events-none"
      style={{
        zIndex: 10 - Math.round(Math.abs(diff)),
        backfaceVisibility: "hidden",
        userSelect: "none",
        boxShadow: isActive 
          ? "0 30px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)" 
          : "0 15px 30px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)",
      }}
    >
      <div className="block w-full h-full relative">
        <Image
          src={collection.image?.src || fallback}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 80vw, 360px"
          className="object-cover pointer-events-none"
          priority={isActive}
        />
        
        {/* Dynamic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 pointer-events-none" />
        
        {/* Title Overlay: bold heading font */}
        <div className="absolute inset-x-0 bottom-0 p-8 text-center pointer-events-none">
          <motion.p 
            animate={{ 
              y: isActive ? 0 : 8,
              opacity: isActive ? 1 : 0
            }}
            className="font-heading text-sm md:text-base font-bold text-white tracking-widest drop-shadow-md text-center uppercase"
            style={{ fontFamily: "'HeadingPro', sans-serif" }}
          >
            {collection.title}
          </motion.p>
        </div>

        {/* Glass Edge Highlight */}
        <div className={`absolute inset-0 border rounded-[2rem] pointer-events-none transition-colors duration-500 ${isActive ? "border-white/15" : "border-white/5"}`} />
      </div>
    </motion.div>
  );
}
