"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { handleImageError } from "./ImagePlaceholder";

interface LazyVideoProps {
  src: string;
  className?: string;
  poster?: string;
  fallbackImage?: string;
}

export default function LazyVideo({ src, className, poster, fallbackImage }: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!mounted || isMobile) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 } // Start playing when 10% visible
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, [mounted, isMobile]);

  useEffect(() => {
    if (videoRef.current && !isMobile) {
      if (isInView) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView, isMobile]);

  // SSR and Mobile viewports fallback
  if (!mounted || isMobile) {
    if (fallbackImage) {
      return (
        <div className="relative w-full h-full">
          <NextImage
            src={fallbackImage}
            alt="Section Media Fallback"
            fill
            className="object-cover"
            onError={handleImageError}
          />
        </div>
      );
    }
    // Return empty placeholder if no fallback is available on mobile
    return <div className="w-full h-full bg-foreground/[0.03] backdrop-blur-sm" />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="none" // Don't preload until necessary
    />
  );
}

