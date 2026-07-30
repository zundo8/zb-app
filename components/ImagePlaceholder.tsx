"use client";

/**
 * ImagePlaceholder — Shows a subtle image placeholder
 * whenever product images are loading or unavailable.
 */
export default function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center w-full h-full bg-foreground/[0.03] overflow-hidden ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/section-image1.webp"
        alt="Zica Bella"
        draggable={false}
        className="w-full h-full object-cover opacity-80 select-none"
      />
    </div>
  );
}

/**
 * handleImageError — Replaces a broken image with a clean local streetwear fallback image.
 * Use as: onError={handleImageError} on any <img> or Next <Image>.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.currentTarget;
  // Prevent infinite loop if fallback image itself fails
  if (target.src.includes("section-image1.webp") || target.src.includes("load-image-1.jpg")) return;
  target.srcset = ""; // Clear Next.js srcset so it doesn't override src
  target.src = "/section-image1.webp";
  target.style.objectFit = "cover";
  target.style.padding = "0px";
  target.style.opacity = "1";
  target.style.filter = "none";
}

