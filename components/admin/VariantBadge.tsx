import React from "react";

interface VariantBadgeProps {
  size?: string | null;
  variantTitle?: string | null;
  className?: string;
  showNoSize?: boolean;
}

export function VariantBadge({
  size,
  variantTitle,
  className = "",
  showNoSize = true,
}: VariantBadgeProps) {
  const cleanSize = size ? size.trim().toUpperCase() : null;
  const cleanVariant =
    variantTitle &&
    variantTitle.trim() !== "" &&
    variantTitle.trim() !== "Default Title" &&
    variantTitle.trim() !== "Default"
      ? variantTitle.trim()
      : null;

  if (cleanSize) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-extrabold uppercase tracking-wider shrink-0 shadow-sm ${className}`}
      >
        Size: {cleanSize}
      </span>
    );
  }

  if (cleanVariant) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md bg-foreground/10 text-foreground/80 border border-foreground/10 text-[9px] font-mono font-semibold truncate max-w-[130px] shrink-0 ${className}`}
      >
        {cleanVariant}
      </span>
    );
  }

  if (showNoSize) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/30 border border-foreground/5 text-[8px] font-mono font-medium shrink-0 ${className}`}
      >
        No size
      </span>
    );
  }

  return null;
}

export default VariantBadge;
