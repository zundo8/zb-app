import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shopifyProductId = searchParams.get('productId');
    if (!shopifyProductId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    // Resolve local CUID using Shopify product ID
    const localProduct = await prisma.product.findUnique({
      where: { shopifyProductId: String(shopifyProductId) }
    });

    if (!localProduct) {
      return NextResponse.json({ skus: [] }, { status: 200 });
    }

    // Ensure the table is created
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS product_skus (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id TEXT NOT NULL,
          sku TEXT UNIQUE NOT NULL,
          size TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'IN_STOCK',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      console.error('Error ensuring product_skus table exists in skus API:', e);
    }

    const skus = await prisma.$queryRawUnsafe(
      `SELECT * FROM product_skus WHERE product_id = $1 ORDER BY created_at DESC`,
      localProduct.id
    );

    return NextResponse.json({ skus }, { status: 200 });
  } catch (error: any) {
    console.error('API Inventory SKUs Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
