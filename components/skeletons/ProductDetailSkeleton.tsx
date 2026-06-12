export default function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen pt-20 md:pt-28 animate-pulse">
      {/* Mobile: Image placeholder */}
      <div className="md:hidden w-full aspect-[4/5] bg-foreground/[0.04]" />

      {/* Desktop: Grid layout */}
      <div className="hidden md:grid grid-cols-12 gap-10 items-start px-6 max-w-7xl mx-auto">
        {/* Left: Image */}
        <div className="col-span-6 flex flex-col items-center gap-4">
          <div className="aspect-[4/5] w-full max-w-[450px] rounded-3xl bg-foreground/[0.04]" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-14 h-14 rounded-xl bg-foreground/[0.04]" />
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="col-span-6 space-y-4 rounded-3xl p-6 border border-foreground/5">
          <div className="h-4 bg-foreground/[0.06] rounded w-2/3" />
          <div className="h-3 bg-foreground/[0.04] rounded w-1/3" />
          <div className="grid grid-cols-6 gap-1.5 mt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-foreground/[0.04]" />
            ))}
          </div>
          <div className="h-12 rounded-lg bg-foreground/[0.04] mt-4" />
          <div className="h-12 rounded-lg bg-foreground/[0.06] mt-2" />
        </div>
      </div>

      {/* Mobile: Info placeholder */}
      <div className="md:hidden px-4 pt-6 space-y-3">
        <div className="h-4 bg-foreground/[0.06] rounded w-3/4" />
        <div className="h-3 bg-foreground/[0.04] rounded w-1/3" />
        <div className="grid grid-cols-6 gap-1.5 mt-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-foreground/[0.04]" />
          ))}
        </div>
        <div className="h-12 rounded-xl bg-foreground/[0.04] mt-4" />
        <div className="h-12 rounded-xl bg-foreground/[0.06] mt-2" />
      </div>
    </div>
  )
}
