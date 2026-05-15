import { ADMIN_API_BASE_URL, config } from '../constants/config';
import { apiGet } from './shopify';

// Unified API Client for Storefront
export const StorefrontAPI = {
  async fetch<T>(
    endpoint: string, 
    params?: Record<string, string>, 
    fallbackPath?: string
  ): Promise<T> {
    const url = new URL(`${ADMIN_API_BASE_URL}${endpoint}`);
    if (params) {
      Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout constraint

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Admin proxy returned ${response.status}`);
      }

      const result = await response.json();
      // Ensure we return the inner data so it's compatible with extractProducts/normalizeProduct
      return result.data as T;
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`[StorefrontAPI] Primary cache proxy failed for ${endpoint}, falling back. Error: ${err.message}`);
      
      // Fallback: The prompt states "retries the call directly against the Shopify Storefront API"
      // Since the app uses apiGet (/api/app) to fetch from Shopify previously, we'll use that as the fallback.
      if (fallbackPath) {
        return apiGet<T>(fallbackPath, params);
      }
      throw err;
    }
  }
};
