import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet } from '../api/shopify';
import { ENDPOINTS } from '../api/queries';
import {
  FlatProduct,
  FlatCollection,
  flattenCollection,
  flattenProduct,
  Collection,
  Product,
} from '../api/types';
import { fallbackCollections, fallbackProducts } from '../constants/fallbackCatalog';

const PRODUCT_CACHE_KEY = 'catalog_products_v1';
const COLLECTION_CACHE_KEY = 'catalog_collections_v1';

async function loadCachedProducts() {
  try {
    const raw = await AsyncStorage.getItem(PRODUCT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as FlatProduct[]) : [];
  } catch {
    return [];
  }
}

async function saveCachedProducts(products: FlatProduct[]) {
  try {
    await AsyncStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(products));
  } catch {
    // Ignore cache write failures.
  }
}

async function loadCachedCollections() {
  try {
    const raw = await AsyncStorage.getItem(COLLECTION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as FlatCollection[]) : [];
  } catch {
    return [];
  }
}

async function saveCachedCollections(collections: FlatCollection[]) {
  try {
    await AsyncStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(collections));
  } catch {
    // Ignore cache write failures.
  }
}

function isShopifyProduct(product: any): product is Product {
  return Boolean(product?.variants?.edges && product?.images?.edges);
}

function isShopifyCollection(collection: any): collection is Collection {
  return Boolean(collection?.handle && (collection?.image?.url !== undefined || collection?.products?.edges));
}

function normalizeProduct(product: any): FlatProduct | null {
  if (!product) {
    return null;
  }

  if (isShopifyProduct(product)) {
    return flattenProduct(product);
  }

  if (product?.node) {
    return normalizeProduct(product.node);
  }

  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant: any) => ({
        id: variant?.id || '',
        title: variant?.title || '',
        availableForSale: Boolean(variant?.availableForSale ?? true),
        quantityAvailable: variant?.quantityAvailable ?? null,
        price: String(variant?.price?.amount || variant?.price || '0'),
        compareAtPrice: variant?.compareAtPrice?.amount || variant?.compareAtPrice || null,
        size:
          variant?.size ||
          variant?.selectedOptions?.find((option: any) => String(option?.name || '').toLowerCase() === 'size')?.value ||
          null,
      }))
    : [];

  const rawImages = Array.isArray(product.images) ? product.images : [];
  const normalizedImages = rawImages
    .map((image: any) => (typeof image === 'string' ? image : image?.url || image?.src || image?.image?.url))
    .filter(Boolean);

  const normalizedMedia = Array.isArray(product.allMedia)
    ? product.allMedia
    : normalizedImages.map((url: string) => ({
        mediaContentType: 'IMAGE' as const,
        image: { url, altText: null },
        alt: null,
      }));

  const normalizedProductVideo =
    typeof product.productVideo === 'string'
      ? product.productVideo
      : (product.productVideo as any)?.url || undefined;

  const hasVideoMedia = normalizedMedia.some(
    (media: any) =>
      media?.mediaContentType === 'VIDEO'
      || media?.mediaContentType === 'EXTERNAL_VIDEO'
  );
  if (normalizedProductVideo && !hasVideoMedia) {
    normalizedMedia.push({
      mediaContentType: 'VIDEO',
      alt: null,
      sources: [{ url: normalizedProductVideo, mimeType: 'video/mp4' }],
    } as any);
  }

  return {
    id: String(product.id || ''),
    title: String(product.title || ''),
    handle: String(product.handle || ''),
    productType: String(product.productType || ''),
    description: String(product.description || ''),
    descriptionHtml: product.descriptionHtml,
    availableForSale: Boolean(product.availableForSale ?? true),
    featuredImage:
      typeof product.featuredImage === 'string'
        ? product.featuredImage
        : product.featuredImage?.url || normalizedImages[0] || '',
    images: normalizedImages,
    price: String(product.price?.amount || product.price || variants[0]?.price || '0'),
    compareAtPrice:
      product.compareAtPrice?.amount || product.compareAtPrice || variants[0]?.compareAtPrice || null,
    variants,
    isSoldOut:
      typeof product.isSoldOut === 'boolean'
        ? product.isSoldOut
        : variants.length > 0
          ? !variants.some((variant: any) => variant.availableForSale)
          : !Boolean(product.availableForSale ?? true),
    isOnSale:
      typeof product.isOnSale === 'boolean'
        ? product.isOnSale
        : Boolean(product.compareAtPrice || variants[0]?.compareAtPrice),
    video: product.video,
    allMedia: normalizedMedia,
    details: product.details,
    care: product.care,
    sizeChart: product.sizeChart,
    productVideo: normalizedProductVideo,
  };
}

