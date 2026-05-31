import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/checkout/', '/admin/', '/cart/', '/dashboard/', '/portal/', '/unauthorized/'],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'Google-Extended',
          'Anthropic-AI',
          'PerplexityBot',
          'Applebot-Extended'
        ],
        allow: '/',
        disallow: ['/api/', '/checkout/', '/admin/', '/cart/', '/dashboard/', '/portal/', '/unauthorized/'],
      }
    ],
    sitemap: 'https://zicabella.com/sitemap.xml',
  };
}
