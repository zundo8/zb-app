'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NotFound() {
  const [isDashboard, setIsDashboard] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
      setIsDashboard(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-heading mb-4 text-foreground/80 lowercase tracking-widest">
        page not found
      </h2>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-8 max-w-xs leading-relaxed">
        the page you are looking for does not exist or has been moved.
      </p>
      <Link
        href={isDashboard ? "/dashboard" : "/"}
        className="px-8 py-3.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-[0.4em] rounded-full hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-foreground/5"
      >
        {isDashboard ? "return to dashboard" : "return home"}
      </Link>
    </div>
  );
}
