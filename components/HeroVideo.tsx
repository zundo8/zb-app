"use client";

import { useState, useRef, useEffect } from "react";
import { VolumeX, Volume2 } from "lucide-react";
import NextImage from "next/image";

interface HeroVideoProps {
  src: string;
  mobileSrc?: string;
  poster?: string;
  showControlOnly?: boolean;
}

export default function HeroVideo({ src, mobileSrc, poster, showControlOnly = false }: HeroVideoProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const defaultPoster = poster || "/zb-video-hero-poster.jpg";

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);

    // Check for Save-Data / metered connections
    const conn = (navigator as any).connection;
    if (conn?.saveData) {
      setSaveData(true);
    } else if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) {
      setSaveData(true);
    }
    // Also check the prefers-reduced-data media query (CSS-level fallback)
    const reducedDataQuery = window.matchMedia("(prefers-reduced-data: reduce)");
    if (reducedDataQuery.matches) {
      setSaveData(true);
    }

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!mounted || saveData) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, [mounted, isMobile, saveData]); // Re-observe when video element changes

  useEffect(() => {
    if (videoRef.current) {
      if (isInView) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView, isMobile]);

  const toggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const activeSrc = (mounted && isMobile && mobileSrc) ? mobileSrc : src;

  // Save-Data / reduced-data: show poster image instead of video
  if (saveData && mounted) {
    return (
      <div className="absolute inset-0 w-full h-full">
        <NextImage
          src={defaultPoster}
          alt="Hero"
          fill
          priority
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div 
      className="absolute inset-0 w-full h-full cursor-pointer group/hero"
      onClick={toggle}
      suppressHydrationWarning
    >
      {!showControlOnly && (
        <video
          ref={videoRef}
          key={activeSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={defaultPoster}
          className="w-full h-full object-cover transition-all duration-700"
          suppressHydrationWarning
        >
          <source src={activeSrc.replace('.mp4', '.webm')} type="video/webm" />
          <source src={activeSrc} type="video/mp4" />
        </video>
      )}
      
      {/* Absolute minimal mute icon */}
      <button
        className="absolute bottom-6 right-6 z-50 flex items-center justify-center p-2 text-white/40 hover:text-white active:scale-90 transition-all drop-shadow-lg"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="w-3 h-3" />
        ) : (
          <Volume2 className="w-3 h-3" />
        )}
      </button>

      {/* Visual Indicator Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-active/hero:opacity-100 transition-opacity">
        <div className="p-4 rounded-full bg-black/10 backdrop-blur-sm border border-white/5">
          {isMuted ? <VolumeX className="w-4 h-4 text-white/40" /> : <Volume2 className="w-4 h-4 text-white/70" />}
        </div>
      </div>
    </div>
  );
}
