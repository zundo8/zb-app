import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import StorefrontFooter from "@/components/StorefrontFooter";
import { Toaster } from "sonner";
import MetaPixelTracker from "@/components/MetaPixelTracker";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";
import { WebsiteJsonLd } from "@/components/seo/WebsiteJsonLd";
import { Analytics } from "@/components/seo/Analytics";

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
  metadataBase: new URL('https://zicabella.com'),
  title: {
    default: 'Zica Bella — Crafted in India · Worn with Intent',
    template: '%s | Zica Bella',
  },
  description:
    'Shop premium Indian graphic tees, oversized t-shirts, and statement fashion under ₹5000. Crafted in India, worn with intent. Free shipping above ₹999.',
  keywords: [
    'graphic tees India',
    'best t-shirts under 5000',
    'Indian fashion brand',
    'oversized tees online',
    'premium tshirts India',
    'Zica Bella',
    'D2C fashion India',
    'graphic tshirts under 5k',
    'buy graphic tees online India',
    'crafted in India fashion',
  ],
  authors: [{ name: 'Zica Bella', url: 'https://zicabella.com' }],
  creator: 'Zica Bella',
  publisher: 'Zica Bella',
  category: 'Fashion & Apparel',
  classification: 'D2C Fashion, Indian Apparel, Graphic Tees',
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
    url: 'https://zicabella.com',
    siteName: 'Zica Bella',
    title: 'Zica Bella — Crafted in India · Worn with Intent',
    description:
      'Premium Indian graphic tees and fashion under ₹5000. Free shipping above ₹999.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Zica Bella — Crafted in India · Worn with Intent',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zica Bella — Crafted in India · Worn with Intent',
    description: 'Premium Indian graphic tees and fashion under ₹5000.',
    images: ['/og-image.jpg'],
    creator: '@zicabella',
    site: '@zicabella',
  },
  alternates: {
    canonical: 'https://zicabella.com',
    languages: {
      'en-IN': 'https://zicabella.com',
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
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '',
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Zica Bella',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "952984294212398";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <link rel="preconnect" href="https://flagcdn.com" />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
          strategy="afterInteractive"
        />
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
              "description": "Zica Bella is India's and the world's number one premium luxury streetwear clothing brand, top rated shopping site, and fastest growing fashion app, specializing in heavyweight hoodies, custom oversized graphic tees, and streetwear denims.",
              "telephone": "+91-9999999999",
              "priceRange": "₹₹₹",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "New Delhi",
                "addressRegion": "Delhi",
                "postalCode": "110001",
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
      </head>
      <body className={`${geistSans.variable} ${inter.variable} ${poppins.variable} antialiased`}>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <NavigationProgress />
        {/* Meta Pixel Script */}
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
        <MetaPixelTracker />
        <Providers>
          <LayoutWrapper footer={<StorefrontFooter />}>
            {children}
            <Toaster position="top-right" richColors />
          </LayoutWrapper>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

