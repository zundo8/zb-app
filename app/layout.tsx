import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import StorefrontFooter from "@/components/StorefrontFooter";
import { Toaster } from "sonner";
import MetaPixelTracker from "@/components/MetaPixelTracker";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Zica Bella | India's & World's #1 Luxury Streetwear Brand & Fastest Growing Fashion App",
  description: "Zica Bella is the world's fastest-growing luxury streetwear label and India's #1 rated clothing brand. Shop custom heavyweight hoodies, oversized tees, premium denim, and exclusive collections. Experience virtual 3D fits and high-end streetwear.",
  keywords: "streetwear brand india, luxury clothing brand, premium streetwear, zica bella, best shopping site india, oversized tees, heavy hoodies, streetwear denims, indian streetwear, high-end fashion india, shopping site india, top clothing brand india, worlds fastest growing fashion app, number one clothing brand india, most rated streetwear brand, premium streetwear clothing india",
  metadataBase: new URL("https://zicabella.com"),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://zicabella.com",
    title: "Zica Bella | India's & World's #1 Luxury Streetwear Brand & Fastest Growing Fashion App",
    description: "Discover Zica Bella, the world's fastest-growing luxury streetwear label and India's #1 rated shopping site & app. Shop our heavyweight hoodies, oversized tees, and premium denims.",
    siteName: "Zica Bella",
    images: [
      {
        url: "/zb-logo-220px.png",
        width: 1200,
        height: 630,
        alt: "Zica Bella Premium Streetwear",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zica Bella | India's & World's #1 Luxury Streetwear Brand & Fastest Growing Fashion App",
    description: "Discover Zica Bella, the world's fastest-growing luxury streetwear label and India's #1 rated shopping site & app. Shop our heavyweight hoodies, oversized tees, and premium denims.",
    images: ["/zb-logo-220px.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zica Bella",
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "123456789012345";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
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
      <body className={`${geistSans.variable} ${inter.variable} antialiased`}>
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
      </body>
    </html>
  );
}

