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
  const platform = searchParams.get('platform'); // 'web' | 'app' | null (all)

  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = to ? new Date(to) : now;
  endDate.setHours(23, 59, 59, 999);

  // Previous period for comparison (same duration, immediately before)
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - durationMs);
  const prevEnd = new Date(startDate.getTime() - 1);

  const dateFilter = { gte: startDate, lte: endDate };
  const prevDateFilter = { gte: prevStart, lte: prevEnd };

  // Build platform filter for orders
  const orderTypeFilter = platform === 'app'
    ? { orderType: { in: ['MOBILE', 'MOBILE_APP'] } }
    : platform === 'web'
      ? { orderType: { in: ['WEB_STORE', 'REGULAR'] } }
      : {};

  // Build platform filter for sessions/events
  const platformFilter = platform ? { platform } : {};

  // ─── ORDER & REVENUE METRICS ───────────────────────────
  const paidStatuses = ['paid'];
  const excludeStatuses = ['cancelled'];

  const [revenueAgg, prevRevenueAgg] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: dateFilter,
        paymentStatus: { in: paidStatuses },
        status: { notIn: excludeStatuses },
        ...orderTypeFilter,
      },
      _sum: { totalPrice: true, subtotalPrice: true, discountAmount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        createdAt: prevDateFilter,
        paymentStatus: { in: paidStatuses },
        status: { notIn: excludeStatuses },
        ...orderTypeFilter,
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
  ]);

  const totalRevenue = revenueAgg._sum.totalPrice || 0;
  const grossSales = revenueAgg._sum.subtotalPrice || totalRevenue;
  const totalDiscounts = revenueAgg._sum.discountAmount || 0;
  const totalOrders = revenueAgg._count;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const prevRevenue = prevRevenueAgg._sum.totalPrice || 0;
  const prevOrders = prevRevenueAgg._count;

  // Refund amounts
  const refundAgg = await prisma.order.aggregate({
    where: {
      createdAt: dateFilter,
      refundStatus: { in: ['refunded', 'partial_refund'] },
      ...orderTypeFilter,
    },
    _sum: { totalPrice: true },
  });
  const totalRefunds = refundAgg._sum.totalPrice || 0;
  const netRevenue = totalRevenue - totalRefunds;

  // ─── ORDER STATUS BREAKDOWN ────────────────────────────
  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    where: { createdAt: dateFilter, ...orderTypeFilter },
    _count: true,
  });

  const cancelledOrders = statusCounts.find((s: any) => s.status === 'cancelled')?._count || 0;
  const returnedCount = await prisma.return.count({
    where: { requestedAt: dateFilter, status: { in: ['APPROVED', 'COMPLETED'] } },
  });
  const refundedOrders = await prisma.order.count({
    where: { createdAt: dateFilter, refundStatus: { in: ['refunded', 'partial_refund'] }, ...orderTypeFilter },
  });

  // ─── PAYMENT METHOD BREAKDOWN ──────────────────────────
  const paymentBreakdown = await prisma.order.groupBy({
    by: ['paymentMethod'],
    where: {
      createdAt: dateFilter,
      paymentStatus: { in: paidStatuses },
      status: { notIn: excludeStatuses },
      ...orderTypeFilter,
    },
    _count: true,
    _sum: { totalPrice: true },
  });

  // ─── CUSTOMER METRICS ─────────────────────────────────
  const [totalCustomers, prevTotalCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: dateFilter, status: { notIn: excludeStatuses }, ...orderTypeFilter },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
    prisma.order.findMany({
      where: { createdAt: prevDateFilter, status: { notIn: excludeStatuses }, ...orderTypeFilter },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
  ]);

  const customerIds = totalCustomers.map((c: any) => c.customerId);
  // New customers = those whose earliest order is within the current period
  let newCustomerCount = 0;
  if (customerIds.length > 0) {
    const firstOrders = await prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: { notIn: excludeStatuses } },
      _min: { createdAt: true },
    });
    newCustomerCount = firstOrders.filter(
      (fo: any) => fo._min.createdAt && fo._min.createdAt >= startDate && fo._min.createdAt <= endDate
    ).length;
  }
  const returningCustomerCount = customerIds.length - newCustomerCount;

  // ─── SESSION & VISITOR METRICS ─────────────────────────
  const [sessionCount, prevSessionCount, uniqueVisitors, prevUniqueVisitors] = await Promise.all([
    prisma.analyticsSession.count({ where: { startedAt: dateFilter, ...platformFilter } }),
    prisma.analyticsSession.count({ where: { startedAt: prevDateFilter, ...platformFilter } }),
    prisma.analyticsSession.findMany({
      where: { startedAt: dateFilter, ...platformFilter },
      select: { anonymousId: true },
      distinct: ['anonymousId'],
    }),
    prisma.analyticsSession.findMany({
      where: { startedAt: prevDateFilter, ...platformFilter },
      select: { anonymousId: true },
      distinct: ['anonymousId'],
    }),
  ]);

  // Active visitors (last 5 minutes)
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const activeVisitors = await prisma.analyticsSession.count({
    where: { lastActiveAt: { gte: fiveMinAgo }, ...platformFilter },
  });

  // ─── FUNNEL EVENT COUNTS ──────────────────────────────
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

  // ─── CART METRICS ─────────────────────────────────────
  const [activeCarts, abandonedCarts, convertedCarts, totalCarts] = await Promise.all([
    prisma.cart.count({ where: { status: 'active', updatedAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'abandoned', abandonedAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'converted', updatedAt: dateFilter } }),
    prisma.cart.count({ where: { createdAt: dateFilter } }),
  ]);

  // ─── WEB vs APP SPLIT ─────────────────────────────────
  const [webOrders, appOrders] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: dateFilter,
        orderType: { in: ['WEB_STORE', 'REGULAR'] },
        paymentStatus: { in: paidStatuses },
        status: { notIn: excludeStatuses },
      },
      _count: true,
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: dateFilter,
        orderType: { in: ['MOBILE', 'MOBILE_APP'] },
        paymentStatus: { in: paidStatuses },
        status: { notIn: excludeStatuses },
      },
      _count: true,
      _sum: { totalPrice: true },
    }),
  ]);

  const [webSessions, appSessions] = await Promise.all([
    prisma.analyticsSession.count({ where: { startedAt: dateFilter, platform: 'web' } }),
    prisma.analyticsSession.count({ where: { startedAt: dateFilter, platform: 'app' } }),
  ]);

  // ─── DERIVED RATES ────────────────────────────────────
  const conversionRate = sessionCount > 0 ? (purchases / sessionCount) * 100 : 0;
  const addToCartRate = sessionCount > 0 ? (addToCartEvents / sessionCount) * 100 : 0;
  const cartToCheckoutRate = addToCartEvents > 0 ? (checkoutStarted / addToCartEvents) * 100 : 0;
  const checkoutToPurchaseRate = checkoutStarted > 0 ? (purchases / checkoutStarted) * 100 : 0;
  const cartAbandonmentRate = (abandonedCarts + convertedCarts) > 0
    ? (abandonedCarts / (abandonedCarts + convertedCarts)) * 100 : 0;

  // ─── HELPER: % CHANGE ────────────────────────────────
  function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  return NextResponse.json({
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
      total: customerIds.length,
      new: newCustomerCount,
      returning: returningCustomerCount,
      change: pctChange(customerIds.length, prevTotalCustomers.length),
    },
    visitors: {
      total: uniqueVisitors.length,
      active: activeVisitors,
      change: pctChange(uniqueVisitors.length, prevUniqueVisitors.length),
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
      web: { orders: webOrders._count, revenue: Math.round((webOrders._sum.totalPrice || 0) * 100) / 100, sessions: webSessions },
      app: { orders: appOrders._count, revenue: Math.round((appOrders._sum.totalPrice || 0) * 100) / 100, sessions: appSessions },
    },
  });
  } catch (error: any) {
    console.error('[Analytics Overview] Error:', error.message);
    return NextResponse.json({ error: 'Failed to load analytics overview', details: error.message }, { status: 500 });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
