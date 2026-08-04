"use client";

import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { handleImageError } from "./ImagePlaceholder";

interface FlipbookProps {
  imgUrl?: string;
  videoUrl?: string;
  imgUrlMobile?: string;
  videoUrlMobile?: string;
  tag?: string;
  title?: string;
  desc?: string;
  link?: string;
}

export default function FlipbookSection({ imgUrl, videoUrl, imgUrlMobile, videoUrlMobile, tag, title, desc, link }: FlipbookProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoDesktopRef = useRef<HTMLVideoElement>(null);
  const videoMobileRef = useRef<HTMLVideoElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  // Play/pause videos based on visibility
  useEffect(() => {
    [videoDesktopRef.current, videoMobileRef.current].forEach(video => {
      if (!video) return;
      if (isVisible) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [isVisible]);

  // Stable scroll-progress that ignores in-app browser toolbar-triggered
  // viewport resizes (50-150px height-only changes).
  const scrollYProgress = useMotionValue(0);
  const cachedLayout = useRef<{ top: number; height: number; winW: number; winH: number } | null>(null);

  const measureLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    cachedLayout.current = {
      top: rect.top + scrollTop,
      height: rect.height,
      winW: window.innerWidth,
      winH: window.innerHeight,
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    measureLayout();

    const onScroll = () => {
      const layout = cachedLayout.current;
      if (!layout) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const winH = window.innerHeight;
      // offset: ["start end", "end start"] means:
      //   progress 0 = element top reaches viewport bottom
      //   progress 1 = element bottom reaches viewport top
      const start = layout.top - winH; // element top at viewport bottom
      const end = layout.top + layout.height; // element bottom at viewport top
      const range = end - start;
      if (range <= 0) return;
      const progress = Math.min(1, Math.max(0, (scrollTop - start) / range));
      scrollYProgress.set(progress);
    };

    const onResize = () => {
      const prev = cachedLayout.current;
      if (!prev) {
        measureLayout();
        return;
      }
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      const dW = Math.abs(newW - prev.winW);
      const dH = Math.abs(newH - prev.winH);
      // Ignore height-only changes in the 40-160px range (toolbar toggle)
      if (dW < 2 && dH >= 40 && dH <= 160) return;
      measureLayout();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Fire once to set initial progress
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted, measureLayout, scrollYProgress]);

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25, restDelta: 0.001 });
  const imageScale = useTransform(smoothProgress, [0, 0.5, 1], [1.05, 1, 1.05]);

  const desktopVideo = videoUrl;
  const desktopImg = imgUrl;
  const mobileVideo = videoUrlMobile || videoUrl;
  const mobileImg = imgUrlMobile || imgUrl;

  if (!desktopImg && !desktopVideo && !mobileImg && !mobileVideo) return null;

  const hasText = tag || title || desc;
  const hasLink = link && link.trim() !== '';
  const linkHref = hasLink ? `/collections/${link}` : undefined;

  // Build semantic attributes for SEO
  const sectionAriaLabel = title ? `${title} - ${tag || 'Featured Collection'}` : 'Featured Collection';

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-transparent">
      <section aria-label={sectionAriaLabel} itemScope itemType="https://schema.org/CollectionPage">
        {/* Hidden SEO metadata */}
        {hasLink && <meta itemProp="url" content={`/collections/${link}`} />}
        {title && <meta itemProp="name" content={title} />}
        {desc && <meta itemProp="description" content={desc} />}

        {/* ── Desktop View ── */}
        <div className="hidden md:block">
          {hasLink ? (
            <Link
              href={linkHref!}
              className="relative block w-full overflow-hidden shadow-2xl border-y border-foreground/[0.03] dark:border-white/[0.04] cursor-pointer group aspect-[21/9]"
              aria-label={`View ${title || 'featured'} collection`}
            >
              {/* Desktop media */}
              <motion.div className="absolute inset-0" style={{ scale: imageScale, opacity: 1 }}>
                {mounted && desktopVideo ? (
                  <video
                    ref={videoDesktopRef}
                    src={desktopVideo}
                    loop muted playsInline
                    preload="none"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <NextImage
                      src={desktopImg || ""}
                      alt={title || "Feature Section"}
                      fill
                      className="object-cover transition-opacity duration-700"
                      sizes="100vw"
                      onError={handleImageError}
                    />
                  </div>
                )}
              </motion.div>

              {/* Gradient + Text */}
              {hasText && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 z-20 flex items-end p-12 lg:p-16">
                    <div className="max-w-xl space-y-3">
                      {tag && <span className="inline-block text-[9px] font-bold text-white/50 uppercase tracking-[0.3em]">{tag}</span>}
                      {title && <h3 className="font-heading text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-[0.06em] text-white leading-none">{title}</h3>}
                      {desc && <p className="text-[11px] md:text-[12px] text-white/60 font-normal leading-relaxed tracking-wider max-w-md">{desc}</p>}
                    </div>
                  </div>
                </>
              )}
            </Link>
          ) : (
            <div className="relative block w-full overflow-hidden shadow-2xl border-y border-foreground/[0.03] dark:border-white/[0.04] group aspect-[21/9]">
              <motion.div className="absolute inset-0" style={{ scale: imageScale, opacity: 1 }}>
                {mounted && desktopVideo ? (
                  <video ref={videoDesktopRef} src={desktopVideo} loop muted playsInline preload="none" className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full">
                    <NextImage src={desktopImg || ""} alt={title || "Feature Section"} fill className="object-cover" sizes="100vw" onError={handleImageError} />
                  </div>
                )}
              </motion.div>
              {hasText && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 z-20 flex items-end p-12 lg:p-16">
                    <div className="max-w-xl space-y-3">
                      {tag && <span className="inline-block text-[9px] font-bold text-white/50 uppercase tracking-[0.3em]">{tag}</span>}
                      {title && <h3 className="font-heading text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-[0.06em] text-white leading-none">{title}</h3>}
                      {desc && <p className="text-[11px] md:text-[12px] text-white/60 font-normal leading-relaxed tracking-wider max-w-md">{desc}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Mobile View ── */}
        <div className="md:hidden">
          {hasLink ? (
            <Link
              href={linkHref!}
              className="relative block w-full overflow-hidden shadow-2xl border-y border-foreground/[0.03] dark:border-white/[0.04] cursor-pointer group aspect-[3/4.2]"
              aria-label={`View ${title || 'featured'} collection`}
            >
              <div className="absolute inset-0">
                {mounted && mobileVideo ? (
                  <video
                    ref={videoMobileRef}
                    src={mobileVideo}
                    loop muted playsInline
                    preload="none"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <NextImage
                      src={mobileImg || ""}
                      alt={title || "Feature Section"}
                      fill
                      className="object-cover"
                      sizes="100vw"
                      onError={handleImageError}
                    />
                  </div>
                )}
              </div>

              {hasText && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 z-20 flex items-end p-6">
                    <div className="max-w-md space-y-2">
                      {tag && <span className="inline-block text-[8px] font-bold text-white/50 uppercase tracking-[0.3em]">{tag}</span>}
                      {title && <h3 className="font-heading text-lg font-black uppercase tracking-[0.06em] text-white leading-none">{title}</h3>}
                      {desc && <p className="text-[10px] text-white/55 font-normal leading-relaxed tracking-wider">{desc}</p>}
                    </div>
                  </div>
                </>
              )}
            </Link>
          ) : (
            <div className="relative block w-full overflow-hidden shadow-2xl border-y border-foreground/[0.03] dark:border-white/[0.04] group aspect-[3/4.2]">
              <div className="absolute inset-0">
                {mounted && mobileVideo ? (
                  <video ref={videoMobileRef} src={mobileVideo} loop muted playsInline preload="none" className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full">
                    <NextImage src={mobileImg || ""} alt={title || "Feature Section"} fill className="object-cover" sizes="100vw" onError={handleImageError} />
                  </div>
                )}
              </div>
              {hasText && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 z-20 flex items-end p-6">
                    <div className="max-w-md space-y-2">
                      {tag && <span className="inline-block text-[8px] font-bold text-white/50 uppercase tracking-[0.3em]">{tag}</span>}
                      {title && <h3 className="font-heading text-lg font-black uppercase tracking-[0.06em] text-white leading-none">{title}</h3>}
                      {desc && <p className="text-[10px] text-white/55 font-normal leading-relaxed tracking-wider">{desc}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
