import { JsonLd } from './JsonLd'

interface CollectionJsonLdProps {
  collection: {
    title: string
    slug: string
    description?: string
    products: {
      name: string
      slug: string
      price: number
      image?: string
    }[]
  }
}

export function CollectionJsonLd({ collection }: CollectionJsonLdProps) {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `https://zicabella.com/collections/${collection.slug}`,
      name: collection.title,
      description:
        collection.description ??
        `Shop ${collection.title} at Zica Bella. Crafted in India · Worn with Intent.`,
      url: `https://zicabella.com/collections/${collection.slug}`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://zicabella.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: collection.title,
            item: `https://zicabella.com/collections/${collection.slug}`,
          },
        ],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: collection.title,
      numberOfItems: collection.products.length,
      itemListElement: collection.products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://zicabella.com/products/${p.slug}`,
        name: p.name,
        image: p.image,
      })),
    },
  ]

  return <JsonLd data={data} />
}
