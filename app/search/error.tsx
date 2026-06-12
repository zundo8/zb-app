'use client'

import { useEffect } from 'react'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Search page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-heading mb-4 text-foreground/80 lowercase tracking-widest">
        search unavailable
      </h2>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-8 max-w-xs leading-relaxed">
        {error.message || "we're having trouble with search right now. please try again."}
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-3 bg-foreground text-background text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:opacity-90 transition-all"
      >
        try again
      </button>
    </div>
  )
}
