import { NextResponse } from 'next/server';
import { getCachedStorefrontData, withStorefrontProxyConfig } from '@/lib/storefront-proxy';
import { fetchCollections } from '@/lib/storefront-graphql';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return withStorefrontProxyConfig(req, async () => {
    const { data, cacheHit, cachedAt } = await getCachedStorefrontData(
      'collections',
      () => fetchCollections(),
      600, // 10 minutes
      ['collections']
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
