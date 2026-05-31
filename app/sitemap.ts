import { MetadataRoute } from 'next';
import { fetchProducts, fetchCollections } from '@/lib/shopify-admin';
import prisma from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zicabella.com';

  // Fetch all collections, products, and policies concurrently
  const [products, collections, policies] = await Promise.all([
    fetchProducts(250).catch(() => []),
    fetchCollections(250).catch(() => []),
    prisma.policy.findMany({ select: { handle: true, updatedAt: true } }).catch(() => [])
  ]);

  const staticUrls = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/collections`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/story`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
  ];

  const productUrls = products.map((product) => ({
    url: `${baseUrl}/products/${product.handle}`,
    lastModified: new Date(product.updated_at || Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const collectionUrls = collections.map((collection) => ({
    url: `${baseUrl}/collections/${collection.handle}`,
    lastModified: new Date(collection.updated_at || Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  const policyUrls = policies.map((policy) => ({
    url: `${baseUrl}/policies/${policy.handle}`,
    lastModified: new Date(policy.updatedAt || Date.now()),
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }));

  return [...staticUrls, ...productUrls, ...collectionUrls, ...policyUrls];
}
