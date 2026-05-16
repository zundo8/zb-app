import { NextResponse } from 'next/server';
import { searchProducts, flattenProduct, ShopifyProduct } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '48', 10);

    if (!query.trim()) {
      return NextResponse.json({ products: [] }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const products = await searchProducts(query, limit);

    if (url.searchParams.get('count') === 'true') {
      return NextResponse.json({ total: products.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const flat = await Promise.all(products.map(flattenProduct));

    return NextResponse.json({ products: flat }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[App API] Search error:', error.message);
    return NextResponse.json(
      { products: [], error: error.message },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
