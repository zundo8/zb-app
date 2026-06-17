import { JsonLd } from './JsonLd'

interface ProductJsonLdProps {
  product: {
    id: string
    name: string
    description: string
    price: number
    compareAtPrice?: number
    currency?: string
    images: { url: string; alt?: string }[]
    slug: string
    sku?: string
    inStock: boolean
    brand?: string
    category?: string
    rating?: { value: number; count: number }
  }
}

export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://zicabella.com/products/${product.slug}`,
    name: product.name,
    description: product.description,
    sku: product.sku ?? product.id,
    brand: {
      '@type': 'Brand',
      name: product.brand ?? 'Zica Bella',
      logo: 'https://zicabella.com/logo.png',
    },
    category: product.category ?? 'Apparel > Tops > T-Shirts',
    countryOfOrigin: 'IN',
    manufacturer: {
      '@type': 'Organization',
      name: 'Zica Bella',
      url: 'https://zicabella.com',
    },
    image: product.images.map((img) => img.url),
    url: `https://zicabella.com/products/${product.slug}`,
    offers: {
      '@type': 'Offer',
      url: `https://zicabella.com/products/${product.slug}`,
      priceCurrency: product.currency ?? 'INR',
      price: product.price.toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Zica Bella',
        url: 'https://zicabella.com',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'INR',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 3,
            maxValue: 7,
            unitCode: 'DAY',
          },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory:
          'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      ...(product.compareAtPrice && {
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: product.compareAtPrice.toFixed(2),
          priceCurrency: product.currency ?? 'INR',
          priceType: 'https://schema.org/ListPrice',
        },
      }),
    },
    ...(product.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.value,
        reviewCount: product.rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  }

  return <JsonLd data={data} />
}
