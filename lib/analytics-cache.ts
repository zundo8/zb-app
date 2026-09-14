/**
 * In-process TTL cache for analytics data.
 *
 * Replaces Next.js `unstable_cache` which conflicts with `force-dynamic`
 * routes, caches errors, and generates near-useless cache entries due to
 * per-second ISO date keys.
 *
 * This implementation:
 *  - Rounds date keys to the nearest minute to improve cache hit rates
 *  - Never caches errors (failed fetches always retry on next call)
 *  - Evicts expired entries lazily + on a 60s sweep interval
 *  - Has zero external dependencies
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Date.now() + ttl
}

const cache = new Map<string, CacheEntry<unknown>>();

// Lazy eviction sweep every 60s to prevent unbounded growth
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    // Stop sweep when cache is empty to avoid keeping the process alive
    if (cache.size === 0 && sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, 60_000);
  // Allow the Node process to exit even if the timer is active
  if (sweepTimer && typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
    sweepTimer.unref();
  }
}

/**
 * Build a deterministic cache key from parts.
 * ISO date strings are rounded to the nearest minute to improve hit rates.
 */
function buildKey(parts: string[]): string {
  return parts
    .map((p) => {
      // Round ISO date strings to the nearest minute
      if (/^\d{4}-\d{2}-\d{2}T/.test(p)) {
        return p.replace(/:\d{2}\.\d{3}Z$/, ':00.000Z');
      }
      return p;
    })
    .join('::');
}

/**
 * Wraps an analytics data-fetcher in a simple in-process TTL cache.
 *
 * Key MUST include every param that changes the result (from/to/platform).
 * Errors are NEVER cached — the next call will retry the fetcher.
 *
 * @param keyParts  Cache-key segments (e.g. ['overview', from, to, platform])
 * @param fetcher   Async function that produces the data
 * @param revalidateSeconds  TTL in seconds (default 30)
 */
export async function cachedAnalytics<T>(
  keyParts: string[],
  fetcher: () => Promise<T>,
  revalidateSeconds = 30,
): Promise<T> {
  const key = buildKey(['analytics', ...keyParts]);
  const now = Date.now();

  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.data;
  }

  // Fetch fresh data — errors intentionally NOT cached
  const data = await fetcher();

  cache.set(key, {
    data,
    expiresAt: now + revalidateSeconds * 1000,
  });

  ensureSweep();
  return data;
}
