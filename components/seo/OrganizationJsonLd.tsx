import { JsonLd } from './JsonLd'

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://zicabella.com/#organization',
    name: 'Zica Bella',
    url: 'https://zicabella.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://zicabella.com/logo.png',
      width: 512,
      height: 512,
    },
    description:
      'Zica Bella is an Indian D2C fashion brand crafting premium graphic tees and statement apparel. Crafted in India · Worn with Intent.',
    foundingDate: '2023',
    foundingLocation: {
      '@type': 'Place',
      name: 'Faridabad, Haryana, India',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Faridabad',
      addressRegion: 'Haryana',
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hello@zicabella.com',
      availableLanguage: ['English', 'Hindi'],
    },
    sameAs: [
      'https://www.instagram.com/zicabella',
      'https://www.facebook.com/zicabella',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Zica Bella Apparel Collection',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Product',
            name: 'Graphic Tees',
            category: 'Apparel',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Product',
            name: 'Oversized T-Shirts',
            category: 'Apparel',
          },
        },
      ],
    },
  }

  return <JsonLd data={data} />
}
