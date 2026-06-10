"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

// Apple-level spring physics
const SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 40,
  mass: 0.8,
  restDelta: 0.001,
};

export default function CollectionCarousel({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = collections.length;
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => (i + dir + total) % total);
    },
    [total]
  );

  // Touch / Pointer based swipe with velocity
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragStartX.current = e.clientX;
    dragStartTime.current = Date.now();
    isDragging.current = true;
    hasMoved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = Math.abs(e.clientX - dragStartX.current);
    if (delta > 8) hasMoved.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dx = e.clientX - dragStartX.current;
    const dt = Date.now() - dragStartTime.current;
    const velocity = Math.abs(dx) / Math.max(dt, 1);

    // Threshold: either moved enough pixels or swiped fast
    const threshold = velocity > 0.5 ? 20 : 55;

    if (Math.abs(dx) > threshold) {
      go(dx < 0 ? 1 : -1);
    } else if (!hasMoved.current) {
      // Tap — navigate to collection
      router.push(`/collections/${collections[index].handle}`);
    }
  };

  if (!total) return null;

  const spacing = isMobile ? 58 : 120;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full py-6 group select-none touch-pan-y"
      style={{ touchAction: "pan-y" }}
    >
      <div className="relative h-[300px] md:h-[420px] w-full flex items-center justify-center overflow-hidden">
        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="hidden md:flex absolute left-4 lg:left-8 z-30 w-11 h-11 rounded-full border border-foreground/[0.06] bg-background/60 dark:bg-zinc-900/60 backdrop-blur-md items-center justify-center text-foreground/40 hover:text-foreground/80 hover:border-foreground/10 transition-all duration-300 active:scale-90 shadow-lg"
              aria-label="Previous Collection"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              className="hidden md:flex absolute right-4 lg:right-8 z-30 w-11 h-11 rounded-full border border-foreground/[0.06] bg-background/60 dark:bg-zinc-900/60 backdrop-blur-md items-center justify-center text-foreground/40 hover:text-foreground/80 hover:border-foreground/10 transition-all duration-300 active:scale-90 shadow-lg"
              aria-label="Next Collection"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </>
        )}

        {/* Cards Stack */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {collections.map((col, i) => {
            let diff = i - index;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            const maxVisible = isMobile ? 1.5 : 2.5;
            if (Math.abs(diff) > maxVisible) return null;

            return (
              <StackedCard
                key={col.id}
                collection={col}
                diff={diff}
                isActive={Math.abs(diff) < 0.1}
                fallback={FALLBACKS[i % FALLBACKS.length]}
                isMobile={isMobile}
                spacing={spacing}
              />
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {collections.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-500 ease-out ${
                i === index
                  ? "w-6 h-1.5 bg-foreground/60"
                  : "w-1.5 h-1.5 bg-foreground/10 hover:bg-foreground/20"
              }`}
              aria-label={`Go to collection ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StackedCard({
  collection,
  diff,
  isActive,
  fallback,
  isMobile,
  spacing,
}: {
  collection: Collection;
  diff: number;
  isActive: boolean;
  fallback: string;
  isMobile: boolean;
  spacing: number;
}) {
  const absDiff = Math.abs(diff);
  const scale = isActive ? 1 : Math.max(0.82, 1 - absDiff * 0.1);
  const opacity = Math.max(0, 1 - absDiff * 0.4);
  const translateX = diff * spacing;
  const translateZ = isActive ? 0 : -absDiff * 80;
  const rotateY = diff * -3;

  return (
    <motion.div
      initial={false}
      animate={{
        x: translateX,
        scale,
        rotateY,
        opacity,
      }}
      transition={SPRING}
      className="absolute w-[62vw] max-w-[260px] md:w-[300px] md:max-w-none aspect-[3/4] rounded-[1.75rem] overflow-hidden origin-center select-none pointer-events-none will-change-transform"
      style={{
        zIndex: 10 - Math.round(absDiff),
        perspective: 1200,
        backfaceVisibility: "hidden",
        boxShadow: isActive
          ? "0 28px 60px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.12)"
          : `0 ${12 - absDiff * 3}px ${30 - absDiff * 5}px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)`,
      }}
    >
      <div className="block w-full h-full relative">
        <Image
          src={collection.image?.src || fallback}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 70vw, 340px"
          className="object-cover pointer-events-none"
          priority={isActive}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent pointer-events-none" />

        {/* Title */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 text-center pointer-events-none">
          <motion.p
            animate={{
              y: isActive ? 0 : 10,
              opacity: isActive ? 1 : 0,
            }}
            transition={{ ...SPRING, delay: isActive ? 0.08 : 0 }}
            className="font-heading text-[11px] md:text-sm font-bold text-white tracking-[0.25em] drop-shadow-lg text-center uppercase"
            style={{ fontFamily: "'HeadingPro', sans-serif" }}
          >
            {collection.title}
          </motion.p>
        </div>

        {/* Glass edge highlight */}
        <div
          className={`absolute inset-0 rounded-[1.75rem] pointer-events-none transition-colors duration-500 ${
            isActive ? "border border-white/15" : "border border-white/5"
          }`}
        />
      </div>
    </motion.div>
  );
}
