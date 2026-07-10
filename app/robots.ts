import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.zicabella.com';
  const disallowedPaths = [
    '/api/',
    '/dashboard/',
    '/web-store/',
    '/portal/',
    '/profile/',
    '/orders/',
    '/wishlist/',
    '/checkout/',
    '/cart',
    '/login',
    '/unauthorized',
    '/_next/',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowedPaths,
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'PerplexityBot',
          'Applebot',
          'Amazonbot',
          'cohere-ai',
          'Google-Extended',
          'Googlebot',
          'Bingbot',
          'OAI-SearchBot', // OpenAI SearchBot for SearchGPT/AEO search
          'facebookexternalhit',
        ],
        allow: [
          '/',
          '/products/',
          '/collections/',
          '/search',
          '/blogs/',
          '/story',
          '/faq',
          '/policies/',
        ],
        disallow: disallowedPaths,
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
