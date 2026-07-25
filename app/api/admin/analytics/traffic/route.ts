/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const endDate = to ? new Date(to) : now;

  const dateFilter = { gte: startDate, lte: endDate };

  // Fetch sources and metrics using a single query
  const sources: any[] = await prisma.$queryRawUnsafe(`
    WITH session_sources AS (
      SELECT
        id AS session_id,
        anonymous_id,
        COALESCE(
          CASE 
            WHEN LOWER(utm_source) LIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN LOWER(utm_source) LIKE '%google%' THEN 'Google'
            WHEN LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' THEN 'Facebook'
            WHEN LOWER(utm_source) LIKE '%instagram%' OR LOWER(utm_source) LIKE '%ig%' THEN 'Instagram'
            WHEN LOWER(utm_source) LIKE '%twitter%' OR LOWER(utm_source) LIKE '%x%' THEN 'Twitter/X'
            ELSE NULLIF(utm_source, '')
          END,
          CASE
            WHEN LOWER(referrer) LIKE '%google%' THEN 'Google'
            WHEN LOWER(referrer) LIKE '%facebook%' OR LOWER(referrer) LIKE '%fb%' THEN 'Facebook'
            WHEN LOWER(referrer) LIKE '%instagram%' THEN 'Instagram'
            WHEN LOWER(referrer) LIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN LOWER(referrer) LIKE '%twitter%' OR LOWER(referrer) LIKE '%x.com%' THEN 'Twitter/X'
            WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
            ELSE 'Direct'
          END
        ) AS source,
        COALESCE(utm_medium, '') AS medium,
        COALESCE(utm_campaign, '') AS campaign
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
    ),
    session_events AS (
      SELECT
        session_id,
        COUNT(CASE WHEN event_name = 'add_to_cart' THEN 1 END) AS add_to_cart_count,
        COUNT(CASE WHEN event_name = 'begin_checkout' THEN 1 END) AS begin_checkout_count,
        COUNT(CASE WHEN event_name = 'purchase' THEN 1 END) AS purchase_count,
        SUM(CASE WHEN event_name = 'purchase' THEN COALESCE(value, 0) ELSE 0 END) AS purchase_revenue
      FROM analytics_events
      WHERE created_at >= $1 AND created_at <= $2 AND session_id IS NOT NULL
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
  `, startDate, endDate);

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

  return NextResponse.json({ sources: topSources });
  } catch (error: any) {
    console.error('[Analytics Traffic] Error:', error.message);
    return NextResponse.json({ sources: [], error: error.message }, { status: 500 });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
