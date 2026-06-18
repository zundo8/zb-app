import React from 'react';

export default function SupportLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 font-sans relative overflow-hidden">
      {/* Background Animated Gradient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[140px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-20 md:pt-32 pb-24">
        {/* Title Identity Skeleton */}
        <div className="text-center mb-6 md:mb-12 flex flex-col items-center gap-3">
          <div className="h-10 md:h-14 w-64 md:w-96 bg-foreground/[0.06] rounded-xl animate-pulse" />
          <div className="h-3 w-40 bg-foreground/[0.04] rounded-md animate-pulse tracking-[0.25em]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interaction Card Area Skeleton (First on mobile via flex-reordering, but visual-first placeholder) */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="h-full min-h-[460px] md:min-h-[560px] rounded-2xl md:rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] dark:bg-white/[0.01] backdrop-blur-3xl shadow-2xl p-6 flex flex-col justify-between animate-pulse">
              {/* Tab Navigation Skeleton */}
              <div className="flex gap-2 border-b border-foreground/5 pb-4">
                <div className="flex-1 h-10 bg-foreground/[0.06] rounded-xl" />
                <div className="flex-1 h-10 bg-foreground/[0.04] rounded-xl" />
              </div>

              {/* Form Content Skeletons */}
              <div className="flex-1 space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-2 w-16 bg-foreground/[0.04] rounded" />
                    <div className="h-11 bg-foreground/[0.05] rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-24 bg-foreground/[0.04] rounded" />
                    <div className="h-11 bg-foreground/[0.05] rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-16 bg-foreground/[0.04] rounded" />
                  <div className="h-11 bg-foreground/[0.05] rounded-xl" />
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-32 bg-foreground/[0.04] rounded" />
                  <div className="h-28 bg-foreground/[0.05] rounded-2xl" />
                </div>
              </div>

              {/* Button Skeleton */}
              <div className="h-12 bg-foreground/[0.08] rounded-xl md:rounded-2xl mt-4" />
            </div>
          </div>

          {/* Contact Info Panel Skeleton */}
          <div className="lg:col-span-1 order-2 lg:order-1 space-y-4">
            <div className="p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-foreground/5 bg-foreground/[0.01] dark:bg-white/[0.01] backdrop-blur-3xl shadow-2xl space-y-6 animate-pulse">
              <div className="h-4 w-32 bg-foreground/[0.08] rounded" />

              <div className="space-y-6 pt-2">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-foreground/[0.06]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-2 w-20 bg-foreground/[0.04] rounded" />
                    <div className="h-4 w-36 bg-foreground/[0.06] rounded" />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-foreground/[0.06]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-2 w-20 bg-foreground/[0.04] rounded" />
                    <div className="h-4 w-24 bg-foreground/[0.06] rounded" />
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-foreground/5">
                <div className="p-4 bg-foreground/[0.02] border border-foreground/5 rounded-2xl space-y-2">
                  <div className="h-3 w-28 bg-foreground/[0.06] rounded" />
                  <div className="h-2 w-full bg-foreground/[0.04] rounded" />
                  <div className="h-2 w-2/3 bg-foreground/[0.04] rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
