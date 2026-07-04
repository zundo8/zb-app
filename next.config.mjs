/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    loader: 'custom',
    loaderFile: './lib/shopify-image-loader.js',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: '8tiahf-bk.myshopify.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'db.zicabella.com',
      }
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Immutable caching for static assets
        source: '/:path*.(jpg|jpeg|png|webp|avif|svg|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // NOTE: CORS for /api/app/payment/* and /api/razorpay/* is now handled
      // dynamically in each route handler via lib/cors.ts (origin allow-list)
      // instead of static wildcard headers here.
      {
        // HSTS — force HTTPS for 2 years
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // CSP for public storefront routes
        source: '/((?:blogs|cart|chat|checkout|collaborations|collections|community|faq|login|orders|policies|portal|products|profile|search|story|support|unauthorized|web-store|wishlist)(?:/.*)?|$)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com https://ajax.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com",
              "img-src 'self' data: blob: https://cdn.shopify.com https://*.supabase.co https://images.unsplash.com https://www.facebook.com https://www.google-analytics.com https://www.googletagmanager.com https://flagcdn.com https://db.zicabella.com",
              "connect-src 'self' https://*.supabase.co https://cdn.shopify.com https://api.razorpay.com https://lux.razorpay.com https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com wss://*.pusher.com https://sockjs.pusher.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com",
              "media-src 'self' blob: https://*.supabase.co https://cdn.shopify.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
      {
        // CSP for admin dashboard routes
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com; img-src 'self' data: blob: https://cdn.shopify.com https://*.supabase.co https://images.unsplash.com https://www.facebook.com; connect-src 'self' https://*.supabase.co https://cdn.shopify.com https://api.razorpay.com https://connect.facebook.net https://www.facebook.com; frame-src 'self' https://api.razorpay.com;",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/shop',
        destination: '/collections',
        permanent: true,
      },
      {
        source: '/products',
        destination: '/collections',
        permanent: true,
      },
      {
        source: '/graphic-tees',
        destination: '/collections/graphic-tees',
        permanent: true,
      },
      {
        source: '/tshirts-under-5000',
        destination: '/collections/tshirts-under-5000',
        permanent: true,
      },
    ];
  }
};

export default nextConfig;
