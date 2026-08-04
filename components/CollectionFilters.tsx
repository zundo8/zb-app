"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Grid3X3, Square, ChevronDown } from "lucide-react";
import { useCallback } from "react";

interface CollectionFiltersProps {
  allSizes: string[];
}

export default function CollectionFilters({ allSizes }: CollectionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sort") || "featured";
  const selectedSize = searchParams.get("size") || "";
  const viewMode = searchParams.get("view") || "current";

  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const cycleView = () => {
    const nextView = viewMode === "current" ? "thumbnail" : viewMode === "thumbnail" ? "full" : "current";
    updateFilters({ view: nextView });
  };

  return (
    <div className="mb-8 w-full flex justify-center px-2">
      <div 
        className="flex items-center gap-1.5 p-1 rounded-full border border-foreground/[0.05]" 
        style={{ background: "hsla(var(--glass-bg), 0.7)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 4px 20px -5px rgba(0,0,0,0.1)" }}
      >
        {/* Sort Filter Wrapper */}
        <div className="relative w-[70px] h-6 flex items-center group">
          <select 
            value={sortBy}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            aria-label="Sort by"
            className="absolute top-1/2 left-1 -translate-y-1/2 w-[120px] bg-transparent pl-3 pr-6 py-2.5 text-[10px] font-light uppercase tracking-[0.2em] text-foreground/50 appearance-none outline-none cursor-pointer hover:bg-foreground/[0.03] hover:text-foreground/80 rounded-full origin-left scale-[0.55] transition-all"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity" />
        </div>

        <div className="w-[1px] h-3 bg-foreground/[0.05]"></div>

        {/* Size Filter Wrapper */}
        <div className="relative w-[50px] h-6 flex items-center group">
          <select 
            value={selectedSize}
            onChange={(e) => updateFilters({ size: e.target.value })}
            aria-label="Filter by size"
            className="absolute top-1/2 left-1 -translate-y-1/2 w-[85px] bg-transparent pl-3 pr-6 py-2.5 text-[10px] font-light uppercase tracking-[0.2em] text-foreground/50 appearance-none outline-none cursor-pointer hover:bg-foreground/[0.03] hover:text-foreground/80 rounded-full origin-left scale-[0.55] transition-all"
          >
            <option value="">Size</option>
            {allSizes.sort().map(s => (
               <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity" />
        </div>

        <div className="w-[1px] h-3 bg-foreground/[0.05]"></div>

        {/* View Toggle */}
        <div className="pr-1 pl-0.5">
          <button
            onClick={cycleView}
            aria-label="Toggle view mode"
            className="w-6 h-6 flex items-center justify-center text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.03] rounded-full transition-all active:scale-95"
          >
            {viewMode === "current" ? <LayoutGrid className="w-3 h-3" strokeWidth={1} /> : 
             viewMode === "thumbnail" ? <Grid3X3 className="w-3 h-3" strokeWidth={1} /> : 
             <Square className="w-3 h-3" strokeWidth={1} />}
          </button>
        </div>

      </div>
    </div>
  );
}
