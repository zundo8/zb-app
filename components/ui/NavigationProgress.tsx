'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Global route-change progress indicator.
 * Shows a thin animated bar at the top of the viewport during navigation.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] bg-foreground/10 overflow-hidden pointer-events-none">
      <div className="h-full bg-foreground/70 animate-progress-bar" />
    </div>
  )
}
