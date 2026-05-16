import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchProductsCount, fetchOrdersCount, fetchCustomersCount } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Parallel fetch for all counts
    const [
      productsCount,
      customersCount,
      ordersCount,
      returnsCount,
      exchangesCount
    ] = await Promise.all([
      // Use Shopify counts for products and customers if possible, 
      // or DB counts for what we have locally
      prisma.product.count(),
      prisma.customer.count(),
      prisma.order.count(),
      prisma.returnRequest.count(),
      prisma.exchangeRequest.count()
    ]);

    // Also get Shopify-specific counts if needed for comparison
    let shopifyProductsCount = 0;
    try {
      shopifyProductsCount = await fetchProductsCount();
    } catch (e) {
      console.warn('Failed to fetch Shopify product count');
    }

    return NextResponse.json({
      success: true,
      stats: {
        productsCount,
        shopifyProductsCount,
        customersCount,
        ordersCount,
        returnsCount,
        exchangesCount,
        lastSync: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
