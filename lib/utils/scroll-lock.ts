"use client";

let lockCount = 0;
let savedScrollY = 0;

/**
 * Locks background body scrolling in a WebView & WebKit safe manner.
 * Sets position: fixed on document.body while capturing current scrollY,
 * preventing iOS WebKit in-app browsers from scrolling the page behind drawers/modals.
 */
export function lockScroll(): void {
  if (typeof window === "undefined") return;

  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }
  lockCount++;
}

/**
 * Restores body position and scroll offset cleanly when drawers/modals close.
 */
export function unlockScroll(): void {
  if (typeof window === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    const targetY = savedScrollY;

    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";

    window.scrollTo({
      top: targetY,
      behavior: "instant" as ScrollBehavior,
    });
  }
}
