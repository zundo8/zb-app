export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 pt-20 md:pt-28 pb-32 animate-pulse">
        <div className="mb-6">
          <div className="h-2 bg-foreground/[0.04] rounded w-1/4 mb-2" />
          <div className="h-6 bg-foreground/[0.06] rounded w-1/3" />
        </div>
        <div className="flex justify-center gap-1.5 mb-8">
          <div className="h-1 w-12 rounded-full bg-foreground/[0.06]" />
          <div className="h-1 w-3 rounded-full bg-foreground/[0.04]" />
        </div>
        {/* Form skeleton */}
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-foreground/[0.04]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded-xl bg-foreground/[0.04]" />
            <div className="h-12 rounded-xl bg-foreground/[0.04]" />
          </div>
          <div className="h-12 rounded-xl bg-foreground/[0.04]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded-xl bg-foreground/[0.04]" />
            <div className="h-12 rounded-xl bg-foreground/[0.04]" />
          </div>
          <div className="h-12 rounded-xl bg-foreground/[0.04]" />
          <div className="h-14 rounded-2xl bg-foreground/[0.06] mt-6" />
        </div>
      </div>
    </div>
  )
}
