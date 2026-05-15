import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { rateLimit } from './rate-limit';

// --- Background Cache Warmer Singleton ---
const WARM_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes

declare global {
  var __storefrontWarmerStarted: boolean;
}

if (typeof window === 'undefined' && !global.__storefrontWarmerStarted) {
  global.__storefrontWarmerStarted = true;
  
  // Wait a few seconds for the server to fully start
  setTimeout(() => {
    console.log('[Storefront Proxy] Starting background cache warmer...');
    // We ping our own proxy routes to warm the Next.js cache and Layer 1 cache
    const warmCache = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await Promise.allSettled([
          fetch(`${baseUrl}/api/storefront/collections`),
          fetch(`${baseUrl}/api/storefront/homepage`)
        ]);
        console.log('[Storefront Proxy] Cache warmed successfully.');
      } catch (err: any) {
        console.error('[Storefront Proxy] Cache warming failed:', err.message);
      }
    };
    
    // Initial warm
    warmCache();
    
    // Schedule warming
    setInterval(warmCache, WARM_INTERVAL_MS);
  }, 5000);
}

// Layer 1: In-memory Map for process lifetime caching (fastest)
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

export async function getCachedStorefrontData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number,
  tags: string[]
): Promise<{ data: T; cacheHit: boolean; cachedAt: string }> {
  const now = Date.now();

  const memHit = memoryCache.get(key);
  if (memHit && memHit.expiresAt > now) {
    return {
      data: memHit.data,
      cacheHit: true,
      cachedAt: new Date(now - (memHit.expiresAt - now)).toISOString(),
    };
  }

  const cachedFetch = unstable_cache(
    async () => {
      const data = await fetchFn();
      return { data, timestamp: Date.now() };
    },
    [key],
    { revalidate: ttlSeconds, tags }
  );

  const result = await cachedFetch();

  memoryCache.set(key, { data: result.data, expiresAt: now + ttlSeconds * 1000 });

  return {
    data: result.data,
    cacheHit: now - result.timestamp > 2000,
    cachedAt: new Date(result.timestamp).toISOString(),
  };
}

export function invalidateMemoryCache() {
  memoryCache.clear();
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function withStorefrontProxyConfig(req: Request, handler: () => Promise<NextResponse>) {
  // CORS OPTIONS
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { headers: CORS_HEADERS });
  }

  // Rate Limiter
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const { allowed, remaining } = rateLimit(ip, { maxRequests: 60, windowMs: 60_000 });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { 
        status: 429, 
        headers: { 
          ...CORS_HEADERS, 
          'Retry-After': '60',
          'X-RateLimit-Remaining': String(remaining)
        } 
      }
    );
  }

  return handler().then(res => {
    // Inject CORS into final response
    Object.entries(CORS_HEADERS).forEach(([k, v]) => {
      res.headers.set(k, v);
    });
    return res;
  }).catch(err => {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  });
}
