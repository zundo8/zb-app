'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Checkout page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-heading mb-4 text-foreground/80 lowercase tracking-widest">
        checkout error
      </h2>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-8 max-w-xs leading-relaxed">
        {error.message || "Something went wrong during checkout. Your cart items are safe."}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-foreground text-background text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:opacity-90 transition-all"
        >
          try again
        </button>
        <Link
          href="/cart"
          className="px-6 py-3 border border-foreground/10 text-foreground text-[8px] font-bold uppercase tracking-[0.3em] rounded-full hover:bg-foreground/5 transition-all"
        >
          return to cart
        </Link>
      </div>
    </div>
  )
}
