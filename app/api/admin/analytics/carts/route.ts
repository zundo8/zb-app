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

  // Cart status breakdown
  const [totalCarts, activeCarts, abandonedCarts, convertedCarts, mergedCarts] = await Promise.all([
    prisma.cart.count({ where: { createdAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'active', createdAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'abandoned', createdAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'converted', createdAt: dateFilter } }),
    prisma.cart.count({ where: { status: 'merged', createdAt: dateFilter } }),
  ]);

  // Cart value aggregations
  const [activeCartValue, abandonedCartValue, convertedCartValue] = await Promise.all([
    prisma.cart.aggregate({ where: { status: 'active', createdAt: dateFilter }, _sum: { subtotal: true }, _avg: { subtotal: true } }),
    prisma.cart.aggregate({ where: { status: 'abandoned', createdAt: dateFilter }, _sum: { subtotal: true }, _avg: { subtotal: true } }),
    prisma.cart.aggregate({ where: { status: 'converted', createdAt: dateFilter }, _sum: { subtotal: true }, _avg: { subtotal: true } }),
  ]);

  // Recovery rate: carts that were abandoned but then converted
  // (Carts where status = 'converted' AND abandonedAt is not null)
  const recoveredCarts = await prisma.cart.count({
    where: {
      status: 'converted',
      abandonedAt: { not: null },
      createdAt: dateFilter,
    },
  });
  const recoveryRate = abandonedCarts + recoveredCarts > 0
    ? (recoveredCarts / (abandonedCarts + recoveredCarts)) * 100
    : 0;

  // Most frequently added products (from CartItem)
  const topProducts = await prisma.cartItem.groupBy({
    by: ['productId'],
    where: {
      cart: { createdAt: dateFilter },
    },
    _count: true,
    _sum: { quantity: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 10,
  });

  // Most abandoned products (products in abandoned carts)
  const abandonedProducts = await prisma.cartItem.groupBy({
    by: ['productId'],
    where: {
      cart: { status: 'abandoned', createdAt: dateFilter },
    },
    _count: true,
    orderBy: { _count: { productId: 'desc' } },
    take: 10,
  });

  // Resolve product titles
  const allPids = new Set<string>();
  [...topProducts, ...abandonedProducts].forEach((p: any) => allPids.add(p.productId));

  const productDetails = new Map<string, string>();
  if (allPids.size > 0) {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { shopifyProductId: { in: Array.from(allPids) } },
          { id: { in: Array.from(allPids) } },
        ],
      },
      select: { id: true, shopifyProductId: true, title: true },
    });
    for (const p of products) {
      productDetails.set(p.shopifyProductId, p.title);
      productDetails.set(p.id, p.title);
    }
  }

  // Cart source breakdown
  const sourceCounts = await prisma.cart.groupBy({
    by: ['source'],
    where: { createdAt: dateFilter },
    _count: true,
  });

  return NextResponse.json({
    overview: {
      total: totalCarts,
      active: activeCarts,
      abandoned: abandonedCarts,
      converted: convertedCarts,
      merged: mergedCarts,
      recovered: recoveredCarts,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      abandonmentRate: totalCarts > 0
        ? Math.round((abandonedCarts / totalCarts) * 100 * 10) / 10
        : 0,
    },
    values: {
      activeTotal: Math.round((activeCartValue._sum.subtotal || 0) * 100) / 100,
      activeAvg: Math.round((activeCartValue._avg.subtotal || 0) * 100) / 100,
      abandonedTotal: Math.round((abandonedCartValue._sum.subtotal || 0) * 100) / 100,
      abandonedAvg: Math.round((abandonedCartValue._avg.subtotal || 0) * 100) / 100,
      recoveredRevenue: Math.round((convertedCartValue._sum.subtotal || 0) * 100) / 100,
      averageCartValue: Math.round(((activeCartValue._avg.subtotal || 0) + (abandonedCartValue._avg.subtotal || 0)) / 2 * 100) / 100,
    },
    topProducts: topProducts.map((p: any) => ({
      productId: p.productId,
      title: productDetails.get(p.productId) || 'Unknown',
      carts: p._count,
      totalQuantity: p._sum.quantity || 0,
    })),
    abandonedProducts: abandonedProducts.map((p: any) => ({
      productId: p.productId,
      title: productDetails.get(p.productId) || 'Unknown',
      carts: p._count,
    })),
    sources: sourceCounts.map((s: any) => ({ source: s.source, count: s._count })),
  });
  } catch (error: any) {
    console.error('[Analytics Carts] Error:', error.message);
    return NextResponse.json({
      overview: { total: 0, active: 0, abandoned: 0, converted: 0, merged: 0, recovered: 0, recoveryRate: 0, abandonmentRate: 0 },
      values: { activeTotal: 0, activeAvg: 0, abandonedTotal: 0, abandonedAvg: 0, recoveredRevenue: 0, averageCartValue: 0 },
      topProducts: [],
      abandonedProducts: [],
      sources: [],
      error: error.message
    });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
