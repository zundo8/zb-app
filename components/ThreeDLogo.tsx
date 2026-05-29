"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";

export default function ThreeDLogo({ src, size = 48 }: { src?: string; size?: number }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // SSR and Mobile fallback: Render standard 2D image logo
  if (!mounted || !isDesktop) {
    return (
      <div className="relative dark:invert" style={{ width: size, height: size }}>
        <NextImage src="/zb-logo-220px.png" alt="Zica Bella Logo" fill className="object-contain" />
      </div>
    );
  }

  // Desktop view: Load interactive 3D model-viewer
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      {/* @ts-expect-error model-viewer web component */}
      <model-viewer
        src={src || "https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb"}
        alt="Zica Bella 3D Logo"
        auto-rotate
        camera-controls
        interaction-prompt="none"
        shadow-intensity="0.5"
        loading="lazy"
        style={{ width: "100%", height: "100%", background: "transparent", touchAction: "none" }}
      />
    </div>
  );
}
