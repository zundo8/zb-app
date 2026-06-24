'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { pageview } from '@/lib/metaPixel';

export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    pageview();
  }, [pathname]);
  return null;
}

export default MetaPixelRouteTracker;
