import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import StorefrontFooter from "@/components/StorefrontFooter";
import { Toaster } from "sonner";

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
  title: "Zica Bella",
  description: "Premium luxury streetwear. Redefining the standard.",
  icons: {
    icon: "/zica-bella-logo_8.png",
    apple: "/zica-bella-logo_8.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zica Bella",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${geistSans.variable} ${inter.variable} antialiased`}>
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