function normalizeCollection(collection: any): FlatCollection | null {
  if (!collection) {
    return null;
  }

  if (isShopifyCollection(collection)) {
    return flattenCollection(collection);
  }

  if (collection?.node) {
    return normalizeCollection(collection.node);
  }

  return {
    id: String(collection.id || ''),
    title: String(collection.title || ''),
    handle: String(collection.handle || ''),
    description: String(collection.description || ''),
    image:
      typeof collection.image === 'string'
        ? collection.image
        : collection.image?.url || null,
  };
}

function extractProducts(payload: any): FlatProduct[] {
  const candidates = payload?.products
    || payload?.data?.products
    || payload?.data?.items
    || payload?.items
    || payload;

  const rawProducts = Array.isArray(candidates)
    ? candidates
    : Array.isArray(candidates?.edges)
      ? candidates.edges
      : [];

  return rawProducts
    .map(normalizeProduct)
    .filter((product: FlatProduct | null): product is FlatProduct => Boolean(product?.id));
}

function extractProduct(payload: any): FlatProduct | null {
  return normalizeProduct(
    payload?.product
    || payload?.data?.product
    || payload?.data?.item
    || payload?.item
    || payload
  );
}

function extractCollections(payload: any): FlatCollection[] {
  const candidates = payload?.collections
    || payload?.data?.collections
    || payload?.items
    || payload;

  const rawCollections = Array.isArray(candidates)
    ? candidates
    : Array.isArray(candidates?.edges)
      ? candidates.edges
      : [];

  return rawCollections
    .map(normalizeCollection)
    .filter((collection: FlatCollection | null): collection is FlatCollection => Boolean(collection?.id));
}

export function useProducts(count = 24) {
  const [products, setProducts] = useState<FlatProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<{ products: FlatProduct[] }>(
        ENDPOINTS.products,
        { limit: String(count) }
      );
      const normalizedProducts = extractProducts(data);

      if (normalizedProducts.length > 0) {
        setProducts(normalizedProducts);
        await saveCachedProducts(normalizedProducts);
        return;
      }

      throw new Error(typeof (data as any)?.error === 'string' ? (data as any).error : 'Empty product response');
    } catch (err: any) {
      const cachedProducts = await loadCachedProducts();
      const recoveryProducts = cachedProducts.length > 0 ? cachedProducts : fallbackProducts;
      setProducts(recoveryProducts.slice(0, count));
      setError(cachedProducts.length > 0 ? 'Showing saved products while the catalog reconnects.' : 'Showing bundled products while the catalog reconnects.');
    } finally {
      setLoading(false);
    }
  }, [count]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

export function useProductByHandle(handle: string) {
  const [product, setProduct] = useState<FlatProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet<{ product: FlatProduct | null }>(
          ENDPOINTS.productByHandle(handle)
        );
        const normalizedProduct = extractProduct(data);

        if (normalizedProduct) {
          setProduct(normalizedProduct);
          return;
        }

        throw new Error(typeof (data as any)?.error === 'string' ? (data as any).error : 'Product not found');
      } catch (err: any) {
        const cachedProducts = await loadCachedProducts();
        const fallbackProduct = [...cachedProducts, ...fallbackProducts].find((item) => item.handle === handle) || null;
        setProduct(fallbackProduct);
        setError(fallbackProduct ? 'Showing saved product details while the catalog reconnects.' : err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [handle]);

  return { product, loading, error };
}

/**
 * Score a product's relevancy to a search query (client-side).
 * Higher score = more relevant. 0 = no match.
 */
