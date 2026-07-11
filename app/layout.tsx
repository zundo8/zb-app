import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import StorefrontFooter from "@/components/StorefrontFooter";
import { Toaster } from "sonner";
import MetaPixelRouteTracker from "@/components/MetaPixelRouteTracker";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";
import { WebsiteJsonLd } from "@/components/seo/WebsiteJsonLd";
import { Analytics } from "@/components/seo/Analytics";
import "@/lib/auth/env-check";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

/* ISR/SSG enabled — force-dynamic removed from root layout.
   Only truly dynamic pages (checkout, cart, search) set their own dynamic mode. */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com'),
  title: {
    default: 'Zica Bella® | Premium Streetwear, Heavyweight Hoodies & Oversized Tees',
    template: '%s | Zica Bella® — Luxury Indian Streetwear',
  },
  description:
    'India\'s premier luxury streetwear label. Discover boxy drop-shoulder oversized graphic tees, vintage acid-wash shirts, custom heavyweight loopback hoodies, and limited drop capsules. Engineered with premium double-yarn cotton blanks. Crafted in India, worn with intent. Free shipping above ₹999.',
  keywords: [
    'Zica Bella',
    'luxury streetwear India',
    'premium graphic tees India',
    'heavyweight oversized tshirts',
    'best tshirts under 5000',
    'drop shoulder tees online',
    'vintage acid wash t-shirt',
    'loopback cotton hoodies',
    'd2c fashion brand India',
    'subculture street apparel',
    'boxy fit graphic tees',
    'limited edition streetwear drops',
    'crafted in India clothing',
    'aesthetic oversized hoodies',
    'Indian streetwear design',
  ],
  authors: [{ name: 'Zica Bella', url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com' }],
  creator: 'Zica Bella',
  publisher: 'Zica Bella',
  category: 'Fashion & Apparel',
  classification: 'Luxury Streetwear, Indian Apparel, Heavyweight Blanks, Graphic Tees',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com',
    siteName: 'Zica Bella',
    title: 'Zica Bella® | Premium Streetwear & Heavyweight Graphic Tees',
    description:
      'India\'s premier luxury streetwear label. Shop custom boxy oversized t-shirts, vintage acid-wash drop shoulder tees, and premium loopback hoodies. Crafted in India, worn with intent.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Zica Bella® | Premium Streetwear & Heavyweight Graphic Tees',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zica Bella® | Premium Streetwear & Heavyweight Graphic Tees',
    description: 'India\'s premier luxury streetwear label. Shop custom boxy oversized t-shirts, vintage acid-wash drop shoulder tees, and premium loopback hoodies. Crafted in India, worn with intent.',
    images: ['/og-image.jpg'],
    creator: '@zicabella',
    site: '@zicabella',
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com',
    languages: {
      'en-IN': process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com',
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '_0vcMoBD8FO-9t-J7QtmUyFLYy9XzlhOe9GEsUMAq0g',
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '853916BB78BEBC665721D645159AD1E3',
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Zica Bella®',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "2049977412558608";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TDGKF386";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <link rel="preconnect" href="https://flagcdn.com" />
        <link rel="preconnect" href="https://db.zicabella.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ClothingStore",
              "name": "Zica Bella",
              "url": "https://zicabella.com",
              "logo": "https://zicabella.com/zb-logo-220px.png",
              "image": "https://zicabella.com/zb-logo-220px.png",
              "description": "Zica Bella is a leading premium luxury streetwear label, redefining street culture through custom heavyweight cotton hoodies, oversized graphic tees, and streetwear denims. Designed in Italy and crafted in India with modular silhouettes.",
              "telephone": "+91-9220385011",
              "priceRange": "₹₹₹",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Noida",
                "addressRegion": "Uttar Pradesh",
                "postalCode": "201305",
                "addressCountry": "IN"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "5420"
              },
              "sameAs": [
                "https://www.instagram.com/zica.bella",
                "https://www.youtube.com/@Zicabella"
              ],
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://zicabella.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        <Script id="fb-pixel" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/dashboard') && !window.location.pathname.startsWith('/admin')) {
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('set', 'autoConfig', false, '${pixelId}');
              fbq('init', '${pixelId}');
            }
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${inter.variable} ${poppins.variable} antialiased`}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <NavigationProgress />
        <Providers>
          <MetaPixelRouteTracker />
          <LayoutWrapper footer={<StorefrontFooter />}>
            {children}
          </LayoutWrapper>
          <Toaster position="top-right" />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

