import { NextResponse } from 'next/server';
import { fetchProductByHandle, flattenProduct, ShopifyProduct } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const product = await fetchProductByHandle(params.handle);

    if (!product) {
      return NextResponse.json(
        { product: null, error: 'Product not found' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json({ product: await flattenProduct(product) }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[App API] Product by handle error:', error.message);
    return NextResponse.json(
      { product: null, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
