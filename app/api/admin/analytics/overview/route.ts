/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

// ─── Canonical status sets (Item 1) ─────────────────────────────
// Only these paymentStatus values count toward realized revenue & order counts.
// 'pending', 'open', 'authorized' are explicitly excluded — they are not yet money-in.
const REALIZED_PAYMENT_STATUSES = ['paid', 'partially_paid', 'cod_upfront_paid', 'cod'] as const;

// Orders with these status values are excluded from all revenue/order metrics.
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'payment_failed', 'pending', 'draft', 'abandoned', 'FAILED', 'CANCELLED', 'payment_pending'] as const;

// Valid platform values for allow-list validation (Item 6)
const VALID_PLATFORMS = ['web', 'app'] as const;

// 10-second in-memory response cache to make filter switching super responsive
const overviewCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 10_000;

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

    const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}_${platform || 'all'}`;
    if (!bypassCache) {
      const cached = overviewCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }
    }

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

    // ─── 1. REVENUE & ORDERS (CURR & PREV) + REFUNDS ───────────────
    // Collapsed refundAgg._count into refundedOrders (Item 5 — fewer round-trips)
    const [revenueAgg, prevRevenueAgg, refundAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: dateFilter, ...realizedBaseWhere },
        _sum: { totalPrice: true, subtotalPrice: true, discountAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { createdAt: prevDateFilter, ...realizedBaseWhere },
        _sum: { totalPrice: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          createdAt: dateFilter,
          refundStatus: { in: ['refunded', 'partial_refund'] },
          ...orderTypeFilter,
        },
        _sum: { totalPrice: true },
        _count: true,  // also gives us refundedOrders count
      }),
    ]);

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

    // ─── 2. ORDER BREAKDOWNS ─────────────────────────────────────────
    // statusCounts is unfiltered by payment status (shows all statuses in period)
    // paymentBreakdown uses the shared realized filter
    const [statusCounts, paymentBreakdown, returnedCount] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter, ...orderTypeFilter },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { createdAt: dateFilter, ...realizedBaseWhere },
        _count: true,
        _sum: { totalPrice: true },
      }),
      prisma.return.count({
        where: { requestedAt: dateFilter, status: { in: ['APPROVED', 'COMPLETED'] } },
      }),
    ]);

    const cancelledOrders = statusCounts.find((s: any) => s.status === 'cancelled')?._count || 0;

    // ─── 3. CUSTOMERS — Fixed (Item 2) ─────────────────────────────
    // Properly bounded by date range so it changes with presets.
    // total_customers = distinct customers with ≥1 realized order in [startDate, endDate]
    // new_customers = whose very first realized order ever falls in [startDate, endDate]
    let orderTypeSql = '';
    if (platform === 'web') orderTypeSql = `AND "orderType" IN ('WEB_STORE', 'REGULAR')`;
    else if (platform === 'app') orderTypeSql = `AND "orderType" IN ('MOBILE', 'MOBILE_APP')`;

    const realizedPaymentSql = `AND "paymentStatus" IN ('paid', 'partially_paid', 'cod_upfront_paid', 'cod')`;
    const excludedStatusSql = `AND "status" NOT IN ('cancelled', 'payment_failed', 'pending', 'draft', 'abandoned', 'FAILED', 'CANCELLED', 'payment_pending')`;

    const customerStatsRaw: any[] = await prisma.$queryRawUnsafe(`
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
    `, startDate, endDate);

    const prevCustomerCountRaw: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT "customerId") AS count
      FROM "Order"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
        AND "customerId" IS NOT NULL
        ${realizedPaymentSql}
        ${excludedStatusSql}
        ${orderTypeSql}
    `, prevStart, prevEnd);

    const totalCustomersCount = Number(customerStatsRaw[0]?.total_customers || 0);
    const newCustomerCount = Number(customerStatsRaw[0]?.new_customers || 0);
    const returningCustomerCount = Math.max(0, totalCustomersCount - newCustomerCount);
    const prevTotalCustomersCount = Number(prevCustomerCountRaw[0]?.count || 0);

    // ─── 4. LOGIN & SIGNUP METRICS ───────────────────────────────────
    const [totalLogins, prevTotalLogins, newSignups, prevNewSignups] = await Promise.all([
      prisma.appLogin.count({
        where: { createdAt: dateFilter, status: { in: ['LOGGED_IN', 'SUCCESS', 'ACCOUNT_CREATED'] } },
      }),
      prisma.appLogin.count({
        where: { createdAt: prevDateFilter, status: { in: ['LOGGED_IN', 'SUCCESS', 'ACCOUNT_CREATED'] } },
      }),
      prisma.customer.count({ where: { createdAt: dateFilter } }),
      prisma.customer.count({ where: { createdAt: prevDateFilter } }),
    ]);

    // ─── 5. SESSIONS & VISITORS — Parameterized (Item 6) ─────────────
    // Platform is now validated against allow-list and passed as $3 parameter
    const sessionQuery = platform
      ? `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2 AND platform = $3`
      : `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2`;

    const sessionArgs = platform ? [startDate, endDate, platform] : [startDate, endDate];
    const prevSessionArgs = platform ? [prevStart, prevEnd, platform] : [prevStart, prevEnd];

    const prevSessionQuery = platform
      ? `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2 AND platform = $3`
      : `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors
         FROM analytics_sessions WHERE started_at >= $1 AND started_at <= $2`;

    const [sessionStatsRaw, prevSessionStatsRaw] = await Promise.all([
      prisma.$queryRawUnsafe(sessionQuery, ...sessionArgs) as Promise<any[]>,
      prisma.$queryRawUnsafe(prevSessionQuery, ...prevSessionArgs) as Promise<any[]>,
    ]);

    const sessionCount = Number(sessionStatsRaw[0]?.sessions || 0);
    const uniqueVisitorsCount = Number(sessionStatsRaw[0]?.visitors || 0);
    const prevSessionCount = Number(prevSessionStatsRaw[0]?.sessions || 0);
    const prevUniqueVisitorsCount = Number(prevSessionStatsRaw[0]?.visitors || 0);

    // Active visitors (last 5 minutes)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const activeVisitors = await prisma.analyticsSession.count({
      where: { lastActiveAt: { gte: fiveMinAgo }, ...platformFilter },
    });

    // ─── 6. FUNNEL EVENT COUNTS ─────────────────────────────────────
    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where: {
        createdAt: dateFilter,
        eventName: { in: ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase'] },
        ...platformFilter,
      },
      _count: true,
    });
    const getEventCount = (name: string) => eventCounts.find((e: any) => e.eventName === name)?._count || 0;

    const pageViews = getEventCount('page_view');
    const productViews = getEventCount('view_item');
    const addToCartEvents = getEventCount('add_to_cart');
    const checkoutStarted = getEventCount('begin_checkout');
    const paymentInitiated = getEventCount('payment_initiated');
    const purchases = getEventCount('purchase');

    // ─── 7. CART METRICS — Fixed date fields (Item 3) ──────────────
    const [activeCarts, abandonedCarts, convertedCarts, totalCarts] = await Promise.all([
      prisma.cart.count({ where: { status: 'active', createdAt: dateFilter } }),
      prisma.cart.count({ where: { status: 'abandoned', abandonedAt: dateFilter } }),
      prisma.cart.count({ where: { status: 'converted', createdAt: dateFilter } }),
      prisma.cart.count({ where: { createdAt: dateFilter } }),
    ]);

    // ─── 8. WEB vs APP SPLIT — Uses shared realized filter (Item 1) ─
    // Collapsed into a single groupBy instead of two separate aggregates (Item 5)
    const [platformOrderBreakdown, platformSessionsRaw] = await Promise.all([
      prisma.order.groupBy({
        by: ['orderType'],
        where: {
          createdAt: dateFilter,
          paymentStatus: { in: [...REALIZED_PAYMENT_STATUSES] },
          status: { notIn: [...EXCLUDED_ORDER_STATUSES] },
        },
        _count: true,
        _sum: { totalPrice: true },
      }),
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

    // Aggregate web / app from the grouped result
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

    let webSessions = 0, webVisitors = 0, appSessions = 0, appVisitors = 0;
    for (const row of platformSessionsRaw) {
      if (row.platform === 'web') {
        webSessions = Number(row.sessions);
        webVisitors = Number(row.visitors);
      } else if (row.platform === 'app') {
        appSessions = Number(row.sessions);
        appVisitors = Number(row.visitors);
      }
    }

    // ─── 9. DERIVED RATES ───────────────────────────────────────────
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

    overviewCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[Analytics Overview] Error:', error.message);
    // Item 7: Return HTTP 500 with zero-filled body so client can show error state
    return NextResponse.json({
      error: error.message || 'Failed to load analytics overview',
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
    }, { status: 500 });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
