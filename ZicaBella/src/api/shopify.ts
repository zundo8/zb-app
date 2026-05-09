// API client for the admin dashboard backend proxy
// All requests go through the admin dashboard — no direct Shopify API calls

import { config } from '../constants/config';
import { useAuthStore } from '../store/authStore';

const API_BASE = `${config.appUrl}/api/app`;

export async function apiFetch<T>(
  endpoint: string,
  options?: { method?: string; body?: any; params?: Record<string, string>; timeoutMs?: number }
): Promise<T> {
  let url = `${API_BASE}${endpoint}`;

  // Append query params
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const token = useAuthStore.getState().token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 15000);

  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: controller.signal,
  };

  if (options?.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeout);

    // Handle 401 — token expired or invalid
    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new Error('Session expired. Please log in again.');
    }

    // Guard against non-JSON responses (e.g. HTML error pages)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Something went wrong. Please try again.`);
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorJson.error || 'Something went wrong. Please try again.');
    }

    return (await response.json()) as T;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

// Convenience helpers
export async function apiGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  return apiFetch<T>(endpoint, { params });
}

export async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'POST', body });
}

export async function apiPatch<T>(endpoint: string, body: any): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'PATCH', body });
}

// Higher-level service helpers
export const serviceApi = {
  returns: {
    /** Submit a return/exchange request for an order */
    create: (body: any) => apiPost('/orders/return', body),
    /** List all returns for a customer */
    list: (customerId: string) => apiGet<any>('/returns', { customerId }),
    /** Get a single return by ID (uses order detail endpoint) */
    get: (id: string) => apiGet(`/returns`, { customerId: id }),
  },
  exchanges: {
    /** Submit an exchange request (same endpoint as returns, action: 'exchange') */
    create: (body: any) => apiPost('/orders/return', body),
    /** List all exchanges for a customer */
    list: (customerId: string) => apiGet<any>('/exchanges', { customerId }),
    /** Get a single exchange by ID */
    get: (id: string) => apiGet(`/exchanges`, { customerId: id }),
  },
};
