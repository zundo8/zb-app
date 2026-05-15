import { NextResponse } from 'next/server';
import { getCachedStorefrontData, withStorefrontProxyConfig } from '@/lib/storefront-proxy';
import { fetchCollectionProducts } from '@/lib/storefront-graphql';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { handle: string } }) {
  return withStorefrontProxyConfig(req, async () => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const cursor = url.searchParams.get('cursor') || undefined;

    const key = `collection-products-${params.handle}-${limit}-${cursor || 'start'}`;

    const { data, cacheHit, cachedAt } = await getCachedStorefrontData(
      key,
      () => fetchCollectionProducts(params.handle, limit, cursor),
      300, // 5 minutes
      [`collection-products-${params.handle}`]
    );

    return NextResponse.json({
      data,
      cacheHit,
      cachedAt,
      ttl: 300
    });
  });
}

export async function OPTIONS(req: Request) {
  return withStorefrontProxyConfig(req, async () => new NextResponse(null));
}
