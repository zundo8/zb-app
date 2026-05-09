import { NextResponse } from 'next/server';
import { searchProducts, ShopifyProduct } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

function flattenProduct(p: ShopifyProduct) {
  const variants = (p.variants || []).map(v => ({
    id: `gid://shopify/ProductVariant/${v.id}`,
    title: v.title,
    availableForSale: (v.inventory_quantity ?? 0) > 0,
    quantityAvailable: v.inventory_quantity ?? 0,
    price: v.price,
    compareAtPrice: v.compare_at_price || null,
    size: v.option1 || null,
  }));

  const price = variants[0]?.price || '0';
  const compareAtPrice = variants[0]?.compareAtPrice || null;
  const isOnSale = compareAtPrice ? parseFloat(compareAtPrice) > parseFloat(price) : false;
  const isSoldOut = !variants.some(v => v.availableForSale);

  return {
    id: `gid://shopify/Product/${p.id}`,
    title: p.title,
    handle: p.handle,
    productType: p.product_type || '',
    description: p.body_html ? p.body_html.replace(/<[^>]*>/g, '') : '',
    availableForSale: !isSoldOut,
    featuredImage: p.image?.src || p.images?.[0]?.src || '',
    images: (p.images || []).map(img => img.src),
    price,
    compareAtPrice,
    variants,
    isSoldOut,
    isOnSale,
    allMedia: (p.images || []).map(img => ({
      mediaContentType: 'IMAGE' as const,
      image: { url: img.src, altText: null },
      alt: null,
    })),
  };
}

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
    const flat = products.map(flattenProduct);

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
