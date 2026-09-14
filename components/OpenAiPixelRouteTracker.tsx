'use client';

/**
 * OpenAI (ChatGPT) Ads — Route Tracker
 * Parallels components/SnapPixelRouteTracker.tsx
 *
 * Fires `page_viewed` on every route change (browser pixel + CAPI).
 * Excludes admin/dashboard routes.
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  OPENAI_ADS_PIXEL_ID,
  trackOpenAiClientEvent,
} from '@/lib/openaiPixel';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function OpenAiPixelRouteTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Exclude admin dashboard and admin routes from tracking
    if (!pathname || pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/web-store')) {
      return;
    }

    if (pathname === lastTrackedPath.current) {
      return;
    }
    lastTrackedPath.current = pathname;

    if (!OPENAI_ADS_PIXEL_ID) {
      return;
    }

    // Generate shared eventId for PageView
    const eventId = 'pv_oai_' + uuidv4();

    // Client-side pixel page_viewed
    trackOpenAiClientEvent('page_viewed', { type: 'contents' }, eventId);

    // Server-side CAPI page_viewed
    fetch('/api/openai-ads/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'page_viewed',
        eventId,
        eventTime: Date.now(),
        eventSourceUrl: window.location.href,
        userAgent: navigator.userAgent,
        data: { type: 'contents' },
      }),
    }).catch(() => {}); // silent fire-and-forget

  }, [pathname]);

  return null;
}

export default OpenAiPixelRouteTracker;