function relevancyScore(product: FlatProduct, lq: string): number {
  let score = 0;
  const title = (product.title || '').toLowerCase();
  const handle = (product.handle || '').toLowerCase();
  const type = (product.productType || '').toLowerCase();

  if (title === lq) score += 100;
  else if (title.startsWith(lq)) score += 80;
  else if (title.includes(lq)) score += 60;

  if (handle.includes(lq)) score += 30;

  if (type === lq) score += 40;
  else if (type.includes(lq)) score += 25;

  return score;
}

export function useSearchProducts() {
  const [results, setResults] = useState<FlatProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const normalizedQuery = query.trim().toLowerCase();

    try {
      setLoading(true);
      const data = await apiGet<{ products: FlatProduct[] }>(
        ENDPOINTS.search,
        { q: query, limit: '48' }
      );
      const normalizedProducts = extractProducts(data);

      if (normalizedProducts.length > 0) {
        // Sort by relevancy so the best matches appear first
        const sorted = [...normalizedProducts].sort(
          (a, b) => relevancyScore(b, normalizedQuery) - relevancyScore(a, normalizedQuery)
        );
        setResults(sorted);
        return;
      }

      throw new Error(typeof (data as any)?.error === 'string' ? (data as any).error : 'Search unavailable');
    } catch (err) {
      const cachedProducts = await loadCachedProducts();
      const source = cachedProducts.length > 0 ? cachedProducts : fallbackProducts;

      // Filter to matching products, then sort by relevancy
      const filtered = source
        .filter((product) =>
          product.title.toLowerCase().includes(normalizedQuery)
          || product.handle.toLowerCase().includes(normalizedQuery)
          || product.productType.toLowerCase().includes(normalizedQuery)
        )
        .sort((a, b) => relevancyScore(b, normalizedQuery) - relevancyScore(a, normalizedQuery));

      setResults(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

export function useCollections(count = 20, location?: 'header' | 'page' | 'menu') {
  const [collections, setCollections] = useState<FlatCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: String(count) };
      if (location) params.location = location;
      const data = await apiGet<{ collections: FlatCollection[] }>(
        ENDPOINTS.collections,
        params
      );
      const normalizedCollections = extractCollections(data);

      if (normalizedCollections.length > 0) {
        setCollections(normalizedCollections);
        await saveCachedCollections(normalizedCollections);
        return;
      }

      throw new Error(typeof (data as any)?.error === 'string' ? (data as any).error : 'Empty collection response');
    } catch (err) {
      const cachedCollections = await loadCachedCollections();
      setCollections(cachedCollections.length > 0 ? cachedCollections : fallbackCollections);
    } finally {
      setLoading(false);
    }
  }, [count]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, refetch: fetchCollections };
}

export function useCollectionByHandle(handle: string) {
  const [collection, setCollection] = useState<FlatCollection | null>(null);
  const [products, setProducts] = useState<FlatProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollection = useCallback(async () => {
    try {
      setLoading(true);
      
      // If handle is 'all', we fetch all products instead of a specific collection
      if (handle === 'all') {
        const data = await apiGet<any>(ENDPOINTS.products, { limit: '50' });
        const normalizedProducts = extractProducts(data);
        
        setCollection({
          id: 'all',
          title: 'All Products',
          handle: 'all',
          description: 'Explore the entire Zica Bella archive.',
          image: normalizedProducts[0]?.featuredImage || null
        });
        setProducts(normalizedProducts);
        return;
      }

      const data = await apiGet<any>(
        ENDPOINTS.collectionByHandle(handle),
        { limit: '50' }
      );
      const normalizedCollection = normalizeCollection(data?.collection || data?.data?.collection || data) || null;
      const normalizedProducts = extractProducts(data);

      if (normalizedCollection || normalizedProducts.length > 0) {
        setCollection(normalizedCollection);
        setProducts(normalizedProducts);
        return;
      }

      throw new Error(typeof data?.error === 'string' ? data.error : 'Collection unavailable');
    } catch (err) {
      setCollection(fallbackCollections.find((collection) => collection.handle === handle) || null);
      setProducts(handle === 'accessories' ? fallbackProducts : []);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return { collection, products, loading, refetch: fetchCollection };
}
