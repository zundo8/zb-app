"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import NextImage from "next/image";
import { handleImageError } from "./ImagePlaceholder";

const DEFAULTS = {
  imgUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1200",
  tag: "Core Manifest",
  title: "Archival Vision",
  desc: "Engineered for those who move without compromise.",
};

interface FlipbookProps {
  imgUrl?: string;
  videoUrl?: string;
  imgUrlMobile?: string;
  videoUrlMobile?: string;
  tag?: string;
  title?: string;
  desc?: string;
}

export default function FlipbookSection({ imgUrl, videoUrl, imgUrlMobile, videoUrlMobile, tag, title, desc }: FlipbookProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const displayImg   = imgUrl   || DEFAULTS.imgUrl;
  const displayTag   = tag      || DEFAULTS.tag;
  const displayTitle = title    || DEFAULTS.title;
  const displayDesc  = desc     || DEFAULTS.desc;

  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // IntersectionObserver for lazy video loading and play/pause
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "100px 0px", threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.unobserve(el);
  }, [mounted]);

  // Play/pause video based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isVisible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVisible]);

  // Disable scroll-driven transforms on mobile — they cause jank
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25, restDelta: 0.001 });

  // Only apply scroll scale on desktop
  const imageScale = useTransform(smoothProgress, [0, 0.5, 1], isMobile ? [1, 1, 1] : [1.05, 1, 1.05]);

  const activeVideo  = isMobile ? (videoUrlMobile || videoUrl) : videoUrl;
  const activeImg    = isMobile ? (imgUrlMobile || displayImg) : displayImg;
  const showVideo    = mounted && !!activeVideo;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-transparent py-4 md:py-8"
    >
      <div className="max-w-[1400px] mx-auto px-4">

        {/* Card */}
        <div className="relative w-full max-w-[360px] md:max-w-6xl lg:max-w-[1400px] mx-auto overflow-hidden rounded-[1.5rem] shadow-2xl border border-foreground/[0.03] dark:border-white/[0.04] aspect-[3/4.2] md:aspect-[21/9]">
          
          {/* Media */}
          {isMobile ? (
            /* Mobile: no framer-motion scroll transforms */
            <div className="absolute inset-0">
              {showVideo && activeVideo && isVisible ? (
                <video
                  ref={videoRef}
                  src={activeVideo}
                  loop muted playsInline
                  preload="none"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <NextImage
                    src={activeImg}
                    alt={displayTitle}
                    fill
                    className="object-cover"
                    sizes="400px"
                    onError={handleImageError}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Desktop: keep the fancy scroll scale */
            <motion.div className="absolute inset-0" style={{ scale: imageScale, opacity: 1 }}>
              {showVideo && activeVideo ? (
                <video
                  ref={videoRef}
                  src={activeVideo}
                  loop muted playsInline
                  preload="none"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <NextImage
                    src={activeImg}
                    alt={displayTitle}
                    fill
                    className="object-cover transition-opacity duration-700"
                    sizes="1200px"
                    onError={handleImageError}
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
