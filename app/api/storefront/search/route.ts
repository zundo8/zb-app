import { NextResponse } from 'next/server';
import { getCachedStorefrontData, withStorefrontProxyConfig } from '@/lib/storefront-proxy';
import { fetchSearch } from '@/lib/storefront-graphql';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return withStorefrontProxyConfig(req, async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    
    if (!q) {
      return NextResponse.json({ data: [], cacheHit: false, cachedAt: new Date().toISOString(), ttl: 120 });
    }

    const { data, cacheHit, cachedAt } = await getCachedStorefrontData(
      `search-${q.toLowerCase()}`,
      () => fetchSearch(q),
      120, // 2 minutes
      ['search']
    );

    return NextResponse.json({
      data,
      cacheHit,
      cachedAt,
      ttl: 120
    });
  });
}

export async function OPTIONS(req: Request) {
  return withStorefrontProxyConfig(req, async () => new NextResponse(null));
}
