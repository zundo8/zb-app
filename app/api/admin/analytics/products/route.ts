/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

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
  const platformFilter = platform ? { platform } : {};

  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const rawEnd = to ? new Date(to) : now;
  const endDate = rawEnd > now ? now : rawEnd;
  const dateFilter = { gte: startDate, lte: endDate };

  // Most viewed products
  const mostViewed = await prisma.analyticsEvent.groupBy({
    by: ['productId'],
    where: { eventName: 'view_item', createdAt: dateFilter, productId: { not: null }, ...platformFilter },
    _count: { id: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 20,
  });

  // Most added to cart
  const mostAddedToCart = await prisma.analyticsEvent.groupBy({
    by: ['productId'],
    where: { eventName: 'add_to_cart', createdAt: dateFilter, productId: { not: null }, ...platformFilter },
    _count: { id: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 20,
  });

  // Best selling (by purchase events)
  const bestSelling = await prisma.analyticsEvent.groupBy({
    by: ['productId'],
    where: { eventName: 'purchase', createdAt: dateFilter, productId: { not: null }, ...platformFilter },
    _count: { id: true },
    _sum: { value: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 20,
  });

  // Collect all unique product IDs to resolve titles
  const allProductIds = new Set<string>();
  [...mostViewed, ...mostAddedToCart, ...bestSelling].forEach((r: any) => {
    if (r.productId) allProductIds.add(r.productId);
  });

  // Resolve product details from DB
  const productDetails = new Map<string, { title: string; image: string | null; handle: string | null }>();
  if (allProductIds.size > 0) {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { shopifyProductId: { in: Array.from(allProductIds) } },
          { id: { in: Array.from(allProductIds) } },
        ],
      },
      select: { id: true, shopifyProductId: true, title: true, featuredImage: true, handle: true },
    });
    for (const p of products) {
      productDetails.set(p.shopifyProductId, { title: p.title, image: p.featuredImage, handle: p.handle });
      productDetails.set(p.id, { title: p.title, image: p.featuredImage, handle: p.handle });
    }
  }

  const enrich = (items: any[], includeRevenue = false) =>
    items.map(item => ({
      productId: item.productId,
      title: productDetails.get(item.productId || '')?.title || 'Unknown Product',
      image: productDetails.get(item.productId || '')?.image || null,
      handle: productDetails.get(item.productId || '')?.handle || null,
      count: item._count.id,
      ...(includeRevenue ? { revenue: Math.round((item._sum?.value || 0) * 100) / 100 } : {}),
    }));

  // Calculate view-to-cart and cart-to-purchase rates per product
  const viewMap = new Map<string | null, number>(mostViewed.map((v: any) => [v.productId, v._count.id]));
  const cartMap = new Map<string | null, number>(mostAddedToCart.map((v: any) => [v.productId, v._count.id]));
  const purchaseMap = new Map<string | null, number>(bestSelling.map((v: any) => [v.productId, v._count.id]));

  const productRates = Array.from(allProductIds).map((pid: string) => {
    const views = viewMap.get(pid) || 0;
    const carts = cartMap.get(pid) || 0;
    const purchases = purchaseMap.get(pid) || 0;
    return {
      productId: pid,
      title: productDetails.get(pid)?.title || 'Unknown',
      views,
      addToCarts: carts,
      purchases,
      viewToCartRate: views > 0 ? Math.round((carts / views) * 100 * 10) / 10 : 0,
      cartToPurchaseRate: carts > 0 ? Math.round((purchases / carts) * 100 * 10) / 10 : 0,
    };
  }).sort((a, b) => b.views - a.views).slice(0, 20);

  return NextResponse.json({
    mostViewed: enrich(mostViewed),
    mostAddedToCart: enrich(mostAddedToCart),
    bestSelling: enrich(bestSelling, true),
    productRates,
  });
  } catch (error: any) {
    console.error('[Analytics Products] Error:', error.message);
    return NextResponse.json({
      mostViewed: [],
      mostAddedToCart: [],
      bestSelling: [],
      productRates: [],
      error: error.message
    });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
