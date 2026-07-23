"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Sparkles,
  Maximize2,
  X,
  Share2,
  Check,
  Link as LinkIcon,
  Grid,
  Info,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface GalleryImageItem {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  imageUrl: string;
  altText?: string | null;
  linkUrl?: string | null;
  position: number;
}

export default function GalleryClient() {
  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<GalleryImageItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/web-store/gallery")
      .then((res) => res.json())
      .then((data) => {
        setImages(data.images || []);
      })
      .catch((err) => {
        console.error("Error fetching gallery images:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Keyboard shortcut listener for Lightbox close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopyLink = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground selection:bg-white/20 flex flex-col relative overflow-hidden">
      {/* Background Ambient Blur Effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#e6c687]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-[160px] pointer-events-none" />

      <main className="flex-1 pt-28 sm:pt-36 pb-24 px-4 sm:px-8 max-w-7xl mx-auto w-full relative z-10">
        {/* Header Section */}
        <div className="mb-16 sm:mb-20 space-y-6 text-center sm:text-left max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-semibold uppercase tracking-widest text-[#e6c687]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#e6c687]" />
            <span>Visual Narrative Archive</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-sans tracking-tight font-light text-white leading-tight"
          >
            The <span className="font-serif italic text-[#e6c687]">Gallery</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-zinc-400 text-sm sm:text-base font-light leading-relaxed max-w-xl font-sans"
          >
            An immersive lookbook of Zica Bella drops, acid-wash textures, boxy streetwear silhouettes, and campaign aesthetics. Click any image to explore associated collections or view high-resolution detail.
          </motion.p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#e6c687] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-500 text-sm tracking-wider uppercase">Loading gallery images...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
            <Grid className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white">Gallery Archive Empty</h3>
            <p className="text-zinc-400 text-sm mt-1 max-w-md mx-auto">
              No gallery images have been published yet. Please check back soon or visit our main shop collections.
            </p>
            <a
              href="/collections/all"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#e6c687] text-black font-semibold rounded-xl text-sm hover:bg-[#d4b475] transition-all"
            >
              <span>Explore Shop Collections</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          /* Responsive Masonry / Grid Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {images.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                className="group relative bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-xl transition-all duration-500 hover:border-white/25 hover:shadow-2xl hover:shadow-[#e6c687]/5"
              >
                {/* Image Container */}
                <div className="relative aspect-[4/5] w-full bg-zinc-950 overflow-hidden cursor-pointer">
                  <img
                    src={item.imageUrl}
                    alt={item.altText || item.title || "Zica Bella Gallery Image"}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                    {item.linkUrl && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-[#e6c687]/40 text-[#e6c687] text-xs font-medium">
                        <LinkIcon className="w-3 h-3" />
                        <span>Interactive Link</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImage(item);
                      }}
                      className="ml-auto pointer-events-auto p-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100"
                      title="Expand high resolution image"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bottom Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    {item.subtitle && (
                      <span className="text-xs uppercase tracking-widest text-[#e6c687] font-semibold block">
                        {item.subtitle}
                      </span>
                    )}

                    <h3
                      onClick={() => setActiveImage(item)}
                      className="text-xl font-sans font-medium text-white leading-snug hover:underline cursor-pointer"
                    >
                      {item.title || item.altText || "Zica Bella Gallery Item"}
                    </h3>

                    {item.altText && item.title && (
                      <p className="text-xs text-zinc-400 font-light line-clamp-2">
                        {item.altText}
                      </p>
                    )}

                    {/* Action Button: Link vs Expand */}
                    <div className="pt-3 flex items-center gap-3">
                      {item.linkUrl ? (
                        <a
                          href={item.linkUrl}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e6c687] hover:bg-[#d4b475] text-black font-semibold text-xs transition-all shadow-md"
                        >
                          <span>Explore Link</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setActiveImage(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md border border-white/10 transition-all"
                      >
                        <span>View Full Screen</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {activeImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-5xl bg-zinc-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveImage(null)}
                className="absolute top-4 right-4 z-20 p-3 bg-black/80 hover:bg-white/20 text-white rounded-full border border-white/20 backdrop-blur-md transition-all"
                title="Close modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Large Image View */}
              <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] sm:min-h-[450px] p-4">
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.altText || activeImage.title || "Full size view"}
                  className="max-h-[75vh] w-auto object-contain rounded-xl"
                />
              </div>

              {/* Image Details Sidebar inside Lightbox */}
              <div className="w-full lg:w-96 p-6 sm:p-8 bg-zinc-900/90 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col justify-between space-y-6 overflow-y-auto">
                <div className="space-y-4">
                  {activeImage.subtitle && (
                    <span className="text-xs uppercase tracking-widest font-semibold text-[#e6c687] block">
                      {activeImage.subtitle}
                    </span>
                  )}

                  <h2 className="text-2xl font-sans font-medium text-white">
                    {activeImage.title || "Zica Bella Gallery Visual"}
                  </h2>

                  {activeImage.altText && (
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                        Alt Description
                      </span>
                      <p className="text-sm text-zinc-300 font-light leading-relaxed">
                        {activeImage.altText}
                      </p>
                    </div>
                  )}

                  {activeImage.linkUrl && (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#e6c687]">
                        <LinkIcon className="w-4 h-4" />
                        <span>Attached Target Link</span>
                      </div>
                      <p className="text-xs text-zinc-400 break-all">{activeImage.linkUrl}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  {activeImage.linkUrl && (
                    <a
                      href={activeImage.linkUrl}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#e6c687] hover:bg-[#d4b475] text-black font-semibold rounded-2xl text-sm transition-all shadow-lg shadow-[#e6c687]/10"
                    >
                      <span>Explore Attached Link</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeImage.linkUrl || activeImage.imageUrl)}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl text-sm transition-all border border-white/10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Share / Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
