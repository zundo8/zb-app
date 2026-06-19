import React from 'react';

export default function SupportLoading() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans relative overflow-hidden support-page-root">
      {/* Lightweight background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 support-bg-layer">
        <div className="support-blob support-blob-1" />
        <div className="support-blob support-blob-2" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-20 md:pt-32 pb-24">
        {/* Title Skeleton */}
        <div className="text-center mb-6 md:mb-12 flex flex-col items-center gap-3">
          <div className="h-6 w-20 bg-foreground/[0.04] rounded-full animate-pulse" />
          <div className="h-10 md:h-14 w-64 md:w-96 bg-foreground/[0.06] rounded-xl animate-pulse" />
          <div className="h-3 w-40 bg-foreground/[0.04] rounded-md animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Interaction Card Skeleton */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="support-glass-card p-4 md:p-6 flex flex-col" style={{ minHeight: 'min(520px, calc(100dvh - 220px))' }}>
              {/* Tab Skeleton */}
              <div className="flex gap-1 md:gap-2 border-b border-foreground/5 pb-3 md:pb-4">
                <div className="flex-1 h-9 md:h-10 bg-foreground/[0.06] rounded-lg md:rounded-xl animate-pulse" />
                <div className="flex-1 h-9 md:h-10 bg-foreground/[0.04] rounded-lg md:rounded-xl animate-pulse" />
              </div>

              {/* Form Skeleton */}
              <div className="flex-1 space-y-4 md:space-y-6 pt-4 md:pt-6 max-w-xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <div className="h-2 w-12 bg-foreground/[0.04] rounded animate-pulse" />
                    <div className="h-10 md:h-11 bg-foreground/[0.05] rounded-xl animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-20 bg-foreground/[0.04] rounded animate-pulse" />
                    <div className="h-10 md:h-11 bg-foreground/[0.05] rounded-xl animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-14 bg-foreground/[0.04] rounded animate-pulse" />
                  <div className="h-10 md:h-11 bg-foreground/[0.05] rounded-xl animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-28 bg-foreground/[0.04] rounded animate-pulse" />
                  <div className="h-24 md:h-28 bg-foreground/[0.05] rounded-2xl animate-pulse" />
                </div>
                <div className="h-11 md:h-12 bg-foreground/[0.08] rounded-xl md:rounded-2xl animate-pulse" />
              </div>
            </div>
          </div>

          {/* Sidebar Skeletons */}
          <div className="lg:col-span-1 order-2 lg:order-1 space-y-3 md:space-y-4">
            {/* Contact */}
            <div className="support-glass-card p-5 md:p-8 space-y-5 md:space-y-6 animate-pulse">
              <div className="h-4 w-28 bg-foreground/[0.08] rounded" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 md:gap-4">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-foreground/[0.06] shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-2 w-20 bg-foreground/[0.04] rounded" />
                    <div className="h-4 w-36 bg-foreground/[0.06] rounded" />
                  </div>
                </div>
              ))}
            </div>
            {/* Quick Actions */}
            <div className="support-glass-card p-5 md:p-8 space-y-3 animate-pulse">
              <div className="h-4 w-28 bg-foreground/[0.08] rounded" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-foreground/[0.03] border border-foreground/[0.03] rounded-2xl" />
              ))}
            </div>
            {/* Knowledge Base */}
            <div className="support-glass-card p-5 md:p-6 animate-pulse">
              <div className="p-4 bg-foreground/[0.02] border border-foreground/5 rounded-2xl space-y-2">
                <div className="h-3 w-28 bg-foreground/[0.06] rounded" />
                <div className="h-2 w-full bg-foreground/[0.04] rounded" />
                <div className="h-2 w-2/3 bg-foreground/[0.04] rounded" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
