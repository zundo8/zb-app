import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  value: T;
  expiry: number;
}

class CacheService {
  private memoryCache = new Map<string, CacheItem<any>>();
  private static instance: CacheService;

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Hydrate in-memory cache from AsyncStorage on app launch
   */
  async hydrate() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('zb_cache_'));
      const items = await AsyncStorage.multiGet(cacheKeys);

      const now = Date.now();
      items.forEach(([key, value]) => {
        if (value) {
          try {
            const item: CacheItem<any> = JSON.parse(value);
            if (item.expiry > now) {
              this.memoryCache.set(key, item);
            } else {
              // Cleanup expired items
              AsyncStorage.removeItem(key);
            }
          } catch (e) {
            AsyncStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Cache hydration failed:', error);
    }
  }

  /**
   * Set item in both in-memory and persistent cache
   */
  async set<T>(key: string, value: T, ttlMinutes: number) {
    const expiry = Date.now() + ttlMinutes * 60 * 1000;
    const item: CacheItem<T> = { value, expiry };
    const cacheKey = `zb_cache_${key}`;

    this.memoryCache.set(cacheKey, item);

    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(item));
    } catch (error) {
      console.error('Failed to save to persistent cache:', error);
    }
  }

  /**
   * Get item from cache (memory first, then persistent)
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = `zb_cache_${key}`;
    const now = Date.now();

    // Try memory cache first
    const memoryItem = this.memoryCache.get(cacheKey);
    if (memoryItem) {
      if (memoryItem.expiry > now) {
        return memoryItem.value;
      }
      this.memoryCache.delete(cacheKey);
    }

    // Try persistent cache
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const item: CacheItem<T> = JSON.parse(raw);
        if (item.expiry > now) {
          // Re-populate memory cache
          this.memoryCache.set(cacheKey, item);
          return item.value;
        }
        await AsyncStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.error('Failed to get from persistent cache:', error);
    }

    return null;
  }

  /**
   * Invalidate specific key or all cache
   */
  async invalidate(key?: string) {
    if (key) {
      const cacheKey = `zb_cache_${key}`;
      this.memoryCache.delete(cacheKey);
      await AsyncStorage.removeItem(cacheKey);
    } else {
      this.memoryCache.clear();
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('zb_cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    }
  }
}

export const cacheService = CacheService.getInstance();
