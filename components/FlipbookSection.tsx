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
  tag?: string;
  title?: string;
  desc?: string;
}

export default function FlipbookSection({ imgUrl, videoUrl, tag, title, desc }: FlipbookProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const displayImg   = imgUrl   || DEFAULTS.imgUrl;
  const displayTag   = tag      || DEFAULTS.tag;
  const displayTitle = title    || DEFAULTS.title;
  const displayDesc  = desc     || DEFAULTS.desc;

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

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25, restDelta: 0.001 });

  // No more scroll-fades for text to ensure absolute visibility
  const imageScale   = useTransform(smoothProgress, [0, 0.5, 1], [1.05, 1, 1.05]);
  const textY        = useTransform(smoothProgress, [0, 0.3], [15, 0]);

  const showVideo = mounted && !isMobile && videoUrl;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-background"
      style={{ padding: "60px 0 40px" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 flex flex-col items-center">

        {/* Tag */}
        <div className="text-center mb-8">
          <span className="text-[7px] font-semibold uppercase tracking-[1em] text-foreground/40">{displayTag}</span>
          <div className="w-5 h-[1px] bg-foreground/15 mx-auto mt-2.5" />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-[360px] mx-auto overflow-visible">
          <div className="relative w-full aspect-[3/4.2] rounded-[2.5rem] overflow-hidden shadow-2xl border border-foreground/[0.03]">
            
            {/* Media */}
            <motion.div className="absolute inset-0" style={{ scale: imageScale, opacity: 1 }}>
              {showVideo ? (
                <video
                  src={videoUrl}
                  autoPlay loop muted playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <NextImage
                    src={displayImg}
                    alt={displayTitle}
                    fill
                    className="object-cover transition-opacity duration-700"
                    sizes="400px"
                    onError={handleImageError}
                  />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </motion.div>

            {/* Text Content */}
            <motion.div
              className="absolute inset-x-6 bottom-8 z-20 text-center"
              style={{ opacity: 1, y: textY }}
            >
              <h3 className="font-heading text-[12px] font-bold text-white uppercase tracking-[0.2em] leading-tight mb-2.5 drop-shadow-md">
                {displayTitle}
              </h3>
              <div className="w-5 h-[1.5px] bg-white/20 mx-auto mb-3" />
              <p className="text-white/45 text-[7px] font-light leading-relaxed uppercase tracking-[0.35em] max-w-[200px] mx-auto drop-shadow-sm">
                {displayDesc}
              </p>
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
