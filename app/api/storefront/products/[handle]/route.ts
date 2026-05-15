import { NextResponse } from 'next/server';
import { getCachedStorefrontData, withStorefrontProxyConfig } from '@/lib/storefront-proxy';
import { fetchProductDetail } from '@/lib/storefront-graphql';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { handle: string } }) {
  return withStorefrontProxyConfig(req, async () => {
    const { data, cacheHit, cachedAt } = await getCachedStorefrontData(
      `product-${params.handle}`,
      () => fetchProductDetail(params.handle),
      600, // 10 minutes
      [`product-${params.handle}`]
    );

    return NextResponse.json({
      data,
      cacheHit,
      cachedAt,
      ttl: 600
    });
  });
}

export async function OPTIONS(req: Request) {
  return withStorefrontProxyConfig(req, async () => new NextResponse(null));
}
