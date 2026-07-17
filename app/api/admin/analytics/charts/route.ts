/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const platform = searchParams.get('platform');

  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const endDate = to ? new Date(to) : now;
  endDate.setHours(23, 59, 59, 999);

  // Determine aggregation granularity
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let truncUnit: string;
  if (durationDays <= 2) truncUnit = 'hour';
  else if (durationDays <= 90) truncUnit = 'day';
  else if (durationDays <= 365) truncUnit = 'week';
  else truncUnit = 'month';

  const platformFilter = platform ? `AND platform = '${platform}'` : '';

  // Order/revenue time series from Order table
  const orderTypeCondition = platform === 'web'
    ? `AND "orderType" IN ('WEB_STORE', 'REGULAR')`
    : platform === 'app'
      ? `AND "orderType" IN ('MOBILE', 'MOBILE_APP')`
      : '';

  const orderTimeSeries: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      date_trunc('${truncUnit}', "createdAt") AS bucket,
      COUNT(*) AS orders,
      COALESCE(SUM("totalPrice"), 0) AS revenue
    FROM "Order"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "paymentStatus" IN ('paid')
      AND "status" NOT IN ('cancelled')
      ${orderTypeCondition}
    GROUP BY bucket
    ORDER BY bucket ASC
  `, startDate, endDate);

  // Session/visitor time series
  const sessionTimeSeries: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      date_trunc('${truncUnit}', started_at) AS bucket,
      COUNT(*) AS sessions,
      COUNT(DISTINCT anonymous_id) AS visitors
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at <= $2
      ${platformFilter}
    GROUP BY bucket
    ORDER BY bucket ASC
  `, startDate, endDate);

  // Event time series (add_to_cart, begin_checkout, purchase)
  const eventTimeSeries: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      date_trunc('${truncUnit}', created_at) AS bucket,
      event_name,
      COUNT(*) AS count
    FROM analytics_events
    WHERE created_at >= $1 AND created_at <= $2
      AND event_name IN ('add_to_cart', 'begin_checkout', 'purchase', 'page_view', 'view_item')
      ${platformFilter}
    GROUP BY bucket, event_name
    ORDER BY bucket ASC
  `, startDate, endDate);

  // Merge into unified time series
  const bucketMap = new Map<string, any>();

  for (const row of orderTimeSeries) {
    const key = new Date(row.bucket).toISOString();
    if (!bucketMap.has(key)) bucketMap.set(key, { date: key });
    const entry = bucketMap.get(key)!;
    entry.orders = Number(row.orders);
    entry.revenue = Math.round(Number(row.revenue) * 100) / 100;
  }

  for (const row of sessionTimeSeries) {
    const key = new Date(row.bucket).toISOString();
    if (!bucketMap.has(key)) bucketMap.set(key, { date: key });
    const entry = bucketMap.get(key)!;
    entry.sessions = Number(row.sessions);
    entry.visitors = Number(row.visitors);
  }

  for (const row of eventTimeSeries) {
    const key = new Date(row.bucket).toISOString();
    if (!bucketMap.has(key)) bucketMap.set(key, { date: key });
    const entry = bucketMap.get(key)!;
    entry[row.event_name] = Number(row.count);
  }

  // Sort and fill defaults
  const timeSeries = Array.from(bucketMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(entry => ({
      date: entry.date,
      revenue: entry.revenue || 0,
      orders: entry.orders || 0,
      sessions: entry.sessions || 0,
      visitors: entry.visitors || 0,
      page_view: entry.page_view || 0,
      view_item: entry.view_item || 0,
      add_to_cart: entry.add_to_cart || 0,
      begin_checkout: entry.begin_checkout || 0,
      purchase: entry.purchase || 0,
      conversionRate: entry.sessions > 0
        ? Math.round(((entry.purchase || 0) / entry.sessions) * 100 * 100) / 100
        : 0,
    }));

  return NextResponse.json({ timeSeries, granularity: truncUnit });
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
