export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-foreground/[0.06]" />
        <div className="h-2 w-24 bg-foreground/[0.06] rounded" />
      </div>
    </div>
  )
}
