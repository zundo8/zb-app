import ProductCardSkeleton from "@/components/skeletons/ProductCardSkeleton"

export default function SearchLoading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-28">
        {/* Search bar skeleton */}
        <div className="mb-10 max-w-xl mx-auto animate-pulse">
          <div className="h-14 rounded-2xl bg-foreground/[0.04] border border-foreground/5" />
        </div>
        {/* Results grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 md:gap-x-6 gap-y-8 md:gap-y-12 max-w-6xl mx-auto">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
