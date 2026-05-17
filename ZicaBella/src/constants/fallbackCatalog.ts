import { FlatCollection, FlatProduct } from '../api/types';

const ringItems = [
  {
    id: 'fallback-skull-ring',
    handle: 'skull-ring',
    title: 'SKULL RING',
    price: '1999',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/3_795c067c-1ce0-44f1-b2b7-50b040d221b5.png?v=1773745987',
  },
  {
    id: 'fallback-blue-eye',
    handle: 'blue-eye-ring',
    title: 'BLUE EYE',
    price: '2888',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/8.png?v=1773745988',
  },
  {
    id: 'fallback-turtle-ring',
    handle: 'turtle-ring',
    title: 'TURTLE RING',
    price: '3888',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/1_9f112c18-771a-44df-981c-83ad5bb27768.png?v=1773745990',
  },
  {
    id: 'fallback-lion-ring',
    handle: 'lion-ring',
    title: 'LION RING',
    price: '2444',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/4_e7d69eee-1a44-44c1-871d-7cfdd95e2570.png?v=1773745991',
  },
  {
    id: 'fallback-king-ring',
    handle: 'king-ring',
    title: 'KING RING',
    price: '3666',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/2_cde64453-b62d-4a59-becf-f3b0ee83d547.png?v=1773745991',
  },
  {
    id: 'fallback-blue-stone',
    handle: 'blue-stone-ring',
    title: 'BLUE STONE',
    price: '1888',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/7.png?v=1773745984',
  },
  {
    id: 'fallback-stone-ring',
    handle: 'stone-ring',
    title: 'STONE RING',
    price: '2666',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/5_f8b10d9e-cb91-4825-8179-aaf65ac16bf0.png?v=1773745985',
  },
  {
    id: 'fallback-wolf-pack',
    handle: 'wolf-pack-ring',
    title: 'WOLF PACK',
    price: '2333',
    image: 'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/6_a3b9dd50-fb4a-4b8e-835a-bc4c27b90969.png?v=1773745982',
  },
] as const;

export const fallbackProducts: FlatProduct[] = ringItems.map((item) => ({
  id: item.id,
  title: item.title,
  handle: item.handle,
  productType: 'Accessories',
  description: 'Signature Zica Bella accessory with a sculptural silhouette and premium finish.',
  availableForSale: true,
  featuredImage: item.image,
  images: [item.image],
  price: item.price,
  compareAtPrice: null,
  variants: [
    {
      id: `${item.id}-variant`,
      title: 'Default',
      availableForSale: true,
      quantityAvailable: null,
      price: item.price,
      compareAtPrice: null,
      size: 'OS',
      color: 'Silver',
    },
  ],
  isSoldOut: false,
  isOnSale: false,
  allMedia: [
    {
      mediaContentType: 'IMAGE',
      image: {
        url: item.image,
        altText: item.title,
      },
      alt: item.title,
    },
  ],
  details: 'Polished premium accessory.',
  care: 'Keep dry and store in a soft pouch.',
  sizeChart: undefined,
  productVideo: undefined,
}));

export const fallbackCollections: FlatCollection[] = [
  {
    id: 'fallback-accessories',
    title: 'Accessories',
    handle: 'accessories',
    description: 'Signature rings and accessories.',
    image: fallbackProducts[0]?.featuredImage || null,
  },
];
