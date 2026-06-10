"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";

export default function ThreeDLogo({ src, size = 48 }: { src?: string; size?: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR fallback: Render standard 2D image logo
  if (!mounted) {
    return (
      <div className="relative dark:invert" style={{ width: size, height: size }}>
        <NextImage src="/zb-logo-220px.png" alt="Zica Bella Logo" fill className="object-contain" />
      </div>
    );
  }

  // Render interactive 3D model-viewer logo for both desktop and mobile
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
