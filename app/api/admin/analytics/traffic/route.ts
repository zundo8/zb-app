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
  endDate.setHours(23, 59, 59, 999);

  const dateFilter = { gte: startDate, lte: endDate };

  // Group sessions by UTM source (or referrer if no UTM)
  const sources: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      COALESCE(NULLIF(utm_source, ''), 
        CASE
          WHEN referrer LIKE '%google%' THEN 'Google'
          WHEN referrer LIKE '%facebook%' OR referrer LIKE '%fb%' THEN 'Facebook'
          WHEN referrer LIKE '%instagram%' THEN 'Instagram'
          WHEN referrer LIKE '%whatsapp%' THEN 'WhatsApp'
          WHEN referrer LIKE '%twitter%' OR referrer LIKE '%x.com%' THEN 'Twitter/X'
          WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
          ELSE 'Direct'
        END
      ) AS source,
      COALESCE(utm_medium, '') AS medium,
      COALESCE(utm_campaign, '') AS campaign,
      COUNT(*) AS sessions,
      COUNT(DISTINCT anonymous_id) AS visitors
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at <= $2
    GROUP BY source, medium, campaign
    ORDER BY sessions DESC
    LIMIT 50
  `, startDate, endDate);

  // For each source, get add_to_cart, checkout, purchase counts
  const topSources = [];
  for (const src of sources.slice(0, 20)) {
    const sourceFilter = src.source;

    // Find session IDs for this source
    const sessionIds = await prisma.analyticsSession.findMany({
      where: {
        startedAt: dateFilter,
        OR: [
          { utmSource: sourceFilter },
          ...(sourceFilter === 'Direct' ? [{ utmSource: null, referrer: null }] : []),
        ],
      },
      select: { id: true },
      take: 10000,
    });

    const ids = sessionIds.map((s: any) => s.id);

    let addToCartCount = 0;
    let checkoutCount = 0;
    let purchaseCount = 0;
    let purchaseRevenue = 0;

    if (ids.length > 0) {
      const events = await prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: {
          sessionId: { in: ids },
          eventName: { in: ['add_to_cart', 'begin_checkout', 'purchase'] },
        },
        _count: true,
        _sum: { value: true },
      });

      addToCartCount = events.find((e: any) => e.eventName === 'add_to_cart')?._count || 0;
      checkoutCount = events.find((e: any) => e.eventName === 'begin_checkout')?._count || 0;
      const purchaseData = events.find((e: any) => e.eventName === 'purchase');
      purchaseCount = purchaseData?._count || 0;
      purchaseRevenue = purchaseData?._sum.value || 0;
    }

    topSources.push({
      source: src.source,
      medium: src.medium || '',
      campaign: src.campaign || '',
      sessions: Number(src.sessions),
      visitors: Number(src.visitors),
      addToCart: addToCartCount,
      checkouts: checkoutCount,
      orders: purchaseCount,
      revenue: Math.round(purchaseRevenue * 100) / 100,
      conversionRate: Number(src.sessions) > 0
        ? Math.round((purchaseCount / Number(src.sessions)) * 100 * 100) / 100
        : 0,
    });
  }

  return NextResponse.json({ sources: topSources });
  } catch (error: any) {
    console.error('[Analytics Traffic] Error:', error.message);
    return NextResponse.json({ sources: [], error: error.message }, { status: 200 });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
