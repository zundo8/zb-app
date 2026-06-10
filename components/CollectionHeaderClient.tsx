"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface CollectionHeaderClientProps {
  currentHandle: string;
  currentTitle: string;
  allCollections: any[];
  currentImage?: string;
}

// Same Apple spring physics as homepage carousel
const SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 40,
  mass: 0.8,
  restDelta: 0.001,
};

export default function CollectionHeaderClient({ 
  currentHandle, 
  currentTitle, 
  allCollections,
  currentImage
}: CollectionHeaderClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);

  // Find current index
  const currentIndex = allCollections.findIndex(c => c.handle === currentHandle);
  const [index, setIndex] = useState(Math.max(0, currentIndex));
  const total = allCollections.length;

  // Sync index when handle changes
  useEffect(() => {
    const idx = allCollections.findIndex(c => c.handle === currentHandle);
    if (idx >= 0) setIndex(idx);
  }, [currentHandle, allCollections]);

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => {
        const next = (i + dir + total) % total;
        return next;
      });
    },
    [total]
  );

  // Pointer-based swipe with velocity
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

    const threshold = velocity > 0.5 ? 20 : 55;

    if (Math.abs(dx) > threshold) {
      go(dx < 0 ? 1 : -1);
    }
  };

  if (!total) return null;

  const spacing = 52;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full select-none touch-pan-y"
      style={{ touchAction: "pan-y" }}
    >
      <div className="relative h-[140px] w-full flex items-center justify-center overflow-hidden">
        {/* Cards Stack */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {allCollections.map((col: any, i: number) => {
            let diff = i - index;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            if (Math.abs(diff) > 2) return null;

            const absDiff = Math.abs(diff);
            const isActive = absDiff < 0.1;
            const scale = isActive ? 1 : Math.max(0.82, 1 - absDiff * 0.12);
            const opacity = Math.max(0, 1 - absDiff * 0.45);

            return (
              <motion.div
                key={col.handle}
                initial={false}
                animate={{
                  x: diff * spacing,
                  scale,
                  opacity,
                }}
                transition={SPRING}
                className="absolute w-[78vw] max-w-[320px] aspect-[21/9] rounded-[1.25rem] overflow-hidden origin-center select-none pointer-events-none will-change-transform"
                style={{
                  zIndex: 10 - Math.round(absDiff),
                  backfaceVisibility: "hidden",
                  boxShadow: isActive
                    ? "0 16px 40px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12)"
                    : `0 8px 20px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)`,
                }}
              >
                <Link
                  href={`/collections/${col.handle}`}
                  className="block w-full h-full relative pointer-events-auto"
                  prefetch={false}
                >
                  {col.image?.src ? (
                    <Image
                      src={col.image.src}
                      alt={col.title}
                      fill
                      className={`object-cover transition-transform duration-[2000ms] ease-out ${isActive ? "scale-105" : "scale-100"}`}
                      sizes="(max-width: 768px) 80vw, 360px"
                      priority={isActive}
                    />
                  ) : (
                    <div className="w-full h-full bg-foreground/[0.05] flex items-center justify-center">
                      <span className="text-[6px] font-black uppercase tracking-widest opacity-10">
                        {col.title}
                      </span>
                    </div>
                  )}

                  {/* Dark overlay */}
                  <div className={`absolute inset-0 transition-all duration-700 ${isActive ? "bg-black/30" : "bg-black/50"}`} />

                  {/* Title overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                      animate={{
                        scale: isActive ? 1 : 0.92,
                        opacity: isActive ? 1 : 0.6,
                      }}
                      transition={SPRING}
                      className="text-[10px] sm:text-[12px] font-bold uppercase tracking-[0.3em] text-white/95 text-center px-4 leading-relaxed drop-shadow-lg"
                      style={{ fontFamily: "'HeadingPro', sans-serif" }}
                    >
                      {col.title}
                    </motion.span>
                  </div>

                  {/* Glass selection shine */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 pointer-events-none" />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex justify-center gap-1 mt-3">
          {allCollections.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-500 ease-out ${
                i === index
                  ? "w-5 h-1 bg-foreground/50"
                  : "w-1 h-1 bg-foreground/10 hover:bg-foreground/20"
              }`}
              aria-label={`Go to collection ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
