"use client";

import { AppProvider as PolarisProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { ThemeProvider } from '../components/ThemeProvider';
import { CartProvider } from '../lib/cart-context';

import { BookmarkProvider } from '../lib/bookmark-context';
import { RecentlyViewedProvider } from '../lib/recently-viewed-context';
import { SessionProvider } from "next-auth/react";

function AppBridgeWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    searchParams.get('host');
  }, [searchParams]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/dashboard") || pathname?.startsWith("/scanner") || pathname?.startsWith("/portal") || pathname?.startsWith("/web-store");

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={true}
      >
        <CartProvider>
          <BookmarkProvider>
            <RecentlyViewedProvider>
              <PolarisProvider i18n={enTranslations}>
                <Suspense fallback={null}>
                  <AppBridgeWrapper>{children}</AppBridgeWrapper>
                </Suspense>
              </PolarisProvider>
            </RecentlyViewedProvider>
          </BookmarkProvider>
        </CartProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

