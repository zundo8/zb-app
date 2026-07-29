/**
 * Server-Side IP Geolocation Service
 * Features:
 * - Extracts client IP from x-forwarded-for / x-real-ip headers
 * - Filters out localhost, private, and loopback IPs
 * - In-memory LRU cache with 24-hour TTL (max 10,000 IPs)
 * - Configurable provider via env (ipwhois, ip-api, ipapi)
 * - Fail-open design: returns null without throwing on timeout or API failure
 */

export interface IpGeoResult {
  countryCode: string; // ISO-2 uppercase e.g. "IN", "US"
  country: string;     // Full name e.g. "India"
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

interface CacheEntry {
  data: IpGeoResult | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 10_000;
const ipGeoCache = new Map<string, CacheEntry>();

/**
 * Extract client IP address from HTTP request headers.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return '127.0.0.1';
}

/**
 * Check if an IP address is a private, loopback, or local IP.
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;

  const cleanIp = ip.replace(/^::ffff:/i, '');

  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('169.254.')
  ) {
    return true;
  }

  // Check 172.16.0.0 - 172.31.255.255
  if (cleanIp.startsWith('172.')) {
    const parts = cleanIp.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }

  return false;
}

/**
 * Perform server-side IP to Geolocation lookup with 24h caching.
 */
export async function lookupIpGeo(ip: string): Promise<IpGeoResult | null> {
  if (isPrivateIP(ip)) {
    return null;
  }

  // Check cache
  const cached = ipGeoCache.get(ip);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.data;
    }
    ipGeoCache.delete(ip);
  }

  // Evict oldest entries if cache exceeds max size
  if (ipGeoCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ipGeoCache.keys().next().value;
    if (firstKey) ipGeoCache.delete(firstKey);
  }

  const provider = (process.env.IP_GEO_PROVIDER || 'ipwhois').toLowerCase();
  const apiKey = process.env.IP_GEO_API_KEY || '';

  let result: IpGeoResult | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    if (provider === 'ip-api') {
      const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.countryCode) {
          result = {
            countryCode: json.countryCode.toUpperCase(),
            country: json.country || json.countryCode,
            region: json.regionName || null,
            city: json.city || null,
            lat: typeof json.lat === 'number' ? json.lat : null,
            lng: typeof json.lon === 'number' ? json.lon : null,
          };
        }
      }
    } else if (provider === 'ipapi') {
      const url = apiKey
        ? `https://api.ipapi.com/${encodeURIComponent(ip)}?access_key=${apiKey}`
        : `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        const code = json.country_code || json.country;
        if (code) {
          result = {
            countryCode: String(code).toUpperCase().slice(0, 2),
            country: json.country_name || json.country || code,
            region: json.region || json.region_name || null,
            city: json.city || null,
            lat: typeof json.latitude === 'number' ? json.latitude : typeof json.lat === 'number' ? json.lat : null,
            lng: typeof json.longitude === 'number' ? json.longitude : typeof json.lng === 'number' ? json.lng : null,
          };
        }
      }
    } else {
      // Default: ipwho.is (free, no API key required, reliable JSON format)
      const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.country_code) {
          result = {
            countryCode: String(json.country_code).toUpperCase(),
            country: json.country || json.country_code,
            region: json.region || null,
            city: json.city || null,
            lat: typeof json.latitude === 'number' ? json.latitude : null,
            lng: typeof json.longitude === 'number' ? json.longitude : null,
          };
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[IP Geo] Lookup failed for ${ip}:`, msg);
    }
    result = null;
  }

  // Cache result (even if null, to avoid hammering API on failed IPs for 10 min)
  ipGeoCache.set(ip, {
    data: result,
    expiresAt: result ? Date.now() + CACHE_TTL_MS : Date.now() + 10 * 60 * 1000,
  });

  return result;
}
