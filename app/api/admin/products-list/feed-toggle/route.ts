/**
 * API: Toggle product feed inclusion
 *
 * PATCH /api/admin/products-list/feed-toggle
 * Body: { shopifyProductId: string, includeInFeed: boolean }
 *
 * Protected by middleware (/api/admin/:path* requires admin auth).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { shopifyProductId, includeInFeed } = body;

    if (!shopifyProductId || typeof includeInFeed !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: shopifyProductId (string), includeInFeed (boolean)' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { shopifyProductId: String(shopifyProductId) },
      select: { id: true, title: true },
    });

    if (!product) {
      // Product doesn't exist in Prisma yet — create a stub with the feed flag
      // This handles products that haven't been synced to the local DB
      const shop = await prisma.shop.findFirst({ select: { id: true } });
      if (!shop) {
        return NextResponse.json({ error: 'No shop found' }, { status: 500 });
      }

      await prisma.product.create({
        data: {
          shopId: shop.id,
          shopifyProductId: String(shopifyProductId),
          title: 'Unknown',
          includeInFeed,
        },
      });

      return NextResponse.json({
        success: true,
        shopifyProductId,
        includeInFeed,
        created: true,
      });
    }

    await prisma.product.update({
      where: { shopifyProductId: String(shopifyProductId) },
      data: { includeInFeed },
    });

    return NextResponse.json({
      success: true,
      shopifyProductId,
      includeInFeed,
      title: product.title,
    });
  } catch (err: any) {
    console.error('[Feed Toggle API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/** GET: Fetch all products with their feed inclusion status */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      select: {
        shopifyProductId: true,
        includeInFeed: true,
      },
    });

    const feedMap: Record<string, boolean> = {};
    for (const p of products) {
      feedMap[p.shopifyProductId] = p.includeInFeed;
    }

    return NextResponse.json({ feedMap });
  } catch (err: any) {
    console.error('[Feed Toggle API] GET Error:', err);
    return NextResponse.json({ feedMap: {} }, { status: 200 });
  }
}
