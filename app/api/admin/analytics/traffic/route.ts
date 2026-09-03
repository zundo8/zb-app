/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

// Valid platform values for allow-list validation (FIX 7)
const VALID_PLATFORMS = ['web', 'app'] as const;

// 15-second in-memory response cache to prevent duplicate heavy queries
const trafficCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15_000;

async function handler(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const rawPlatform = searchParams.get('platform');
  const bypassCache = searchParams.get('bypassCache') === 'true';

  // Validate platform against allow-list (FIX 7)
  const platform = rawPlatform && (VALID_PLATFORMS as readonly string[]).includes(rawPlatform) ? rawPlatform : null;

  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const rawEnd = to ? new Date(to) : now;
  const endDate = rawEnd > now ? now : rawEnd;

  const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}_${platform || 'all'}`;
  if (!bypassCache) {
    const cached = trafficCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  // Parameterized platform condition (FIX 7 — kill SQL injection)
  const platformCondition = platform ? `AND platform = $3` : '';
  const queryArgs: any[] = platform ? [startDate, endDate, platform] : [startDate, endDate];

  // Fetch sources and metrics using a single query
  // Filter event_name in session_events so only conversion events are grouped
  const sources: any[] = await prisma.$queryRawUnsafe(`
    WITH session_sources AS (
      SELECT
        id AS session_id,
        anonymous_id,
        COALESCE(
          CASE 
            WHEN utm_source ILIKE '%snapchat%' THEN 'Snapchat'
            WHEN utm_source ILIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN utm_source ILIKE '%google%' THEN 'Google'
            WHEN utm_source ILIKE '%facebook%' OR utm_source ILIKE '%fb%' THEN 'Facebook'
            WHEN utm_source ILIKE '%instagram%' OR utm_source ILIKE '%ig%' THEN 'Instagram'
            WHEN utm_source ILIKE '%twitter%' OR utm_source ILIKE '%x%' THEN 'Twitter/X'
            ELSE NULLIF(utm_source, '')
          END,
          CASE
            WHEN referrer ILIKE '%google%' THEN 'Google'
            WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%fb%' THEN 'Facebook'
            WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
            WHEN referrer ILIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN referrer ILIKE '%twitter%' OR referrer ILIKE '%x.com%' THEN 'Twitter/X'
            WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
            ELSE 'Direct'
          END
        ) AS source,
        COALESCE(utm_medium, '') AS medium,
        COALESCE(utm_campaign, '') AS campaign
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
        ${platformCondition}
    ),
    session_events AS (
      SELECT
        session_id,
        COUNT(CASE WHEN event_name = 'add_to_cart' THEN 1 END) AS add_to_cart_count,
        COUNT(CASE WHEN event_name = 'begin_checkout' THEN 1 END) AS begin_checkout_count,
        COUNT(CASE WHEN event_name = 'purchase' THEN 1 END) AS purchase_count,
        SUM(CASE WHEN event_name = 'purchase' THEN COALESCE(value, 0) ELSE 0 END) AS purchase_revenue
      FROM analytics_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name IN ('add_to_cart', 'begin_checkout', 'purchase')
        AND session_id IS NOT NULL
      GROUP BY session_id
    )
    SELECT
      s.source,
      s.medium,
      s.campaign,
      COUNT(DISTINCT s.session_id) AS sessions,
      COUNT(DISTINCT s.anonymous_id) AS visitors,
      COALESCE(SUM(e.add_to_cart_count), 0) AS add_to_cart,
      COALESCE(SUM(e.begin_checkout_count), 0) AS checkouts,
      COALESCE(SUM(e.purchase_count), 0) AS orders,
      COALESCE(SUM(e.purchase_revenue), 0) AS revenue
    FROM session_sources s
    LEFT JOIN session_events e ON s.session_id = e.session_id
    GROUP BY s.source, s.medium, s.campaign
    ORDER BY sessions DESC
    LIMIT 50
  `, ...queryArgs);

  const topSources = sources.map((src: any) => ({
    source: src.source,
    medium: src.medium || '',
    campaign: src.campaign || '',
    sessions: Number(src.sessions),
    visitors: Number(src.visitors),
    addToCart: Number(src.add_to_cart),
    checkouts: Number(src.checkouts),
    orders: Number(src.orders),
    revenue: Math.round(Number(src.revenue) * 100) / 100,
    conversionRate: Number(src.sessions) > 0
      ? Math.round((Number(src.orders) / Number(src.sessions)) * 100 * 100) / 100
      : 0,
  }));

  const responseData = { sources: topSources };
  trafficCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
  return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[Analytics Traffic] Error:', error.message);
    return NextResponse.json({ sources: [], error: error.message });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
