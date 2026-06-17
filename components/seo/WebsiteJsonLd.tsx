import { JsonLd } from './JsonLd'

export function WebsiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://zicabella.com/#website',
    name: 'Zica Bella',
    url: 'https://zicabella.com',
    description:
      'Premium Indian D2C fashion brand. Graphic tees, oversized fits, and statement apparel crafted in India.',
    inLanguage: 'en-IN',
    publisher: {
      '@id': 'https://zicabella.com/#organization',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://zicabella.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return <JsonLd data={data} />
}
