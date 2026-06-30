import { NextResponse } from 'next/server';
import {
  graphUrl,
  parseMetaError,
  validateTokenFormat,
  validatePixelIdFormat,
} from '@/lib/metaErrors';

export const dynamic = 'force-dynamic';

export async function GET() {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

  // Validate configuration before making any requests
  const pixelError = validatePixelIdFormat(PIXEL_ID);
  if (pixelError) {
    return NextResponse.json(
      { error: { summary: 'Configuration Error', detail: pixelError, code: 'CONFIG_MISSING_PIXEL_ID' } },
      { status: 400 }
    );
  }

  const tokenError = validateTokenFormat(ACCESS_TOKEN);
  if (tokenError) {
    return NextResponse.json(
      { error: { summary: 'Configuration Error', detail: tokenError, code: 'CONFIG_MISSING_TOKEN' } },
      { status: 400 }
    );
  }

  try {
    // Make parallel requests to the correct Graph API v25.0 endpoints
    const [pixelRes, statsRes, lastFiredRes] = await Promise.allSettled([
      // 1. Basic pixel/dataset info
      fetch(
        graphUrl(`/${PIXEL_ID}?fields=name,creation_time,id&access_token=${ACCESS_TOKEN}`),
        { cache: 'no-store' }
      ),
      // 2. Stats via the stats edge (not a field)
      fetch(
        graphUrl(`/${PIXEL_ID}/stats?access_token=${ACCESS_TOKEN}`),
        { cache: 'no-store' }
      ),
      // 3. Last fired time via the dedicated edge
      fetch(
        graphUrl(`/${PIXEL_ID}/event_last_fired_time?access_token=${ACCESS_TOKEN}`),
        { cache: 'no-store' }
      ),
    ]);

    // Parse all responses
    const pixelData = pixelRes.status === 'fulfilled' ? await pixelRes.value.json().catch(() => null) : null;
    const statsData = statsRes.status === 'fulfilled' ? await statsRes.value.json().catch(() => null) : null;
    const lastFiredData = lastFiredRes.status === 'fulfilled' ? await lastFiredRes.value.json().catch(() => null) : null;

    // Check primary pixel request for errors
    if (pixelRes.status === 'fulfilled' && !pixelRes.value.ok) {
      const diagnostic = parseMetaError(pixelData, `GET /${PIXEL_ID}?fields=name,creation_time,id`);
      console.error('[Meta Event Stats API Error]', JSON.stringify(diagnostic, null, 2));
      return NextResponse.json(
        { error: diagnostic },
        { status: pixelRes.value.status }
      );
    }

    if (pixelRes.status === 'rejected') {
      console.error('[Meta Event Stats Network Error]', pixelRes.reason);
      return NextResponse.json(
        { error: { summary: 'Network Error', detail: 'Failed to connect to Meta Graph API. Check your server network connectivity.', code: 'NETWORK_ERROR' } },
        { status: 502 }
      );
    }

    // Check for error in pixel data (API returned 200 but with error body)
    if (pixelData?.error) {
      const diagnostic = parseMetaError(pixelData, `GET /${PIXEL_ID}?fields=name,creation_time,id`);
      console.error('[Meta Event Stats API Error]', JSON.stringify(diagnostic, null, 2));
      return NextResponse.json(
        { error: diagnostic },
        { status: 400 }
      );
    }

    // Build the response with whatever data succeeded
    const response: Record<string, any> = {
      // Primary pixel info
      id: pixelData?.id || PIXEL_ID,
      name: pixelData?.name || null,
      creation_time: pixelData?.creation_time || null,

      // Last fired time (from dedicated edge)
      last_fired_time: null,

      // Stats (from dedicated edge)
      stats: { data: [] },

      // Sync metadata
      _sync: {
        timestamp: new Date().toISOString(),
        api_version: 'v25.0',
        pixel_ok: !!pixelData?.id,
        stats_ok: false,
        last_fired_ok: false,
      },
    };

    // Process last_fired_time edge response
    if (lastFiredRes.status === 'fulfilled' && lastFiredRes.value.ok && lastFiredData && !lastFiredData.error) {
      // The edge may return {data: [{event_fired_time: ...}]} or {event_fired_time: ...}
      if (lastFiredData.data && Array.isArray(lastFiredData.data) && lastFiredData.data.length > 0) {
        response.last_fired_time = lastFiredData.data[0].event_fired_time || lastFiredData.data[0].time || null;
      } else if (lastFiredData.event_fired_time) {
        response.last_fired_time = lastFiredData.event_fired_time;
      }
      response._sync.last_fired_ok = true;
    } else if (lastFiredData?.error) {
      console.warn('[Meta Last Fired Time Warning]', lastFiredData.error.message);
    }

    // Process stats edge response
    if (statsRes.status === 'fulfilled' && statsRes.value.ok && statsData && !statsData.error) {
      response.stats = statsData;
      response._sync.stats_ok = true;
    } else if (statsData?.error) {
      console.warn('[Meta Stats Warning]', statsData.error.message);
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Meta Event Stats Catch Error]', err);
    return NextResponse.json(
      { error: { summary: 'Internal Server Error', detail: err.message || 'Failed to fetch event stats', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
