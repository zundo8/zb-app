import prisma from './db';

const API_VERSION = '2025-01';
export { API_VERSION };

// Declare global for caching config to avoid 'any'
declare global {
  // eslint-disable-next-line no-var
  var _cachedShopConfig: { domain: string; accessToken: string } | undefined;
}

export async function getShopConfig() {
  try {
    if (global._cachedShopConfig) return global._cachedShopConfig;
    
    // Always use environment variables directly for production stability and to avoid DB desyncs
    const finalDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com';
    const finalToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
    
    const config = {
      domain: finalDomain,
      accessToken: finalToken,
    };

    if (finalToken) {
      global._cachedShopConfig = config;
    }

    return config;
  } catch (error) {
    console.warn('[Shopify Admin] Database access failed during config fetch:', error);
    return {
      domain: process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com',
      accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
    };
  }
}

export async function adminUrl(endpoint: string): Promise<string> {
  const { domain } = await getShopConfig();
  return `https://${domain}/admin/api/${API_VERSION}/${endpoint}`;
}

export async function headers(): Promise<HeadersInit> {
  const { accessToken } = await getShopConfig();
  if (!accessToken) {
    console.error('[Shopify Client] No access token found for headers');
  }
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken || '',
  };
}

// In-memory cache for GET requests to prevent rate limiting (429)
// especially during dashboard polling.
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds cache

export async function shopifyFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(await adminUrl(endpoint));
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  
  const cacheKey = url.toString();
  const now = Date.now();
  const cached = requestCache.get(cacheKey);

  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data as T;
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: await headers(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    // If rate limited, try to serve from expired cache if available as last resort
    if (res.status === 429 && cached) {
      console.warn(`[Shopify Client] Rate limited. Serving stale cache for ${endpoint}`);
      return cached.data as T;
    }
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  const data = await res.json();
  requestCache.set(cacheKey, { data, timestamp: now });
  return data as T;
}

export function clearShopConfigCache() {
  global._cachedShopConfig = undefined;
  requestCache.clear();
}

