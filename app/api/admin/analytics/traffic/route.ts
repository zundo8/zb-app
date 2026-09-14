/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';
import { cachedAnalytics } from '@/lib/analytics-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// Valid platform values for allow-list validation (FIX 7)
const VALID_PLATFORMS = ['web', 'app'] as const;

async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const rawPlatform = searchParams.get('platform');

    // Validate platform against allow-list (FIX 7)
    const platform = rawPlatform && (VALID_PLATFORMS as readonly string[]).includes(rawPlatform) ? rawPlatform : null;

    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const rawEnd = to ? new Date(to) : now;
    const endDate = rawEnd > now ? now : rawEnd;

    const data = await cachedAnalytics(
      ['traffic', startDate.toISOString(), endDate.toISOString(), platform || 'all'],
      async () => {

  // Parameterized platform condition (FIX 7 — kill SQL injection)
  const platformCondition = platform ? `AND platform = $3` : '';
  const queryArgs: any[] = platform ? [startDate, endDate, platform] : [startDate, endDate];

  // Helper to normalize traffic source name
  const normalizeSource = (utm: string | null, ref: string) => {
    if (utm) {
      const lower = utm.toLowerCase();
      if (lower.includes('snapchat')) return 'Snapchat';
      if (lower.includes('whatsapp')) return 'WhatsApp';
      if (lower.includes('google')) return 'Google';
      if (lower.includes('facebook') || lower === 'fb' || lower.includes('fb-')) return 'Facebook';
      if (lower.includes('instagram') || lower === 'ig' || lower.includes('igshopping')) return 'Instagram';
      if (lower.includes('twitter') || lower === 'x') return 'Twitter/X';
      if (lower.includes('chatgpt') || lower.includes('perplexity')) return 'AI Referral';
      return utm;
    }
    return ref;
  };

  // Run fast decoupled aggregations in parallel without heavy 200k-row LEFT JOINs
  const [rawSessions, rawConversions]: [any[], any[]] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT
        utm_source,
        COALESCE(NULLIF(utm_medium, ''), 'None') AS medium,
        CASE
          WHEN referrer ILIKE '%google%' THEN 'Google'
          WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%fb%' THEN 'Facebook'
          WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
          WHEN referrer ILIKE '%whatsapp%' THEN 'WhatsApp'
          WHEN referrer ILIKE '%twitter%' OR referrer ILIKE '%x.com%' THEN 'Twitter/X'
          WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
          ELSE 'Direct'
        END AS ref_source,
        COUNT(*) AS sessions,
        COUNT(DISTINCT anonymous_id) AS visitors
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
        ${platformCondition}
      GROUP BY utm_source, 2, 3
    `, ...queryArgs),
    prisma.$queryRawUnsafe(`
      SELECT
        utm_source,
        COALESCE(NULLIF(utm_medium, ''), 'None') AS medium,
        CASE
          WHEN referrer ILIKE '%google%' THEN 'Google'
          WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%fb%' THEN 'Facebook'
          WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
          WHEN referrer ILIKE '%whatsapp%' THEN 'WhatsApp'
          WHEN referrer ILIKE '%twitter%' OR referrer ILIKE '%x.com%' THEN 'Twitter/X'
          WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
          ELSE 'Direct'
        END AS ref_source,
        COUNT(CASE WHEN event_name = 'add_to_cart' THEN 1 END) AS add_to_cart,
        COUNT(CASE WHEN event_name = 'begin_checkout' THEN 1 END) AS checkouts,
        COUNT(CASE WHEN event_name = 'purchase' THEN 1 END) AS orders,
        COALESCE(SUM(CASE WHEN event_name = 'purchase' THEN value ELSE 0 END), 0) AS revenue
      FROM analytics_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name IN ('add_to_cart', 'begin_checkout', 'purchase')
        ${platformCondition}
      GROUP BY utm_source, 2, 3
    `, ...queryArgs),
  ]);

  // Aggregate sessions by friendly source name & medium
  const sourcesMap = new Map<string, {
    source: string;
    medium: string;
    campaign: string;
    sessions: number;
    visitors: number;
    addToCart: number;
    checkouts: number;
    orders: number;
    revenue: number;
  }>();

  for (const row of rawSessions) {
    const src = normalizeSource(row.utm_source, row.ref_source);
    const key = `${src}:::${row.medium}`;
    const existing = sourcesMap.get(key) || {
      source: src,
      medium: row.medium,
      campaign: '',
      sessions: 0,
      visitors: 0,
      addToCart: 0,
      checkouts: 0,
      orders: 0,
      revenue: 0,
    };
    existing.sessions += Number(row.sessions || 0);
    existing.visitors += Number(row.visitors || 0);
    sourcesMap.set(key, existing);
  }

  // Merge conversion events
  for (const row of rawConversions) {
    const src = normalizeSource(row.utm_source, row.ref_source);
    const key = `${src}:::${row.medium}`;
    const existing = sourcesMap.get(key) || {
      source: src,
      medium: row.medium,
      campaign: '',
      sessions: 0,
      visitors: 0,
      addToCart: 0,
      checkouts: 0,
      orders: 0,
      revenue: 0,
    };
    existing.addToCart += Number(row.add_to_cart || 0);
    existing.checkouts += Number(row.checkouts || 0);
    existing.orders += Number(row.orders || 0);
    existing.revenue += Number(row.revenue || 0);
    sourcesMap.set(key, existing);
  }

  const topSources = Array.from(sourcesMap.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 50)
    .map(src => ({
      source: src.source,
      medium: src.medium || '',
      campaign: src.campaign || '',
      sessions: src.sessions,
      visitors: src.visitors,
      addToCart: src.addToCart,
      checkouts: src.checkouts,
      orders: src.orders,
      revenue: Math.round(src.revenue * 100) / 100,
      conversionRate: src.sessions > 0
        ? Math.round((src.orders / src.sessions) * 100 * 100) / 100
        : 0,
    }));

    const responseData = { sources: topSources };
    return responseData;
      },
      30
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Analytics Traffic] Error:', error.message);
    return NextResponse.json({ sources: [], error: error.message });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
