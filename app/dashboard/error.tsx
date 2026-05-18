'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-transparent flex flex-col items-center justify-center p-6 text-center">
      <div className="glass border border-foreground/10 p-8 rounded-3xl max-w-md shadow-2xl">
        <h2 className="text-xl font-heading mb-4 text-foreground/80 lowercase tracking-widest">
          dashboard error occurred
        </h2>
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-8 leading-relaxed">
          {error.message || "we ran into a problem while loading this dashboard view. please try again."}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-foreground text-background text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:opacity-90 active:scale-95 transition-all"
          >
            try again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-3 border border-foreground/10 text-foreground text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:bg-foreground/5 active:scale-95 transition-all"
          >
            return to dashboard
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-8 p-4 bg-muted rounded-xl text-[8px] text-left overflow-auto max-w-full font-mono text-foreground/75">
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  );
}
