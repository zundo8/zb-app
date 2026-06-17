import { MetadataRoute } from 'next'
import { fetchProducts, fetchCollections } from '@/lib/shopify-admin'
import prisma from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zicabella.com'

  const [products, collections, policies] = await Promise.all([
    fetchProducts(250).catch(() => []),
    fetchCollections(250).catch(() => []),
    prisma.policy.findMany({ select: { handle: true, updatedAt: true } }).catch(() => [])
  ])

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/collections`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/collections/graphic-tees`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/collections/tshirts-under-5000`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/collections/oversized-tees`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/story`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/blogs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.handle}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  const collectionPages: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${baseUrl}/collections/${c.handle}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  const policyPages: MetadataRoute.Sitemap = policies.map((policy) => ({
    url: `${baseUrl}/policies/${policy.handle}`,
    lastModified: new Date(policy.updatedAt || Date.now()),
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  return [...staticPages, ...productPages, ...collectionPages, ...policyPages]
}
