'use client';

import { useEffect, useState } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isDashboard, setIsDashboard] = useState(false);

  useEffect(() => {
    console.error('Root error boundary caught:', error);
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
      setIsDashboard(true);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-heading mb-4 text-foreground/80 lowercase tracking-widest">
        an unexpected error occurred
      </h2>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-8 max-w-xs leading-relaxed">
        {error.message || "we're having trouble loading this page. please try again."}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-foreground text-background text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:opacity-90 active:scale-95 transition-all"
        >
          try again
        </button>
        <button
          onClick={() => {
            if (isDashboard) {
              window.location.href = '/dashboard';
            } else {
              window.location.href = '/';
            }
          }}
          className="px-6 py-3 border border-foreground/10 text-foreground text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:bg-foreground/5 active:scale-95 transition-all"
        >
          {isDashboard ? 'return to dashboard' : 'return home'}
        </button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 p-4 bg-muted rounded-xl text-[8px] text-left overflow-auto max-w-full">
          {error.stack}
        </pre>
      )}
    </div>
  );
}
