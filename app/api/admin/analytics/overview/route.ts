/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';
import { cachedAnalytics } from '@/lib/analytics-cache';
import { convertedCartWhere, abandonedCartWhere } from '@/lib/cartConversion';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ─── Inline pLimit: cap concurrent DB queries per route ────────
// No external dependency needed. Limits how many promises run at once.
function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => { if (queue.length > 0 && active < concurrency) { active++; queue.shift()!(); } };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => fn().then(resolve, reject).finally(() => { active--; next(); });
      queue.push(run);
      next();
    });
}

// ─── Canonical status sets (Item 1) ─────────────────────────────
// Only these paymentStatus values count toward realized revenue & order counts.
// 'pending', 'open', 'authorized' are explicitly excluded — they are not yet money-in.
const REALIZED_PAYMENT_STATUSES = ['paid', 'partially_paid', 'cod_upfront_paid', 'cod'] as const;

// Orders with these status values are excluded from all revenue/order metrics.
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'payment_failed', 'pending', 'draft', 'abandoned', 'FAILED', 'CANCELLED', 'payment_pending'] as const;

// Valid platform values for allow-list validation (Item 6)
const VALID_PLATFORMS = ['web', 'app'] as const;

// Empty response shape for graceful degradation (FIX 6)
const EMPTY_RESPONSE = {
  period: { from: new Date().toISOString(), to: new Date().toISOString() },
  revenue: { total: 0, net: 0, gross: 0, refunds: 0, discounts: 0, change: 0 },
  orders: { total: 0, aov: 0, cancelled: 0, returned: 0, refunded: 0, change: 0, statusBreakdown: [], paymentBreakdown: [] },
  customers: { total: 0, new: 0, returning: 0, change: 0 },
  logins: { total: 0, new: 0, change: 0, newChange: 0 },
  visitors: { total: 0, active: 0, change: 0 },
  sessions: { total: 0, web: 0, app: 0, change: 0 },
  funnel: { pageViews: 0, productViews: 0, addToCart: 0, checkoutStarted: 0, paymentInitiated: 0, purchases: 0 },
  carts: { total: 0, active: 0, abandoned: 0, converted: 0, abandonmentRate: 0 },
  rates: { conversion: 0, addToCart: 0, cartToCheckout: 0, checkoutToPurchase: 0, cartAbandonment: 0 },
  platformSplit: {
    web: { orders: 0, revenue: 0, sessions: 0, visitors: 0 },
    app: { orders: 0, revenue: 0, sessions: 0, visitors: 0 },
  },
};

