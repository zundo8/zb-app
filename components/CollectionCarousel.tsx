"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, PanInfo } from "framer-motion";
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
  const [index, setIndex] = useState(0);
  const total = collections.length;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Handle Drag / Swipe Snapping
  const onDragEnd = (event: any, info: PanInfo) => {
    const threshold = 35;
    if (info.offset.x < -threshold) {
      setIndex((i) => (i + 1) % total);
    } else if (info.offset.x > threshold) {
      setIndex((i) => (i - 1 + total) % total);
    }
  };

  if (!total) return null;

  return (
    <div className="relative w-full py-10 group overflow-visible">
      <div className="relative h-[85vw] max-h-[460px] w-full flex items-center justify-center overflow-visible">
        {/* Left/Right Arrow Buttons (Desktop only) */}
        {total > 1 && (
          <>
            <div className="hidden md:flex absolute left-4 lg:left-12 z-30">
              <button
                onClick={() => setIndex((i) => (i - 1 + total) % total)}
                className="w-12 h-12 rounded-full border border-foreground/[0.06] bg-background/60 hover:bg-background dark:bg-zinc-900/60 dark:hover:bg-zinc-900 backdrop-blur-md flex items-center justify-center text-foreground/45 hover:text-foreground transition-all duration-300 active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                aria-label="Previous Collection"
              >
                <ChevronLeft className="w-5 h-5 text-foreground/60 hover:text-foreground" />
              </button>
            </div>
            <div className="hidden md:flex absolute right-4 lg:right-12 z-30">
              <button
                onClick={() => setIndex((i) => (i + 1) % total)}
                className="w-12 h-12 rounded-full border border-foreground/[0.06] bg-background/60 hover:bg-background dark:bg-zinc-900/60 dark:hover:bg-zinc-900 backdrop-blur-md flex items-center justify-center text-foreground/45 hover:text-foreground transition-all duration-300 active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                aria-label="Next Collection"
              >
                <ChevronRight className="w-5 h-5 text-foreground/60 hover:text-foreground" />
              </button>
            </div>
          </>
        )}

        {/* The Drag Container */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.95}
          onDragEnd={onDragEnd}
          className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
          style={{ 
            perspective: "1200px", 
            transformStyle: "preserve-3d",
            touchAction: "pan-y" 
          }}
        >
          {collections.map((col, i) => {
            // Virtual indices for circular behavior
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
                onSelect={() => setIndex(i)}
              />
            );
          })}
        </motion.div>
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
  onSelect
}: {
  collection: Collection;
  diff: number;
  isActive: boolean;
  fallback: string;
  isMobile: boolean;
  onSelect: () => void;
}) {
  // Calculate visibility responsively (5 cards on desktop, 3 on mobile)
  const maxDiff = isMobile ? 1 : 2;
  const isVisible = Math.abs(diff) <= maxDiff;
  const spacing = isMobile ? 200 : 340;
  const opacityVal = Math.abs(diff) > maxDiff ? 0 : 1 - Math.abs(diff) * (isMobile ? 0.5 : 0.35);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={false}
      animate={{
        x: diff * spacing, // Spaced wider on desktop
        scale: isActive ? 1 : 0.82,
        rotateY: diff * (isMobile ? 35 : 25), // 3D Tilt
        z: isActive ? 0 : -180, // Depth
        opacity: opacityVal,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 32,
        mass: 1
      }}
      className="absolute w-[65vw] max-w-[280px] md:w-[320px] md:max-w-none aspect-[3/4] rounded-[2rem] overflow-hidden shadow-xl origin-center select-none"
      style={{
        zIndex: 10 - Math.round(Math.abs(diff)),
        pointerEvents: isActive ? "auto" : "all", // Keep click active for selection
        backfaceVisibility: "hidden",
        userSelect: "none",
        WebkitUserDrag: "none",
      }}
    >
      <Link 
        href={`/collections/${collection.handle}`} 
        className="block w-full h-full relative"
        draggable={false}
        onClick={(e) => {
          if (!isActive) {
            e.preventDefault(); // Don't navigate if clicking a side card
            onSelect(); // Focus the clicked side card
          }
        }}
      >
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
        
        {/* Title Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-8 text-center pointer-events-none">
          <motion.p 
            animate={{ 
              y: isActive ? 0 : 10,
              opacity: isActive ? 1 : 0
            }}
            className="font-heading text-[12px] uppercase tracking-[0.3em] text-white"
          >
            {collection.title}
          </motion.p>
        </div>

        {/* Glass Edge Highlight */}
        <div className="absolute inset-0 border border-white/10 rounded-[2.5rem] pointer-events-none" />
      </Link>
    </motion.div>
  );
}
