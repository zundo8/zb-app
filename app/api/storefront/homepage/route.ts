import { NextResponse } from 'next/server';
import { getCachedStorefrontData, withStorefrontProxyConfig } from '@/lib/storefront-proxy';
import { fetchCollections, fetchCollectionProducts, fetchProducts } from '@/lib/storefront-graphql';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return withStorefrontProxyConfig(req, async () => {
    const { data, cacheHit, cachedAt } = await getCachedStorefrontData(
      'homepage',
      async () => {
        // Parallel fetch for homepage data
        const [collections, accessories, productsResp] = await Promise.all([
          fetchCollections(),
          fetchCollectionProducts('accessories', 15),
          fetchProducts(24)
        ]);

        return {
          collections,
          accessories: accessories?.products?.edges?.map((e: any) => e.node) || [],
          products: productsResp || []
        };
      },
      900, // 15 minutes
      ['homepage', 'products', 'collections']
    );

    return NextResponse.json({
      data,
      cacheHit,
      cachedAt,
      ttl: 900
    });
  });
}

export async function OPTIONS(req: Request) {
  return withStorefrontProxyConfig(req, async () => new NextResponse(null));
}
