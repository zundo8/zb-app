'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { pageview as trackMetaPageView } from '@/lib/metaPixel';
import { pageview as trackGAPageView } from '@/lib/gtag';

export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackMetaPageView();
    trackGAPageView(pathname);
  }, [pathname]);
  return null;
}

export default MetaPixelRouteTracker;
