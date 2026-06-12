export default function ProductCardSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="relative w-full rounded-none overflow-hidden bg-foreground/[0.04]" style={{ aspectRatio: "3 / 5.2" }} />
      <div className="flex justify-between items-center px-1.5 py-2">
        <div className="flex-1 min-w-0 pr-2 flex flex-col gap-1">
          <div className="h-2 bg-foreground/[0.06] rounded w-3/4" />
          <div className="h-2 bg-foreground/[0.04] rounded w-1/2" />
        </div>
        <div className="w-5 h-5 rounded-md bg-foreground/[0.04]" />
      </div>
    </div>
  )
}
