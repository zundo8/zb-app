"use client";

import { useRef, useState, useCallback, useMemo } from "react";

interface CarouselReturn {
  currentIndex: number;
  isSwiping: boolean;
  trackStyle: React.CSSProperties;
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTransitionEnd: () => void;
  goToIndex: (index: number, shouldAnimate?: boolean) => void;
}

/**
 * Apple-quality product card carousel hook.
 *
 * Key design decisions:
 * - Uses refs for all drag state to avoid re-renders during gesture.
 *   Only commits to React state on gesture end (or via rAF for live offset).
 * - Rubber-band effect at edges for natural iOS-like overscroll feel.
 * - Velocity-based snap: if flick is fast enough, advance even with small drag distance.
 * - Single `offsetPx` state driven via rAF during drag for 60fps smoothness.
 * - Dead-zone direction lock: only locks to horizontal after 6px of primarily
 *   horizontal movement; if vertical wins, the gesture is ignored entirely.
 */
export function useProductCardCarousel(
  imageCount: number,
  onSwipeStart?: () => void
): CarouselReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetPx, setOffsetPx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [swiping, setSwiping] = useState(false);

  // --- Refs for gesture tracking (no re-renders during drag) ---
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocityX = useRef(0);
  const dragging = useRef(false);
  const directionLocked = useRef<"h" | "v" | null>(null);
  const swipeFired = useRef(false);
  const rafId = useRef<number>(0);
  const currentDelta = useRef(0);
  const indexRef = useRef(0); // Mirror of currentIndex for use in refs

  const disabled = imageCount <= 1;

  // --- Rubber-band: dampened offset at edges ---
  const rubberBand = useCallback(
    (dx: number): number => {
      const idx = indexRef.current;
      const atStart = idx === 0 && dx > 0;
      const atEnd = idx === imageCount - 1 && dx < 0;
      if (atStart || atEnd) {
        // Rubber band: asymptotic damping (feels like pulling against resistance)
        const sign = dx > 0 ? 1 : -1;
        const absDx = Math.abs(dx);
        return sign * absDx * 0.3; // 30% of overdrag
      }
      return dx;
    },
    [imageCount]
  );

  // --- rAF-driven offset update during drag ---
  const updateOffset = useCallback(() => {
    const dampened = rubberBand(currentDelta.current);
    setOffsetPx(dampened);
    rafId.current = 0;
  }, [rubberBand]);

  const scheduleUpdate = useCallback(() => {
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(updateOffset);
    }
  }, [updateOffset]);

  // --- goToIndex (programmatic, e.g. for hover) ---
  const goToIndex = useCallback(
    (index: number, shouldAnimate: boolean = true) => {
      if (disabled) return;
      const bounded = Math.max(0, Math.min(imageCount - 1, index));
      setAnimating(shouldAnimate);
      setCurrentIndex(bounded);
      indexRef.current = bounded;
      setOffsetPx(0);
      currentDelta.current = 0;
      dragging.current = false;
      directionLocked.current = null;
      swipeFired.current = false;
      setSwiping(false);
    },
    [disabled, imageCount]
  );

  // --- Gesture: begin ---
  const begin = useCallback(
    (x: number, y: number) => {
      if (disabled) return;
      startX.current = x;
      startY.current = y;
      lastX.current = x;
      lastTime.current = performance.now();
      velocityX.current = 0;
      currentDelta.current = 0;
      dragging.current = true;
      directionLocked.current = null;
      swipeFired.current = false;
      setAnimating(false);
      setOffsetPx(0);
    },
    [disabled]
  );

  // --- Gesture: move ---
  const move = useCallback(
    (x: number, y: number) => {
      if (!dragging.current || disabled) return;

      const dx = x - startX.current;
      const dy = y - startY.current;

      // Direction locking (6px dead zone)
      if (directionLocked.current === null) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 6 && absDy < 6) return; // Still in dead zone
        if (absDx >= absDy) {
          directionLocked.current = "h";
        } else {
          directionLocked.current = "v";
          dragging.current = false; // Vertical scroll — release gesture
          return;
        }
      }

      if (directionLocked.current !== "h") return;

      // Fire swipe callback once
      if (!swipeFired.current) {
        swipeFired.current = true;
        setSwiping(true);
        onSwipeStart?.();
      }

      // Track velocity (exponential moving average)
      const now = performance.now();
      const dt = now - lastTime.current;
      if (dt > 0) {
        const instantVelocity = (x - lastX.current) / dt; // px/ms
        velocityX.current = 0.7 * instantVelocity + 0.3 * velocityX.current;
      }
      lastX.current = x;
      lastTime.current = now;

      currentDelta.current = dx;
      scheduleUpdate();
    },
    [disabled, onSwipeStart, scheduleUpdate]
  );

  // --- Gesture: end ---
  const end = useCallback(() => {
    if (!dragging.current || disabled) return;
    dragging.current = false;

    // Cancel any pending rAF
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }

    const dx = currentDelta.current;
    const vel = velocityX.current; // px/ms, negative = swiping left

    // Determine if we should advance
    // Threshold: drag > 25% of likely card width (use 60px as minimum) OR velocity > 0.3 px/ms
    const shouldAdvance = Math.abs(dx) > 60 || Math.abs(vel) > 0.3;

    if (shouldAdvance && directionLocked.current === "h") {
      const direction = (dx < 0 || vel < -0.3) ? 1 : -1;
      setCurrentIndex((prev) => {
        const next = Math.max(0, Math.min(imageCount - 1, prev + direction));
        indexRef.current = next;
        return next;
      });
    }

    setAnimating(true);
    setOffsetPx(0);
    currentDelta.current = 0;
    directionLocked.current = null;

    // Delay clearing swiping flag so click handler can still block navigation
    setTimeout(() => {
      swipeFired.current = false;
      setSwiping(false);
    }, 60);
  }, [disabled, imageCount]);

  // --- Touch handlers ---
  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (t) begin(t.clientX, t.clientY);
    },
    [begin]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (!t) return;
      move(t.clientX, t.clientY);
      // Prevent page scroll only when we've locked to horizontal
      if (directionLocked.current === "h" && e.cancelable) {
        e.preventDefault();
      }
    },
    [move]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => begin(e.clientX, e.clientY),
    [begin]
  );
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => move(e.clientX, e.clientY),
    [move]
  );

  const onTransitionEnd = useCallback(() => {
    // Intentionally empty — can be used for will-change cleanup if needed
  }, []);

  // --- Track style (the core visual output) ---
  const trackStyle = useMemo<React.CSSProperties>(
    () => ({
      transform: `translate3d(calc(-${currentIndex * 100}% + ${offsetPx}px), 0, 0)`,
      transition: animating
        ? "transform 340ms cubic-bezier(0.2, 0.82, 0.2, 1)"
        : "none",
      willChange: !animating || offsetPx !== 0 ? "transform" : "auto",
    }),
    [currentIndex, offsetPx, animating]
  );

  return {
    currentIndex,
    isSwiping: swiping,
    trackStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd: end,
    onMouseDown,
    onMouseMove,
    onMouseUp: end,
    onMouseLeave: end,
    onTransitionEnd,
    goToIndex,
  };
}