async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const rawPlatform = searchParams.get('platform'); // 'web' | 'app' | null (all)
    const bypassCache = searchParams.get('bypassCache') === 'true';

    // Validate platform against allow-list (Item 6 — kill SQL injection)
    const platform = rawPlatform && (VALID_PLATFORMS as readonly string[]).includes(rawPlatform) ? rawPlatform : null;

    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Clamp endDate to 'now' when preset's `to` is in the future (Item 3)
    const rawEnd = to ? new Date(to) : now;
    const endDate = rawEnd > now ? now : rawEnd;

    const data = await cachedAnalytics(
      ['overview', startDate.toISOString(), endDate.toISOString(), platform || 'all'],
      async () => {
    // Previous period for comparison
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - durationMs);
    const prevEnd = new Date(startDate.getTime() - 1);

    const dateFilter = { gte: startDate, lte: endDate };
    const prevDateFilter = { gte: prevStart, lte: prevEnd };

    // Platform → orderType mapping
    const orderTypeFilter = platform === 'app'
      ? { orderType: { in: ['MOBILE', 'MOBILE_APP'] } }
      : platform === 'web'
        ? { orderType: { in: ['WEB_STORE', 'REGULAR'] } }
        : {};

    const platformFilter = platform ? { platform } : {};

    // ── Shared base WHERE for all realized-revenue queries (Item 1) ──
    const realizedBaseWhere = {
      paymentStatus: { in: [...REALIZED_PAYMENT_STATUSES] },
      status: { notIn: [...EXCLUDED_ORDER_STATUSES] },
      ...orderTypeFilter,
    };

    // ── Platform SQL conditions for raw queries ──
    let orderTypeSql = '';
    if (platform === 'web') orderTypeSql = `AND "orderType" IN ('WEB_STORE', 'REGULAR')`;
    else if (platform === 'app') orderTypeSql = `AND "orderType" IN ('MOBILE', 'MOBILE_APP')`;

    const realizedPaymentSql = `AND "paymentStatus" IN ('paid', 'partially_paid', 'cod_upfront_paid', 'cod')`;
    const excludedStatusSql = `AND "status" NOT IN ('cancelled', 'payment_failed', 'pending', 'draft', 'abandoned', 'FAILED', 'CANCELLED', 'payment_pending')`;

    // ────────────────────────────────────────────────────────────────────
    // OPTIMIZATION: 2-Phase Execution to prevent pool exhaustion
    // Phase 1: Fast transactional model aggregates (Order, Cart, Logins)
    //   → Run through pLimit(4) to cap at 4 concurrent DB queries
    // Phase 2: Targeted analytical queries on analytics tables
    // ────────────────────────────────────────────────────────────────────

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const limit = pLimit(4);

    // ── Shared cart predicates (FIX 3 — match abandoned-carts page) ──
    const cartPlatformFilter = platform === 'app'
      ? { source: 'mobile_app' }
      : platform === 'web'
        ? { source: 'webstore' }
        : {};

    // ── PHASE 1: Quick Prisma aggregates (Orders, Carts, Logins, Customers) ──
    const [
      revenueAgg,
      prevRevenueAgg,
      refundAgg,
      statusCounts,
      paymentBreakdown,
      returnedCount,
      totalLogins,
      prevTotalLogins,
      newSignups,
      prevNewSignups,
      activeCarts,
      abandonedCarts,
      convertedCarts,
      totalCarts,
      platformOrderBreakdown,
      activeVisitors,
    ]: any = await Promise.all([
      limit(() => prisma.order.aggregate({
        where: { createdAt: dateFilter, ...realizedBaseWhere },
        _sum: { totalPrice: true, subtotalPrice: true, discountAmount: true },
        _count: true,
      })),
      limit(() => prisma.order.aggregate({
        where: { createdAt: prevDateFilter, ...realizedBaseWhere },
        _sum: { totalPrice: true },
        _count: true,
      })),
      limit(() => prisma.order.aggregate({
        where: {
          createdAt: dateFilter,
          refundStatus: { in: ['refunded', 'partial_refund'] },
          ...orderTypeFilter,
        },
        _sum: { totalPrice: true },
        _count: true,
      })),
      limit(() => prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter, ...orderTypeFilter },
        _count: true,
      })),
      limit(() => prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { createdAt: dateFilter, ...realizedBaseWhere },
        _count: true,
        _sum: { totalPrice: true },
      })),
      limit(() => prisma.return.count({
        where: { requestedAt: dateFilter, status: { in: ['APPROVED', 'COMPLETED'] } },
      })),
      limit(() => prisma.appLogin.count({
        where: { createdAt: dateFilter, status: { in: ['LOGGED_IN', 'SUCCESS', 'ACCOUNT_CREATED'] } },
      })),
      limit(() => prisma.appLogin.count({
        where: { createdAt: prevDateFilter, status: { in: ['LOGGED_IN', 'SUCCESS', 'ACCOUNT_CREATED'] } },
      })),
      limit(() => prisma.customer.count({ where: { createdAt: dateFilter } })),
      limit(() => prisma.customer.count({ where: { createdAt: prevDateFilter } })),
      // FIX 3: Use shared cart conversion predicates (match abandoned-carts page)
      limit(() => prisma.cart.count({
        where: {
          status: 'active',
          convertedOrderId: null,
          items: { some: {} },
          lastActivityAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
          createdAt: dateFilter,
          ...cartPlatformFilter,
        },
      })),
      limit(() => prisma.cart.count({
        where: abandonedCartWhere(dateFilter, new Date(now.getTime() - 30 * 60 * 1000), cartPlatformFilter),
      })),
      limit(() => prisma.cart.count({
        where: convertedCartWhere(dateFilter, cartPlatformFilter),
      })),
      limit(() => prisma.cart.count({ where: { createdAt: dateFilter, status: { notIn: ['merged', 'expired'] }, ...cartPlatformFilter } })),
      limit(() => prisma.order.groupBy({
        by: ['orderType'],
        where: {
          createdAt: dateFilter,
          paymentStatus: { in: [...REALIZED_PAYMENT_STATUSES] },
          status: { notIn: [...EXCLUDED_ORDER_STATUSES] },
        },
        _count: true,
        _sum: { totalPrice: true },
      })),
      limit(() => prisma.analyticsSession.count({
        where: { lastActiveAt: { gte: fiveMinAgo }, ...platformFilter },
      })),
    ]);

    // ── PHASE 2: Heavy Analytical Raw Queries (Only 5 concurrent connections) ──
    const platformCondition = platform ? `AND platform = $3` : '';
    const queryArgs: any[] = platform ? [startDate, endDate, platform] : [startDate, endDate];
    const prevQueryArgs: any[] = platform ? [prevStart, prevEnd, platform] : [prevStart, prevEnd];

    // For historical comparisons (>7 days), avoid expensive distinct UUID scans
    const isLongPeriod = (endDate.getTime() - startDate.getTime()) > 7 * 24 * 60 * 60 * 1000;
    const prevSessionQuerySql = isLongPeriod
      ? `SELECT COUNT(*) AS sessions FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2 ${platformCondition}`
      : `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2 ${platformCondition}`;

    const [
      customerStatsRaw,
      prevCustomerCountRaw,
      prevSessionStatsRaw,
      eventCountsRaw,
      platformSessionsRaw,
    ] = await Promise.all([
      // 1. Customer realization CTE
      prisma.$queryRawUnsafe(`
        WITH realized_orders AS (
          SELECT "customerId", "createdAt"
          FROM "Order"
          WHERE "customerId" IS NOT NULL
            ${realizedPaymentSql}
            ${excludedStatusSql}
            ${orderTypeSql}
        ),
        first_orders AS (
          SELECT "customerId", MIN("createdAt") AS first_order_at
          FROM realized_orders
          GROUP BY "customerId"
        ),
        period_customers AS (
          SELECT DISTINCT "customerId"
          FROM realized_orders
          WHERE "createdAt" >= $1 AND "createdAt" <= $2
        )
        SELECT
          COUNT(*) AS total_customers,
          COUNT(CASE WHEN fo.first_order_at >= $1 AND fo.first_order_at <= $2 THEN 1 END) AS new_customers
        FROM period_customers pc
        JOIN first_orders fo ON pc."customerId" = fo."customerId"
      `, startDate, endDate) as Promise<any[]>,

      // 2. Previous period customer count
      prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT "customerId") AS count
        FROM "Order"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
          AND "customerId" IS NOT NULL
          ${realizedPaymentSql}
          ${excludedStatusSql}
          ${orderTypeSql}
      `, prevStart, prevEnd) as Promise<any[]>,

      // 3. Previous period session count
      prisma.$queryRawUnsafe(prevSessionQuerySql, ...prevQueryArgs) as Promise<any[]>,

      // 4. Fast event counts via raw SQL utilizing index
      prisma.$queryRawUnsafe(`
        SELECT event_name AS "eventName", COUNT(*) AS count
        FROM analytics_events
        WHERE created_at >= $1 AND created_at <= $2
          AND event_name IN ('page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase')
          ${platformCondition}
        GROUP BY event_name
      `, ...queryArgs) as Promise<any[]>,

      // 5. Current sessions & visitors grouped by platform (single pass gives both platform split AND totals)
      prisma.$queryRawUnsafe(`
        SELECT
          platform,
          COUNT(*) AS sessions,
          COUNT(DISTINCT anonymous_id) AS visitors
        FROM analytics_sessions
        WHERE started_at >= $1 AND started_at <= $2
        GROUP BY platform
      `, startDate, endDate) as Promise<any[]>,
    ]);

    // ── Derive revenue metrics ──
    const totalRevenue = revenueAgg._sum.totalPrice || 0;
    const grossSales = revenueAgg._sum.subtotalPrice || totalRevenue;
    const totalDiscounts = revenueAgg._sum.discountAmount || 0;
    const totalOrders = revenueAgg._count;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const prevRevenue = prevRevenueAgg._sum.totalPrice || 0;
    const prevOrders = prevRevenueAgg._count;
    const totalRefunds = refundAgg._sum.totalPrice || 0;
    const netRevenue = totalRevenue - totalRefunds;
    const refundedOrders = refundAgg._count;
    const cancelledOrders = statusCounts.find((s: any) => s.status === 'cancelled')?._count || 0;

    // ── Derive customer metrics ──
    const totalCustomersCount = Number(customerStatsRaw[0]?.total_customers || 0);
    const newCustomerCount = Number(customerStatsRaw[0]?.new_customers || 0);
    const returningCustomerCount = Math.max(0, totalCustomersCount - newCustomerCount);
    const prevTotalCustomersCount = Number(prevCustomerCountRaw[0]?.count || 0);

    // ── Derive platform split & session totals ──
    let webSessions = 0, webVisitors = 0, appSessions = 0, appVisitors = 0;
    for (const row of platformSessionsRaw) {
      if (row.platform === 'web') {
        webSessions = Number(row.sessions || 0);
        webVisitors = Number(row.visitors || 0);
      } else if (row.platform === 'app') {
        appSessions = Number(row.sessions || 0);
        appVisitors = Number(row.visitors || 0);
      }
    }
    const sessionCount = webSessions + appSessions;
    const uniqueVisitorsCount = Math.max(webVisitors, appVisitors, 1);
    const prevSessionCount = Number(prevSessionStatsRaw[0]?.sessions || 0);
    const prevUniqueVisitorsCount = Number(prevSessionStatsRaw[0]?.visitors || Math.round(prevSessionCount * 0.75));

    // ── Derive funnel counts ──
    const getEventCount = (name: string) => Number(eventCountsRaw.find((e: any) => e.eventName === name)?.count || 0);
    const pageViews = getEventCount('page_view');
    const productViews = getEventCount('view_item');
    const addToCartEvents = getEventCount('add_to_cart');
    const checkoutStarted = getEventCount('begin_checkout');
    const paymentInitiated = getEventCount('payment_initiated');
    const purchases = getEventCount('purchase');

    // ── Derive platform split orders ──
    const webOrderTypes = ['WEB_STORE', 'REGULAR'];
    const appOrderTypes = ['MOBILE', 'MOBILE_APP'];
    let webOrderCount = 0, webRevenue = 0, appOrderCount = 0, appRevenue = 0;
    for (const row of platformOrderBreakdown) {
      if (webOrderTypes.includes(row.orderType)) {
        webOrderCount += row._count;
        webRevenue += row._sum.totalPrice || 0;
      } else if (appOrderTypes.includes(row.orderType)) {
        appOrderCount += row._count;
        appRevenue += row._sum.totalPrice || 0;
      }
    }

    // ─── DERIVED RATES ───────────────────────────────────────────
    const conversionRate = sessionCount > 0 ? (purchases / sessionCount) * 100 : 0;
    const addToCartRate = sessionCount > 0 ? (addToCartEvents / sessionCount) * 100 : 0;
    const cartToCheckoutRate = addToCartEvents > 0 ? (checkoutStarted / addToCartEvents) * 100 : 0;
    const checkoutToPurchaseRate = checkoutStarted > 0 ? (purchases / checkoutStarted) * 100 : 0;
    const cartAbandonmentRate = (abandonedCarts + convertedCarts) > 0
      ? (abandonedCarts / (abandonedCarts + convertedCarts)) * 100 : 0;

    function pctChange(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    }

    const responseData = {
      period: { from: startDate.toISOString(), to: endDate.toISOString() },
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        net: Math.round(netRevenue * 100) / 100,
        gross: Math.round(grossSales * 100) / 100,
        refunds: Math.round(totalRefunds * 100) / 100,
        discounts: Math.round(totalDiscounts * 100) / 100,
        change: pctChange(totalRevenue, prevRevenue),
      },
      orders: {
        total: totalOrders,
        aov: Math.round(aov * 100) / 100,
        cancelled: cancelledOrders,
        returned: returnedCount,
        refunded: refundedOrders,
        change: pctChange(totalOrders, prevOrders),
        statusBreakdown: statusCounts.map((s: any) => ({ status: s.status, count: s._count })),
        paymentBreakdown: paymentBreakdown.map((p: any) => ({
          method: p.paymentMethod || 'unknown',
          count: p._count,
          revenue: Math.round((p._sum.totalPrice || 0) * 100) / 100,
        })),
      },
      customers: {
        total: totalCustomersCount,
        new: newCustomerCount,
        returning: returningCustomerCount,
        change: pctChange(totalCustomersCount, prevTotalCustomersCount),
      },
      logins: {
        total: totalLogins,
        new: newSignups,
        change: pctChange(totalLogins, prevTotalLogins),
        newChange: pctChange(newSignups, prevNewSignups),
      },
      visitors: {
        total: uniqueVisitorsCount,
        active: activeVisitors,
        change: pctChange(uniqueVisitorsCount, prevUniqueVisitorsCount),
      },
      sessions: {
        total: sessionCount,
        web: webSessions,
        app: appSessions,
        change: pctChange(sessionCount, prevSessionCount),
      },
      funnel: {
        pageViews,
        productViews,
        addToCart: addToCartEvents,
        checkoutStarted,
        paymentInitiated,
        purchases,
      },
      carts: {
        total: totalCarts,
        active: activeCarts,
        abandoned: abandonedCarts,
        converted: convertedCarts,
        abandonmentRate: Math.round(cartAbandonmentRate * 10) / 10,
      },
      rates: {
        conversion: Math.round(conversionRate * 100) / 100,
        addToCart: Math.round(addToCartRate * 100) / 100,
        cartToCheckout: Math.round(cartToCheckoutRate * 100) / 100,
        checkoutToPurchase: Math.round(checkoutToPurchaseRate * 100) / 100,
        cartAbandonment: Math.round(cartAbandonmentRate * 100) / 100,
      },
      platformSplit: {
        web: {
          orders: webOrderCount,
          revenue: Math.round(webRevenue * 100) / 100,
          sessions: webSessions,
          visitors: webVisitors,
        },
        app: {
          orders: appOrderCount,
          revenue: Math.round(appRevenue * 100) / 100,
          sessions: appSessions,
          visitors: appVisitors,
        },
      },
    };

    return responseData;
      },
      30
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Analytics Overview] Error:', error.message);
    // FIX 6: Return HTTP 200 with error field (not 500) so client can show error state
    // uniformly across all analytics routes, without hanging.
    return NextResponse.json({
      error: error.message || 'Failed to load analytics overview',
      ...EMPTY_RESPONSE,
    });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
