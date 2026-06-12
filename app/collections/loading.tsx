export default function CollectionsLoading() {
  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        {/* Header Section Skeleton */}
        <div className="mb-px animate-pulse">
          <div className="space-y-4">
            <div className="h-8 bg-foreground/[0.06] rounded-md w-48" />
            <div className="h-[1px] w-16 bg-foreground/10 rounded-full" />
            <div className="h-3 bg-foreground/[0.04] rounded w-24" />
          </div>
        </div>

        {/* Collections Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 mt-12">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="relative block aspect-[16/10] rounded-[2rem] overflow-hidden bg-foreground/[0.03] border border-white/5 animate-pulse"
            >
              {/* Inner card content skeleton */}
              <div className="absolute inset-x-0 bottom-0 p-8 z-10">
                <div
                  className="rounded-[1.5rem] p-5 h-16 bg-foreground/[0.04] border border-foreground/5"
                  style={{
                    backdropFilter: "blur(12px) saturate(180%)",
                  }}
                >
                  <div className="h-4 bg-foreground/[0.06] rounded-md w-1/2 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
