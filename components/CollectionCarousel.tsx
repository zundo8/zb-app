"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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

// Apple-level spring physics — snappy, no bounce
const SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 38,
  mass: 0.7,
  restDelta: 0.001,
};

export default function CollectionCarousel({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = collections.length;
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => (i + dir + total) % total);
    },
    [total]
  );

  // Pointer swipe with velocity detection
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
    if (Math.abs(e.clientX - dragStartX.current) > 6) hasMoved.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dx = e.clientX - dragStartX.current;
    const dt = Date.now() - dragStartTime.current;
    const velocity = Math.abs(dx) / Math.max(dt, 1);
    const threshold = velocity > 0.4 ? 18 : 50;

    if (Math.abs(dx) > threshold) {
      go(dx < 0 ? 1 : -1);
    } else if (!hasMoved.current) {
      router.push(`/collections/${collections[index].handle}`);
    }
  };

  if (!total) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full select-none touch-pan-y cursor-grab active:cursor-grabbing"
      style={{ touchAction: "pan-y" }}
    >
      {/* Stack container */}
      <div className="relative w-full flex items-center justify-center" style={{ height: "min(72vh, 560px)" }}>
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {collections.map((col, i) => {
            let diff = i - index;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            // Only render nearby cards
            if (Math.abs(diff) > 3) return null;

            return (
              <StackedCard
                key={col.id}
                collection={col}
                diff={diff}
                fallback={FALLBACKS[i % FALLBACKS.length]}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StackedCard({
  collection,
  diff,
  fallback,
}: {
  collection: Collection;
  diff: number;
  isActive?: boolean;
  fallback: string;
}) {
  const absDiff = Math.abs(diff);
  const isActive = absDiff < 0.1;

  // Tight stack: side cards offset by small px amount, scale down slightly
  const translateX = diff * 18;
  const scale = isActive ? 1 : Math.max(0.9, 1 - absDiff * 0.04);
  const opacity = Math.max(0, 1 - absDiff * 0.15);

  return (
    <motion.div
      initial={false}
      animate={{
        x: translateX,
        scale,
        opacity,
      }}
      transition={SPRING}
      className="absolute select-none pointer-events-none will-change-transform"
      style={{
        width: "min(82vw, 380px)",
        aspectRatio: "3 / 4.2",
        zIndex: 20 - Math.round(absDiff),
        backfaceVisibility: "hidden",
        borderRadius: "1.25rem",
        overflow: "hidden",
        boxShadow: isActive
          ? "0 24px 50px -10px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(255,255,255,0.1)"
          : `0 ${Math.max(4, 14 - absDiff * 4)}px ${Math.max(10, 35 - absDiff * 8)}px -6px rgba(0, 0, 0, ${Math.max(0.1, 0.3 - absDiff * 0.08)})`,
      }}
    >
      <div className="w-full h-full relative">
        <Image
          src={collection.image?.src || fallback}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 85vw, 400px"
          className="object-cover pointer-events-none"
          priority={isActive}
        />

        {/* Minimal bottom text — only on active card */}
        {isActive && (
          <div className="absolute inset-x-0 bottom-0 pb-5 pt-16 flex items-end justify-center pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)",
            }}
          >
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-[12px] font-normal text-white/90 tracking-[0.08em] drop-shadow-sm"
              style={{ fontFamily: "'HeadingPro', sans-serif" }}
            >
              {collection.title}
            </motion.span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
