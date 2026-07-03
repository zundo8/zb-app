import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zica Bella — Crafted in India · Worn with Intent',
    short_name: 'Zica Bella',
    description:
      'Shop premium graphic tees and fashion under ₹5000. Crafted in India.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait',
    categories: ['shopping', 'fashion', 'lifestyle'],
    lang: 'en-IN',
    dir: 'ltr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ] as any[],
    screenshots: [
      {
        src: '/screenshot-home.jpg',
        sizes: '1280x720',
        type: 'image/jpeg',
        label: 'Zica Bella Home',
      },
    ] as any[],
    shortcuts: [
      {
        name: 'Graphic Tees',
        url: '/collections/graphic-tees',
        description: 'Shop graphic tees',
      },
      {
        name: 'Tees Under ₹5000',
        url: '/collections/tshirts-under-5000',
        description: 'Best tees under ₹5000',
      },
    ],
  }
}
