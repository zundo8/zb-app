import { NextResponse } from 'next/server';
import { fetchAllProducts, fetchCollectionByHandle, flattenProduct, ShopifyProduct } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '24', 10);
    const collectionHandle = url.searchParams.get('collection');

    let products: ShopifyProduct[] = [];
    if (collectionHandle) {
      const result = await fetchCollectionByHandle(collectionHandle, limit);
      products = result.products;
    } else {
      products = await fetchAllProducts(limit);
    }

    const flat = await Promise.all(products.map(flattenProduct));

    return NextResponse.json({ products: flat }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[App API] Products error:', error.message);
    return NextResponse.json(
      { products: [], error: error.message },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
