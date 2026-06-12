export default function BlogsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col">
      <main className="flex-1 pt-32 pb-24 px-6 sm:px-12 max-w-7xl mx-auto w-full animate-pulse">
        <div className="mb-20 space-y-4">
          <div className="h-12 bg-foreground/[0.06] rounded w-1/3" />
          <div className="h-4 bg-foreground/[0.04] rounded w-2/3 max-w-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-6">
              <div className="w-full aspect-[4/5] bg-foreground/[0.04] rounded-[2rem]" />
              <div className="space-y-3 px-2">
                <div className="h-2 bg-foreground/[0.04] rounded w-1/4" />
                <div className="h-5 bg-foreground/[0.06] rounded w-3/4" />
                <div className="h-3 bg-foreground/[0.04] rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
