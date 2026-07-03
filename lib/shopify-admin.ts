/**
 * Shopify Admin API Client
 * Centralized client for all Shopify Admin REST API calls.
 * Fetches the Admin access token dynamically from the local database.
 */

import prisma from './db';
import { parseShopifyRichText } from './utils';

export { parseShopifyRichText };

import { 
  getShopConfig, 
  shopifyFetch, 
  adminUrl, 
  headers,
  API_VERSION,
  clearShopConfigCache
} from './shopify-client';

export { getShopConfig, shopifyFetch, adminUrl, headers, clearShopConfigCache, shopifyPatch };

const pageCache = new Map<string, { data: any, nextPageUrl?: string, timestamp: number }>();
const PAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function shopifyFetchPage<T>(urlStr: string): Promise<{ data: T; nextPageUrl?: string }> {
  const now = Date.now();
  const cached = pageCache.get(urlStr);

  if (cached && (now - cached.timestamp < PAGE_CACHE_TTL)) {
    return { data: cached.data as T, nextPageUrl: cached.nextPageUrl };
  }

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
    const res = await fetch(urlStr, {
      method: 'GET',
      headers: await headers(),
      cache: isBuild ? 'force-cache' : 'no-store',
    });

    if (res.status === 429) {
      // Rate limited — serve stale cache if available
      if (cached) {
        console.warn(`[Shopify Admin] Rate limited on page fetch. Serving stale cache.`);
        return { data: cached.data as T, nextPageUrl: cached.nextPageUrl };
      }
      // No cache — wait with exponential backoff and retry
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 4000);
      console.warn(`[Shopify Admin] Rate limited on page fetch, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`Shopify Admin API error [${res.status}]: ${text}`);
      throw new Error(`Shopify API ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (!data) {
      console.error(`[Shopify Admin] API returned empty/null data`);
      return { data: {} as T, nextPageUrl: undefined };
    }

    const linkHeader = res.headers.get('Link');
    let nextPageUrl: string | undefined;

    if (linkHeader) {
      const links = linkHeader.split(',');
      for (const link of links) {
        if (link.includes('rel="next"')) {
          const match = link.match(/<([^>]+)>/);
          if (match) {
            nextPageUrl = match[1];
          }
        }
      }
    }

    pageCache.set(urlStr, { data, nextPageUrl, timestamp: Date.now() });
    return { data, nextPageUrl };
  }

  throw new Error(`Shopify Admin API: Max retries exceeded for page fetch`);
}

/**
 * Execute a Shopify GraphQL API request.
 */
export async function shopifyGraphqlFetch<T>(query: string, variables?: any): Promise<T> {
  const { domain } = await getShopConfig();
  const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
  
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const res = await fetch(url, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ query, variables }),
    cache: isBuild ? 'force-cache' : 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL Error [${res.status}]: ${text}`);
  }

  const result = await res.json();
  if (result.errors) {
    throw new Error(`Shopify GraphQL Error: ${JSON.stringify(result.errors)}`);
  }
  return result.data as T;
}

async function shopifyFetchAll<T>(endpoint: string, params?: Record<string, string>, dataKey?: string): Promise<T[]> {
  const url = new URL(await adminUrl(endpoint));
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  
  let currentUrl: string | undefined = url.toString();
  let allResults: any[] = [];

  while (currentUrl) {
    console.log(`[Shopify Sync] Fetching page: ${currentUrl}`);
    const pageData: { data: any; nextPageUrl?: string } = await shopifyFetchPage<any>(currentUrl);
    
    if (!pageData.data) {
      console.warn(`[Shopify Sync] No data returned for URL: ${currentUrl}`);
      break;
    }

    // Shopify returns data wrapped in a key like { orders: [...] }
    const items = dataKey && pageData.data[dataKey] 
      ? pageData.data[dataKey] 
      : (typeof pageData.data === 'object' ? Object.values(pageData.data)[0] : null);

    if (Array.isArray(items)) {
      allResults = allResults.concat(items);
    } else {
      console.warn(`[Shopify Sync] Items at ${dataKey || 'first key'} is not an array:`, items);
    }
    
    currentUrl = pageData.nextPageUrl;
  }
  
  return allResults;
}

async function shopifyPost<T>(endpoint: string, body: unknown): Promise<T> {
  const url = await adminUrl(endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Shopify Admin API POST error [${res.status}]: ${text}`);
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json();
}

