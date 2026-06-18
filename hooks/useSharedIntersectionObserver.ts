"use client";

import { useEffect, useRef, type RefObject } from "react";

type IntersectCallback = (isIntersecting: boolean) => void;

// Singleton observer: one instance shared across all product cards
let sharedObserver: IntersectionObserver | null = null;
const callbackMap = new Map<Element, IntersectCallback>();

function getObserver(): IntersectionObserver {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const cb = callbackMap.get(entry.target);
        if (cb) cb(entry.isIntersecting);
      });
    },
    { threshold: 0.6 }
  );
  return sharedObserver;
}

function observeElement(el: Element, cb: IntersectCallback) {
  callbackMap.set(el, cb);
  getObserver().observe(el);
}

function unobserveElement(el: Element) {
  callbackMap.delete(el);
  if (sharedObserver) {
    sharedObserver.unobserve(el);
    // Disconnect entirely if no more entries being tracked
    if (callbackMap.size === 0) {
      sharedObserver.disconnect();
      sharedObserver = null;
    }
  }
}

export function useSharedIntersectionObserver(
  ref: RefObject<HTMLElement | null>,
  onIntersect: IntersectCallback
) {
  // Store callback in a ref so the observer doesn't re-attach on every render
  const cbRef = useRef(onIntersect);
  cbRef.current = onIntersect;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const stableCb: IntersectCallback = (isIntersecting) => cbRef.current(isIntersecting);
    observeElement(el, stableCb);

    return () => { unobserveElement(el); };
  }, [ref]);
}
