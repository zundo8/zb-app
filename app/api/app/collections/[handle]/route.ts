import { NextResponse } from 'next/server';
import { fetchCollectionByHandle, flattenProduct, ShopifyProduct } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const { collection, products } = await fetchCollectionByHandle(params.handle, limit);

    // If collection not found, or it's empty, we should try to fetch recent products
    // so the UI doesn't show a 'blank' error section on the homepage
    if (!collection || products.length === 0) {
      console.log(`[App API] Collection ${params.handle} empty or not found. Falling back to global products.`);
      const { fetchProducts } = require('@/lib/shopify-admin');
      const fallbackProducts = await fetchProducts(limit);
      
      return NextResponse.json({
        collection: collection ? {
          id: `gid://shopify/Collection/${collection.id}`,
          title: collection.title,
          handle: collection.handle,
          description: collection.body_html ? collection.body_html.replace(/<[^>]*>/g, '') : '',
          image: collection.image?.src || null,
        } : {
          id: 'gid://shopify/Collection/all',
          title: 'All Products',
          handle: 'all',
          description: '',
          image: null,
        },
        products: await Promise.all(fallbackProducts.map(flattenProduct)),
        isFallback: true,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const flatProducts = await Promise.all(products.map(flattenProduct));

    return NextResponse.json({
      collection: {
        id: `gid://shopify/Collection/${collection.id}`,
        title: collection.title,
        handle: collection.handle,
        description: collection.body_html ? collection.body_html.replace(/<[^>]*>/g, '') : '',
        image: collection.image?.src || null,
      },
      products: flatProducts,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[App API] Collection by handle error:', error.message);
    return NextResponse.json(
      { collection: null, products: [], error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
