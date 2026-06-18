"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useProductCardCarousel } from "@/hooks/useProductCardCarousel";
import { handleImageError } from "./ImagePlaceholder";

// 1×1 transparent gray pixel — universal blur placeholder fallback
const BLUR_FALLBACK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3KFb5QAAAABJRU5ErkJggg==";

interface ProductCardImageProps {
  images: { id: number; src: string }[];
  title: string;
  priority?: boolean;
  isSoldOut: boolean;
  productSlug: string | number;
}

/** Generate a Shopify CDN blur URL (20px wide, lowest quality) */
function blurUrl(src: string): string {
  if (!src || src.startsWith("/") || src.startsWith("data:")) return BLUR_FALLBACK;
  try {
    const u = new URL(src);
    u.searchParams.set("width", "20");
    u.searchParams.set("quality", "10");
    return u.toString();
  } catch {
    return BLUR_FALLBACK;
  }
}

export default function ProductCardImage({
  images,
  title,
  priority = false,
  isSoldOut,
  productSlug,
}: ProductCardImageProps) {
  const imageSrcs = useMemo(
    () => images.filter((i) => i.src).map((i) => i.src),
    [images]
  );
  const count = imageSrcs.length;
  const fallback = "/zb-logo-220px.png";
  const firstSrc = imageSrcs[0] || fallback;
  const secondSrc = count >= 2 ? imageSrcs[1] : null;
  const hasMultiple = count > 1;

  // ── Hover / scroll-reveal state (independent of carousel) ──
  const [hoverActive, setHoverActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouchActive = useRef(false);
  const touchTimeout = useRef<any>(null);

  // Reset hover when swipe starts — passed as callback to carousel hook
  const onSwipeStart = useCallback(() => {
    setHoverActive(false);
  }, []);

  // ── Carousel hook ──
  const {
    currentIndex,
    isSwiping,
    trackStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTransitionEnd,
  } = useProductCardCarousel(count, onSwipeStart);

  // Helper to dynamically check if the client device is a mobile/touch interface
  const checkIsMobile = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: none)").matches;
  }, []);

  // ── Desktop hover handlers ──
  const handleMouseEnter = useCallback(() => {
    if (!hasMultiple || checkIsMobile() || isTouchActive.current) return;
    setHoverActive(true);
  }, [hasMultiple, checkIsMobile]);

  const handleMouseLeave = useCallback(() => {
    if (checkIsMobile() || isTouchActive.current) return;
    setHoverActive(false);
    onMouseLeave(); // also ends any active drag
  }, [checkIsMobile, onMouseLeave]);

  // ── Touch handlers attached via useEffect (non-passive touchmove support) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasMultiple) return;

    const handleTouchStart = (e: TouchEvent) => {
      isTouchActive.current = true;
      // Delay touch-reveal to avoid vertical scroll/swipe conflict or brief tap flickering
      touchTimeout.current = setTimeout(() => {
        setHoverActive(true);
      }, 120);
      onTouchStart(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchTimeout.current) {
        clearTimeout(touchTimeout.current);
        touchTimeout.current = null;
      }
      onTouchMove(e);
    };

    const handleTouchEnd = () => {
      if (touchTimeout.current) {
        clearTimeout(touchTimeout.current);
        touchTimeout.current = null;
      }
      setHoverActive(false);
      onTouchEnd();
    };

    const handleTouchCancel = () => {
      if (touchTimeout.current) {
        clearTimeout(touchTimeout.current);
        touchTimeout.current = null;
      }
      setHoverActive(false);
      onTouchEnd();
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      if (touchTimeout.current) {
        clearTimeout(touchTimeout.current);
      }
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [hasMultiple, onTouchStart, onTouchMove, onTouchEnd]);

  // ── Progressive loading: lazy preload pipeline ──
  const loadedSet = useRef(new Set<number>());
  const [preloadUpTo, setPreloadUpTo] = useState(0);

  const onFirstLoad = useCallback(() => {
    loadedSet.current.add(0);
    if (count >= 2) setPreloadUpTo(1);
  }, [count]);

  // When carousel index changes, preload one ahead
  useEffect(() => {
    if (currentIndex + 1 < count) {
      setPreloadUpTo((prev) => Math.max(prev, currentIndex + 1));
    }
  }, [currentIndex, count]);

  // ── Blur placeholder state per image ──
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handleImageLoad = useCallback((idx: number) => {
    loadedSet.current.add(idx);
    setLoadedImages((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    if (idx + 1 < count) {
      setPreloadUpTo((p) => Math.max(p, idx + 1));
    }
  }, [count]);

  const isFallback = firstSrc === fallback;
  const sizesAttr = "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw";

  // Should we show the second-image crossfade? Only when hovering, not mid-swipe, and at first image
  const showSecondImage = hoverActive && hasMultiple && !isSwiping && currentIndex === 0;

  // Intercept click to prevent navigation during swipes/drags
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isSwiping) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isSwiping]
  );

  return (
    <Link
      href={`/products/${productSlug}`}
      className="block"
      onClick={handleClick}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        className="relative w-full rounded-none overflow-hidden mb-1.5 transition-all duration-500 bg-foreground/[0.02] select-none"
        style={{ aspectRatio: "3 / 5.2", contain: "layout style paint" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={hasMultiple ? onMouseDown : undefined}
        onMouseMove={hasMultiple ? onMouseMove : undefined}
        onMouseUp={hasMultiple ? onMouseUp : undefined}
      >
        {hasMultiple ? (
          <>
            {/* ─── Carousel track (base layer) ─── */}
            <div
              className="absolute inset-0 z-[1] flex"
              style={{
                ...trackStyle,
                opacity: showSecondImage ? 0 : 1,
                transition: showSecondImage
                  ? "opacity 300ms ease"
                  : trackStyle.transition
                    ? `${trackStyle.transition}, opacity 300ms ease`
                    : "opacity 300ms ease",
              }}
              onTransitionEnd={onTransitionEnd}
            >
              {imageSrcs.map((src, idx) => {
                const shouldRender = idx <= preloadUpTo || idx === currentIndex;
                return (
                  <div
                    key={idx}
                    className="relative flex-shrink-0 w-full h-full"
                    style={{ minWidth: "100%" }}
                  >
                    {/* Blur placeholder layer */}
                    {shouldRender && !loadedImages.has(idx) && (
                      <img
                        src={blurUrl(src)}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                          filter: "blur(8px)",
                          transform: "scale(1.05)",
                          transition: "filter 400ms ease, transform 400ms ease",
                        }}
                      />
                    )}
                    {shouldRender ? (
                      <Image
                        src={src}
                        alt={`${title} - image ${idx + 1}`}
                        fill
                        loading={idx === 0 && priority ? undefined : "lazy"}
                        priority={idx === 0 && priority}
                        quality={60}
                        sizes={sizesAttr}
                        draggable={false}
                        onError={handleImageError}
                        onLoad={
                          idx === 0 ? onFirstLoad : () => handleImageLoad(idx)
                        }
                        className="object-cover select-none"
                        style={{
                          ...(isSoldOut ? { filter: "grayscale(0.4)" } : {}),
                          ...(isFallback
                            ? { objectFit: "contain", padding: "25%", opacity: 0.3 }
                            : {}),
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* ─── Second-image hover/scroll-reveal layer ─── */}
            {secondSrc && (
              <div
                className="absolute inset-0 z-[2]"
                style={{
                  opacity: showSecondImage ? 1 : 0,
                  transition: "opacity 300ms ease",
                  pointerEvents: "none",
                }}
              >
                {/* Blur placeholder for second image */}
                {!loadedImages.has(1) && (
                  <img
                    src={blurUrl(secondSrc)}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: "blur(8px)", transform: "scale(1.05)" }}
                  />
                )}
                <Image
                  src={secondSrc}
                  alt={`${title} - alternate view`}
                  fill
                  loading="lazy"
                  quality={60}
                  sizes={sizesAttr}
                  onError={handleImageError}
                  onLoad={() => handleImageLoad(1)}
                  className="object-cover"
                  style={isSoldOut ? { filter: "grayscale(0.4)" } : {}}
                />
              </div>
            )}
          </>
        ) : (
          /* ─── Single-image path (no carousel, no hover) ─── */
          <div className="absolute inset-0 z-[1]">
            {/* Blur placeholder */}
            {!loadedImages.has(0) && firstSrc !== fallback && (
              <img
                src={blurUrl(firstSrc)}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  filter: "blur(8px)",
                  transform: "scale(1.05)",
                  transition: "filter 400ms ease, transform 400ms ease",
                }}
              />
            )}
            <Image
              src={firstSrc}
              alt={title}
              fill
              priority={priority}
              quality={60}
              sizes={sizesAttr}
              onError={handleImageError}
              onLoad={onFirstLoad}
              className={`object-cover transition-all duration-[800ms] ease-out ${!isSoldOut ? "group-hover:scale-[1.03]" : ""}`}
              style={
                isSoldOut
                  ? { filter: "grayscale(0.4)" }
                  : isFallback
                    ? { objectFit: "contain", padding: "25%", opacity: 0.3 }
                    : {}
              }
            />
          </div>
        )}

        {/* ─── Hover subtle overlay (preserved from original) ─── */}
        {!isSoldOut && (
          <div
            className="absolute inset-0 z-[3] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.1) 100%)",
            }}
          />
        )}

        {/* ─── Dot indicator ─── */}
        {hasMultiple && (
          <div className="absolute bottom-1.5 left-0 right-0 z-[4] flex justify-center gap-[3px] pointer-events-none">
            {imageSrcs.map((_, idx) => (
              <span
                key={idx}
                className="block rounded-full transition-opacity duration-200"
                style={{
                  width: 3,
                  height: 3,
                  backgroundColor: "white",
                  opacity: idx === currentIndex ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
