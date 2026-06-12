import ProductCardSkeleton from "@/components/skeletons/ProductCardSkeleton"

export default function CollectionLoading() {
  return (
    <div className="min-h-screen pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        {/* Header skeleton */}
        <div className="animate-pulse mb-6">
          <div className="h-6 bg-foreground/[0.06] rounded w-1/3 mb-2" />
          <div className="h-3 bg-foreground/[0.04] rounded w-1/4" />
        </div>
        {/* Filter bar skeleton */}
        <div className="flex gap-2 mb-8 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-foreground/[0.04]" />
          ))}
        </div>
      </div>
      {/* Product grid skeleton */}
      <div className="w-full px-[2px] md:px-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[4px]">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
