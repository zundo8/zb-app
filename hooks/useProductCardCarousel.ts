"use client";

import { useRef, useState, useCallback } from "react";

interface CarouselReturn {
  currentIndex: number;
  isSwiping: boolean;
  trackStyle: React.CSSProperties;
  onTouchStart: (e: any) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTransitionEnd: () => void;
}

export function useProductCardCarousel(
  imageCount: number,
  onSwipeStart?: () => void
): CarouselReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const dragging = useRef(false);
  const swiping = useRef(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);

  const disabled = imageCount <= 1;

  const begin = useCallback((x: number, y: number) => {
    if (disabled) return;
    startX.current = x; startY.current = y;
    deltaX.current = 0; dragging.current = true;
    swiping.current = false; setAnimate(false);
  }, [disabled]);

  const move = useCallback((x: number, y: number) => {
    if (!dragging.current || disabled) return;
    const dx = x - startX.current;
    const dy = y - startY.current;
    if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      swiping.current = true; setIsSwiping(true);
      onSwipeStart?.();
    }
    if (swiping.current) { deltaX.current = dx; setOffset(dx); }
  }, [disabled, onSwipeStart]);

  const end = useCallback(() => {
    if (!dragging.current || disabled) return;
    dragging.current = false; setAnimate(true);
    if (Math.abs(deltaX.current) > 30) {
      setCurrentIndex(prev => {
        const dir = deltaX.current < 0 ? 1 : -1;
        return ((prev + dir) % imageCount + imageCount) % imageCount;
      });
    }
    setOffset(0); deltaX.current = 0;
    setTimeout(() => { swiping.current = false; setIsSwiping(false); }, 50);
  }, [disabled, imageCount]);

  // touchstart: passive — just record coordinates, no preventDefault
  const onTouchStart = useCallback((e: any) => {
    const t = e.touches?.[0];
    if (t) begin(t.clientX, t.clientY);
  }, [begin]);

  // touchmove: preventDefault ONLY when horizontal swipe confirmed
  const onTouchMove = useCallback((e: any) => {
    const t = e.touches?.[0];
    if (t) {
      move(t.clientX, t.clientY);
      if (swiping.current && e.cancelable) e.preventDefault();
    }
  }, [move]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    begin(e.clientX, e.clientY);
  }, [begin]);
  const onMouseMove = useCallback((e: React.MouseEvent) => move(e.clientX, e.clientY), [move]);

  const onTransitionEnd = useCallback(() => {
    // will-change cleanup handled via trackStyle
  }, []);

  const trackStyle: React.CSSProperties = {
    transform: `translateX(calc(-${currentIndex * 100}% + ${offset}px))`,
    transition: animate ? "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
    willChange: !animate || offset !== 0 ? "transform" : "auto",
  };

  return {
    currentIndex, isSwiping, trackStyle,
    onTouchStart, onTouchMove, onTouchEnd: end,
    onMouseDown, onMouseMove, onMouseUp: end, onMouseLeave: end,
    onTransitionEnd,
  };
}