async function shopifyPatch<T>(endpoint: string, body: unknown): Promise<T> {
  const url = await adminUrl(endpoint);
  const res = await fetch(url, {
    method: 'PUT',
    headers: await headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Shopify Admin API PUT error [${res.status}]: ${text}`);
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Orders ──────────────────────────────────────────────────────────

export interface ShopifyOrder {
  id: number;
  name: string; // e.g., "#1001"
  order_number: number;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    orders_count?: number;
    total_spent?: string;
    default_address?: any;
  } | null;
  line_items: {
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string | null;
    product_id: number | null;
    variant_id: number | null;
    variant_title: string | null;
    name: string;
  }[];
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  billing_address?: any;
  note: string | null;
  tags: string;
  total_tax?: string;
  fulfillments?: any[];
  status?: string;
  cancelled_at?: string | null;
  gateway?: string;
  payment_gateway_names?: string[];
}

export async function fetchOrders(limit = 250, status = 'any'): Promise<ShopifyOrder[]> {
  const data = await shopifyFetch<{ orders: ShopifyOrder[] }>('orders.json', {
    limit: String(limit),
    status,
    order: 'created_at desc',
  });
  return data.orders;
}

export async function fetchAllOrders(limit = 250, status = 'any'): Promise<ShopifyOrder[]> {
  const orders = await shopifyFetchAll<ShopifyOrder>('orders.json', {
    limit: String(limit),
    status,
    order: 'created_at desc',
  }, 'orders');
  return orders;
}

export async function fetchOrdersByCustomerId(customerId: string): Promise<ShopifyOrder[]> {
  try {
    const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(`customers/${customerId}/orders.json`, {
      status: 'any',
    });
    return data.orders || [];
  } catch (e) {
    console.error(`[Shopify Admin] Error fetching orders for customer ${customerId}:`, e);
    return [];
  }
}

export async function fetchOrder(orderId: string): Promise<ShopifyOrder> {
  const data = await shopifyFetch<{ order: ShopifyOrder }>(`orders/${orderId}.json`);
  return data.order;
}

export async function createOrder(order: any): Promise<ShopifyOrder> {
  const data = await shopifyPost<{ order: ShopifyOrder }>('orders.json', { order });
  return data.order;
}

export async function cancelOrder(orderId: string, reason = 'customer'): Promise<any> {
  try {
    const data = await shopifyPost<any>(`orders/${orderId}/cancel.json`, { reason });
    return data;
  } catch (e) {
    console.error(`[Shopify Admin] Error cancelling order ${orderId}:`, e);
    throw e;
  }
}

// ─── Customers ───────────────────────────────────────────────────────

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
  verified_email: boolean;
  tags: string;
  addresses: {
    id: number;
    address1: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    default: boolean;
  }[];
  default_address?: {
    id: number;
    address1: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
}

export async function fetchCustomers(limit = 250): Promise<ShopifyCustomer[]> {
  const data = await shopifyFetch<{ customers: ShopifyCustomer[] }>('customers.json', {
    limit: String(limit),
    order: 'created_at desc',
  });
  return data.customers;
}

export async function fetchAllCustomers(limit = 250): Promise<ShopifyCustomer[]> {
  const customers = await shopifyFetchAll<ShopifyCustomer>('customers.json', {
    limit: String(limit),
    order: 'created_at desc',
  }, 'customers');
  return customers;
}

export async function createCustomer(customer: any): Promise<ShopifyCustomer> {
  const data = await shopifyPost<{ customer: ShopifyCustomer }>('customers.json', { customer });
  return data.customer;
}

export async function updateCustomer(customerId: string, updates: any): Promise<ShopifyCustomer> {
  const data = await shopifyPatch<{ customer: ShopifyCustomer }>(`customers/${customerId}.json`, {
    customer: { id: parseInt(customerId, 10), ...updates }
  });
  return data.customer;
}

export async function searchCustomerByPhone(phone: string): Promise<ShopifyCustomer | null> {
  try {
    // Try explicit phone search first
    let data = await shopifyFetch<{ customers: ShopifyCustomer[] }>('customers/search.json', {
      query: `phone:${phone}`,
    });
    if (data.customers?.[0]) return data.customers[0];

    // If that fails, try a general query as some phones might be in notes/tags
    data = await shopifyFetch<{ customers: ShopifyCustomer[] }>('customers/search.json', {
      query: `${phone}`,
    });
    return data.customers?.[0] || null;
  } catch (e) {
    console.error(`[Shopify Admin] Error searching customer by phone ${phone}:`, e);
    return null;
  }
}

export async function searchCustomerByEmail(email: string): Promise<ShopifyCustomer | null> {
  try {
    const data = await shopifyFetch<{ customers: ShopifyCustomer[] }>('customers/search.json', {
      query: `email:${email}`,
    });
    return data.customers?.[0] || null;
  } catch (e) {
    console.error(`[Shopify Admin] Error searching customer by email ${email}:`, e);
    return null;
  }
}

// ─── Collections ─────────────────────────────────────────────────────

export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  updated_at: string;
  body_html: string | null;
  image: { src: string } | null;
}

export async function fetchCollections(limit = 250): Promise<ShopifyCollection[]> {
  try {
    const [data, data2] = await Promise.all([
      shopifyFetch<{ custom_collections: ShopifyCollection[] }>('custom_collections.json', { limit: String(limit) }).catch(() => ({ custom_collections: [] })),
      shopifyFetch<{ smart_collections: ShopifyCollection[] }>('smart_collections.json', { limit: String(limit) }).catch(() => ({ smart_collections: [] })),
    ]);
    
    const all = [...(data?.custom_collections || []), ...(data2?.smart_collections || [])];
    
    // Deduplicate by handle
    const seen = new Set();
    return all.filter(c => {
      if (!c || !c.handle) return false;
      if (seen.has(c.handle)) return false;
      seen.add(c.handle);
      return true;
    });
  } catch (e) {
    console.error("[Shopify Admin] Critical error in fetchCollections:", e);
    return [];
  }
}

export async function fetchProductsByCollectionId(collectionId: string | number, limit = 250): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(`collections/${collectionId}/products.json`, {
    limit: String(limit),
  });
  return data.products;
}

/**
 * Fetches only the collections that are enabled in the admin dashboard for a specific location.
 */
export async function fetchEnabledCollections(location: 'header' | 'page' | 'menu' = 'page', shopDomain?: string): Promise<ShopifyCollection[]> {
  const allCollections = await fetchCollections();
  
  try {
    const shop = (shopDomain ? await prisma.shop.findUnique({
      where: { domain: shopDomain },
      select: {
        enabledCollectionsHeader: true,
        enabledCollectionsPage: true,
        enabledCollectionsMenu: true
      }
    }) : null)
      ?? await prisma.shop.findUnique({
        where: { domain: '8tiahf-bk.myshopify.com' },
        select: {
          enabledCollectionsHeader: true,
          enabledCollectionsPage: true,
          enabledCollectionsMenu: true
        }
      })
      ?? await prisma.shop.findFirst({
        select: {
          enabledCollectionsHeader: true,
          enabledCollectionsPage: true,
          enabledCollectionsMenu: true
        }
      });

    if (!shop) {
      console.log(`[Shopify Admin] No shop config found for ${shopDomain || 'default'}, returning all ${allCollections.length} collections`);
      return allCollections;
    }

    const fieldMap = {
      header: 'enabledCollectionsHeader',
      page: 'enabledCollectionsPage',
      menu: 'enabledCollectionsMenu'
    };

    const fieldName = fieldMap[location] as keyof typeof shop;
    const jsonValue = shop[fieldName] as string | null | undefined;

    console.log(`[Shopify Admin] Fetching for location: ${location}, field: ${String(fieldName)}`);

    if (jsonValue === null || jsonValue === undefined) {
      console.log(`[Shopify Admin] No config for ${location}, showing all ${allCollections.length}`);
      return allCollections;
    }

    const enabledHandles: string[] = JSON.parse(jsonValue).map((h: string) => h.trim().toLowerCase());
    
    if (enabledHandles.length === 0) {
      console.log(`[Shopify Admin] Config for ${location} is empty array, showing all ${allCollections.length}`);
      return allCollections;
    }
    
    const filtered = allCollections.filter((c: any) => {
      const handle = c.handle?.trim().toLowerCase();
      return enabledHandles.includes(handle);
    });

    console.log(`[Shopify Admin] Filtered results for ${location}: ${filtered.length} of ${allCollections.length} enabled`);
    return filtered;
  } catch (e) {
    // Database connection failed, return all collections as fallback
    return allCollections;
  }
}

// ─── Products ────────────────────────────────────────────────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product_type: string;
  vendor: string;
  tags: string;
  image: { src: string } | null;
  images: { id: number; src: string }[];
  variants: {
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    barcode: string | null;
    inventory_item_id: number;
    inventory_quantity: number;
    inventory_management: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }[];
  options?: {
    id: number;
    product_id: number;
    name: string;
    position: number;
    values: string[];
  }[];
  metafields?: ShopifyMetafield[];
  video?: string | null;
}

export interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: string;
  value_type: string;
  description: string | null;
  owner_id: number;
  owner_resource: string;
}


export async function fetchProducts(limit = 250): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>('products.json', {
    limit: String(limit),
  });
  return data.products;
}

export async function fetchAllProducts(limit = 250): Promise<ShopifyProduct[]> {
  const products = await shopifyFetchAll<ShopifyProduct>('products.json', {
    limit: String(limit),
  }, 'products');
  return products;
}

// ─── Inventory ───────────────────────────────────────────────────────

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export async function fetchInventoryLevels(locationIds: string[]): Promise<ShopifyInventoryLevel[]> {
  const data = await shopifyFetch<{ inventory_levels: ShopifyInventoryLevel[] }>('inventory_levels.json', {
    location_ids: locationIds.join(','),
    limit: '250',
  });
  return data.inventory_levels;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  active: boolean;
}

export async function fetchLocations(): Promise<ShopifyLocation[]> {
  const data = await shopifyFetch<{ locations: ShopifyLocation[] }>('locations.json');
  return data.locations;
}

// ─── Count helpers ───────────────────────────────────────────────────

export async function fetchOrdersCount(): Promise<number> {
  const data = await shopifyFetch<{ count: number }>('orders/count.json', { status: 'any' });
  return data.count;
}

export async function fetchProductsCount(): Promise<number> {
  const data = await shopifyFetch<{ count: number }>('products/count.json');
  return data.count;
}

export async function fetchCustomersCount(): Promise<number> {
  const data = await shopifyFetch<{ count: number }>('customers/count.json');
  return data.count;
}

// ─── Write Operations ─────────────────────────────────────────────────

/**
 * Adjust inventory level for an inventory item at a location.
 * delta: positive = increase, negative = decrease.
 */
export async function adjustInventoryLevel(
  inventoryItemId: string,
  locationId: string,
  delta: number
): Promise<ShopifyInventoryLevel> {
  const data = await shopifyPost<{ inventory_level: ShopifyInventoryLevel }>(
    'inventory_levels/adjust.json',
    {
      inventory_item_id: parseInt(inventoryItemId, 10),
      location_id: parseInt(locationId, 10),
      available_adjustment: delta,
    }
  );
  return data.inventory_level;
}

/**
 * Set (not adjust) absolute inventory quantity for an item at a location.
 */
export async function setInventoryLevel(
  inventoryItemId: string,
  locationId: string,
  quantity: number
): Promise<ShopifyInventoryLevel> {
  const data = await shopifyPost<{ inventory_level: ShopifyInventoryLevel }>(
    'inventory_levels/set.json',
    {
      inventory_item_id: parseInt(inventoryItemId, 10),
      location_id: parseInt(locationId, 10),
      available: quantity,
    }
  );
  return data.inventory_level;
}

/**
 * Create a fulfillment for an order.
 */
export async function createFulfillment(
  orderId: string,
  locationId: string,
  lineItems?: { id: number; quantity: number }[],
  tracking?: { number?: string; url?: string; company?: string }
): Promise<any> {
  const body: any = {
    fulfillment: {
      location_id: parseInt(locationId, 10),
      notify_customer: true,
    },
  };
  if (lineItems?.length) {
    body.fulfillment.line_items = lineItems;
  }
  if (tracking) {
    if (tracking.number) body.fulfillment.tracking_number = tracking.number;
    if (tracking.url) body.fulfillment.tracking_url = tracking.url;
    if (tracking.company) body.fulfillment.tracking_company = tracking.company;
  }
  const data = await shopifyPost<{ fulfillment: any }>(
    `orders/${orderId}/fulfillments.json`,
    body
  );
  return data.fulfillment;
}

/**
 * Update a Shopify product (e.g., change status to active/draft).
 */
export async function updateProduct(
  productId: string,
  updates: { status?: string; title?: string; tags?: string }
): Promise<ShopifyProduct> {
  const data = await shopifyPatch<{ product: ShopifyProduct }>(
    `products/${productId}.json`,
    { product: { id: parseInt(productId, 10), ...updates } }
  );
  return data.product;
}

/**
 * Update a Shopify Variant (e.g., SKU, price, barcode).
 */
export async function updateVariant(
  variantId: string,
  updates: { sku?: string; barcode?: string; price?: string; compare_at_price?: string | null }
): Promise<any> {
  const data = await shopifyPatch<{ variant: any }>(
    `variants/${variantId}.json`,
    { variant: { id: parseInt(variantId, 10), ...updates } }
  );
  return data.variant;
}

/**
 * Fetch a single product by Shopify product ID.
 */
export async function fetchProductById(productId: string): Promise<ShopifyProduct> {
  const data = await shopifyFetch<{ product: ShopifyProduct }>(`products/${productId}.json`);
  const metafields = await fetchProductMetafields(productId);
  return { ...data.product, metafields };
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  // If the handle looks like a numeric ID, try fetching by ID first
  if (/^\d+$/.test(handle)) {
    try {
      const product = await fetchProductById(handle);
      if (product) return product;
    } catch (e) {
      // Fall through to handle search
    }
  }

  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(`products.json?handle=${handle}`);
  if (!data.products || data.products.length === 0) return null;
  const product = data.products[0];
  const metafields = await fetchProductMetafields(product.id.toString());
  return { ...product, metafields };
}

/**
 * Fetch metafields for a single product.
 */
export async function fetchProductMetafields(productId: string): Promise<ShopifyMetafield[]> {
  const data = await shopifyFetch<{ metafields: ShopifyMetafield[] }>(`products/${productId}/metafields.json`);
  return data.metafields;
}

const gidCache = new Map<string, { url: string; timestamp: number }>();
const GID_CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour TTL

/**
 * Resolve a Shopify GID (Video, MediaImage, etc.) to a public URL using GraphQL.
 */
export async function resolveShopifyGid(gid: string): Promise<string | null> {
  if (!gid || !gid.startsWith('gid://shopify/')) return null;

  const now = Date.now();
  const cached = gidCache.get(gid);
  if (cached && (now - cached.timestamp < GID_CACHE_TTL)) {
    return cached.url;
  }

  try {
    const query = `
      query resolveMedia($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            image {
              url
            }
          }
          ... on Video {
            sources {
              url
              mimeType
            }
          }
          ... on GenericFile {
            url
          }
        }
      }
    `;

    const data = await shopifyGraphqlFetch<any>(query, { id: gid });
    const node = data?.node;

    let resolvedUrl: string | null = null;
    if (node?.image?.url) resolvedUrl = node.image.url;
    else if (node?.sources?.[0]?.url) resolvedUrl = node.sources[0].url;
    else if (node?.url) resolvedUrl = node.url;

    if (resolvedUrl) {
      gidCache.set(gid, { url: resolvedUrl, timestamp: now });
      return resolvedUrl;
    }

    return null;
  } catch (e) {
    console.error(`Error resolving GID ${gid}:`, e);
    return null;
  }
}

/**
 * Create a refund for an order.
 */
export interface RefundLineItem {
  line_item_id: number;
  quantity: number;
  restock_type: 'return' | 'cancel' | 'no_restock';
  location_id?: number;
}

export async function createRefund(
  orderId: string,
  refundLineItems: RefundLineItem[],
  note?: string
): Promise<any> {
  const data = await shopifyPost<{ refund: any }>(
    `orders/${orderId}/refunds.json`,
    {
      refund: {
        note: note || 'Refund approved by admin',
        notify: true,
        refund_line_items: refundLineItems,
      },
    }
  );
  return data.refund;
}

/**
 * Get order refunds.
 */
export async function fetchOrderRefunds(orderId: string): Promise<any[]> {
  const data = await shopifyFetch<{ refunds: any[] }>(`orders/${orderId}/refunds.json`);
  return data.refunds;
}

// ─── New API Functions ───────────────────────────────────────────────

/**
 * Fetch shop policies (privacy, refund, terms, shipping, legal).
 * Uses explicit caching to prevent Next.js Dynamic Server Usage 500 errors on static routes.
 */
export async function fetchPolicies(): Promise<{ title: string; body: string; url: string; handle: string }[]> {
  try {
    const url = await adminUrl('policies.json');
    const res = await fetch(url, {
      method: 'GET',
      headers: await headers(),
      // Allow caching for policies to avoid 500 errors on statically generated layouts
      next: { revalidate: 3600 } 
    });

    if (!res.ok) {
      throw new Error(`Shopify API ${res.status}`);
    }

    const data = await res.json();
    return (data.policies || []).map((p: any) => ({
      title: p.title,
      body: p.body,
      url: p.url,
      handle: p.handle,
    }));
  } catch (e) {
    console.error('fetchPolicies error:', e);
    return [];
  }
}

/**
 * Score a product's relevancy to a search query.
 * Higher score = more relevant. 0 = no match at all.
 */
function productRelevancyScore(p: ShopifyProduct, lq: string): number {
  let score = 0;
  const title = (p.title || '').toLowerCase();
  const type = (p.product_type || '').toLowerCase();
  const tags = (p.tags || '').toLowerCase();
  const vendor = (p.vendor || '').toLowerCase();
  const handle = (p.handle || '').toLowerCase();
  const desc = (p.body_html || '').toLowerCase();

  // Title matches (highest priority)
  if (title === lq) score += 100;
  else if (title.startsWith(lq)) score += 80;
  else if (title.includes(lq)) score += 60;

  // Handle matches
  if (handle.includes(lq)) score += 30;

  // Product type matches
  if (type === lq) score += 40;
  else if (type.includes(lq)) score += 25;

  // Tag matches
  if (tags.includes(lq)) score += 20;

  // Vendor matches
  if (vendor.includes(lq)) score += 10;

  // Description matches
  if (desc.includes(lq)) score += 15;

  // Term-level matching for multi-word queries
  const terms = lq.split(/\s+/).filter(t => t.length >= 2);
  if (terms.length > 0) {
    terms.forEach(term => {
      if (title.includes(term)) score += 20;
      if (tags.includes(term)) score += 10;
      if (type.includes(term)) score += 8;
      if (handle.includes(term)) score += 6;
      if (vendor.includes(term)) score += 3;
      if (desc.includes(term)) score += 5;
    });
  }

  return score;
}

/**
 * Search products by keyword — uses GraphQL for full-text search,
 * then filters and sorts results by relevancy. Falls back to REST for redundancy.
 */
export async function searchProducts(query: string, limit = 48): Promise<ShopifyProduct[]> {
  if (!query?.trim()) return [];
  const q = query.trim();
  const lq = q.toLowerCase();

  // Map a GraphQL product node to ShopifyProduct shape
  function mapGraphQLNode(node: any): ShopifyProduct {
    const extractId = (gid: string) => parseInt(gid.split('/').pop() || '0', 10);
    return {
      id: extractId(node.id),
      title: node.title,
      handle: node.handle,
      body_html: node.bodyHtml || null,
      status: node.status,
      created_at: node.createdAt,
      updated_at: node.updatedAt,
      product_type: node.productType || '',
      vendor: node.vendor || '',
      tags: (node.tags || []).join(', '),
      image: node.featuredImage ? { src: node.featuredImage.url } : null,
      images: (node.images?.edges || []).map((edge: any) => ({
        id: extractId(edge.node.id),
        src: edge.node.url,
      })),
      variants: (node.variants?.edges || []).map((edge: any) => {
        const v = edge.node;
        return {
          id: extractId(v.id),
          title: v.title,
          price: v.price,
          compare_at_price: v.compareAtPrice || null,
          sku: null,
          barcode: null,
          inventory_item_id: 0,
          inventory_quantity: v.inventoryQuantity || 0,
          inventory_management: null,
          option1: v.selectedOptions?.[0]?.value || null,
          option2: v.selectedOptions?.[1]?.value || null,
          option3: v.selectedOptions?.[2]?.value || null,
        };
      }),
    };
  }

  const graphqlQuery = `
    query searchProducts($query: String!, $limit: Int!) {
      products(first: $limit, query: $query) {
        edges {
          node {
            id
            title
            handle
            bodyHtml
            status
            createdAt
            updatedAt
            productType
            vendor
            tags
            featuredImage { url }
            images(first: 5) { edges { node { id, url } } }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  inventoryQuantity
                  selectedOptions { name, value }
                }
              }
            }
            productVideo: metafield(namespace: "custom", key: "product_video") {
              value
            }
            productVideo2: metafield(namespace: "custom", key: "product-video") {
              value
            }
          }
        }
      }
    }
  `;

  try {
    // Use plain text query — Shopify's GraphQL does built-in full-text search
    const data = await shopifyGraphqlFetch<any>(graphqlQuery, { query: q, limit });

    if (data?.products?.edges?.length > 0) {
      const products = await Promise.all(
        data.products.edges.map(async ({ node }: any) => {
          const p = mapGraphQLNode(node);
          const rawVideo = node.productVideo?.value || node.productVideo2?.value || null;
          if (rawVideo) {
            if (rawVideo.startsWith('gid://shopify/')) {
              p.video = await resolveShopifyGid(rawVideo).catch(() => null);
            } else {
              p.video = rawVideo;
            }
          } else {
            p.video = null;
          }
          return p;
        })
      );

      // Filter to only products that actually match the query
      const matching = products.filter((p: ShopifyProduct) => productRelevancyScore(p, lq) > 0);

      // Sort by relevancy score (highest first)
      const sorted = (matching.length > 0 ? matching : products)
        .sort((a: ShopifyProduct, b: ShopifyProduct) => productRelevancyScore(b, lq) - productRelevancyScore(a, lq));

      console.log(`[Search] GraphQL returned ${products.length} products, ${matching.length} matched query "${q}"`);
      return sorted.slice(0, limit);
    }

    throw new Error('GraphQL search returned no results');
  } catch (e) {
    console.warn('[Search] GraphQL search failed, using REST fallback:', (e as Error).message);

    try {
      // Fetch all products and filter/sort locally — REST title param is exact match only
      const allData = await shopifyFetch<{ products: ShopifyProduct[] }>('products.json', { limit: '250' });
      const allProducts = allData.products || [];

      // Score, filter, and sort
      const scored = allProducts
        .map(p => ({ product: p, score: productRelevancyScore(p, lq) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const resolved = await Promise.all(
        scored.map(async ({ product: p }) => {
          try {
            const metafields = await fetchProductMetafields(p.id.toString()).catch(() => []);
            const videoMeta = metafields.find(m => m.namespace === 'custom' && (m.key === 'product_video' || m.key === 'product-video'));
            if (videoMeta?.value) {
              if (videoMeta.value.startsWith('gid://shopify/')) {
                p.video = await resolveShopifyGid(videoMeta.value).catch(() => null);
              } else {
                p.video = videoMeta.value;
              }
            } else {
              p.video = null;
            }
          } catch (e) {
            p.video = null;
          }
          return p;
        })
      );

      console.log(`[Search] REST fallback: ${resolved.length} matches out of ${allProducts.length} products for "${q}"`);
      return resolved;
    } catch (restError) {
      console.error('[Search] REST fallback also failed:', restError);
      return [];
    }
  }
}


/**
 * Fetch a collection and its products by handle.
 */
export async function fetchCollectionByHandle(handle: string, limit = 24): Promise<{
  collection: { id: number; title: string; handle: string; body_html: string; image?: { src: string } } | null;
  products: ShopifyProduct[];
}> {
  try {
    const allCollections = await fetchCollections();
    const collection = allCollections.find(c => c.handle?.toLowerCase() === handle?.toLowerCase()) as any;
    
    if (!collection) return { collection: null, products: [] };

    const productsData = await shopifyFetch<{ products: ShopifyProduct[] }>('products.json', {
      collection_id: String(collection.id),
      limit: String(limit),
    });

    return { collection, products: productsData.products || [] };
  } catch (e) {
    console.error('fetchCollectionByHandle error:', e);
    return { collection: null, products: [] };
  }
}

/**
 * Fetch all navigation menus with their nested items from Shopify using GraphQL.
 * This is efficient as it fetches everything in one round-trip.
 */
export async function fetchMenus(): Promise<any[]> {
  try {
    const query = `
      {
        menus(first: 50) {
          edges {
            node {
              id
              title
              handle
              items {
                title
                url
                items {
                  title
                  url
                  items {
                    title
                    url
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await shopifyGraphqlFetch<any>(query);
    const menus = data.menus?.edges.map((e: any) => e.node) || [];
    console.log(`[Shopify Menus] Successfully fetched ${menus.length} menus`);
    return menus;
  } catch (e) {
    console.error('[Shopify Menus] fetchMenus error:', e);
    return [];
  }
}

/**
 * Fetch a specific menu by handle. 
 * Reuses fetchMenus() to find the matching handle in memory.
 */
export async function fetchMenu(handle: string): Promise<any | null> {
  if (!handle) return null;
  
  try {
    const allMenus = await fetchMenus();
    const menu = allMenus.find(m => m.handle === handle);
    
    if (menu) {
      console.log(`[Shopify Menu] Found menu "${handle}": ${menu.title} (${menu.items?.length || 0} items)`);
    } else {
      console.warn(`[Shopify Menu] No menu found with handle: "${handle}"`);
    }
    
    return menu;
  } catch (e) {
    console.error(`[Shopify Menu] Error looking up menu "${handle}":`, e);
    return null;
  }
}

// ─── Product Normalization ──────────────────────────────────────────

function normalizeMetaKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function getMetafieldRaw(p: ShopifyProduct, keys: string[]): string | undefined {
  if (!p.metafields?.length) return undefined;
  const keySet = new Set(keys.map(normalizeMetaKey));
  const metafield = p.metafields.find(
    (m) => m.namespace === 'custom' && keySet.has(normalizeMetaKey(m.key))
  );
  return metafield?.value || undefined;
}

async function resolveMetafieldValue(value?: string): Promise<string | undefined> {
  if (!value) return undefined;
  if (!value.startsWith('gid://shopify/')) return value;
  return (await resolveShopifyGid(value)) || undefined;
}

function getMetafieldText(p: ShopifyProduct, key: string): string | undefined {
  const mf = p.metafields?.find(m => m.namespace === 'custom' && m.key === key);
  if (!mf?.value) return undefined;
  try {
    const data = JSON.parse(mf.value);
    let text = '';
    const extract = (node: any) => {
      if (node.type === 'text') text += node.value;
      if (node.children) node.children.forEach(extract);
      if (node.type === 'list-item') text += '\n• ';
      if (node.type === 'paragraph' || node.type === 'list') text += '\n';
    };
    extract(data);
    return text.trim();
  } catch {
    return mf.value;
  }
}

export async function flattenProduct(p: ShopifyProduct) {
  // Ensure metafields are present (REST list endpoints don't include them)
  const metafields = p.metafields || await fetchProductMetafields(p.id.toString()).catch(() => []);
  const pWithMeta = { ...p, metafields };

  const sizeOptionIndex = p.options?.findIndex(o => o.name.toLowerCase() === 'size') ?? -1;
  const colorOptionIndex = p.options?.findIndex(o => o.name.toLowerCase() === 'color' || o.name.toLowerCase() === 'colour') ?? -1;

  const variants = (p.variants || []).map(v => {
    let size = null;
    let color = null;

    if (sizeOptionIndex === 0) size = v.option1;
    else if (sizeOptionIndex === 1) size = v.option2;
    else if (sizeOptionIndex === 2) size = v.option3;

    if (colorOptionIndex === 0) color = v.option1;
    else if (colorOptionIndex === 1) color = v.option2;
    else if (colorOptionIndex === 2) color = v.option3;

    // Fallbacks if not detected by indexes
    if (!size) size = v.option1 || null;
    if (!color) color = v.option2 || null;

    return {
      id: `gid://shopify/ProductVariant/${v.id}`,
      title: v.title,
      availableForSale: (v.inventory_quantity ?? 0) > 0,
      quantityAvailable: v.inventory_quantity ?? 0,
      price: v.price,
      compareAtPrice: v.compare_at_price || null,
      size,
      color,
    };
  });

  const price = variants[0]?.price || '0';
  const compareAtPrice = variants[0]?.compareAtPrice || null;
  const isOnSale = compareAtPrice ? parseFloat(compareAtPrice) > parseFloat(price) : false;
  const isSoldOut = !variants.some(v => v.availableForSale);

  const allMedia: any[] = (p.images || []).map((img) => ({
    mediaContentType: 'IMAGE' as const,
    image: { url: img.src, altText: null },
    alt: null,
  }));

  const [productVideo, sizeChart] = await Promise.all([
    resolveMetafieldValue(getMetafieldRaw(pWithMeta, ['product_video', 'product-video', 'product video'])),
    resolveMetafieldValue(getMetafieldRaw(pWithMeta, ['size_chart', 'size-chart', 'size chart', 'size_chart_image', 'size-chart-image', 'size chart image'])),
  ]);

  if (productVideo) {
    allMedia.push({
      mediaContentType: 'VIDEO',
      alt: null,
      sources: [{ url: productVideo, mimeType: 'video/mp4' }],
    });
  }

  return {
    id: `gid://shopify/Product/${p.id}`,
    title: p.title,
    handle: p.handle,
    productType: p.product_type || '',
    description: p.body_html ? p.body_html.replace(/<[^>]*>/g, '') : '',
    descriptionHtml: p.body_html || '',
    availableForSale: !isSoldOut,
    featuredImage: p.image?.src || p.images?.[0]?.src || '',
    images: (p.images || []).map(img => img.src),
    price,
    compareAtPrice,
    variants,
    isSoldOut,
    isOnSale,
    video: undefined,
    allMedia,
    details: getMetafieldText(pWithMeta, 'details'),
    care: getMetafieldText(pWithMeta, 'care'),
    sizeChart,
    productVideo,
  };
}
