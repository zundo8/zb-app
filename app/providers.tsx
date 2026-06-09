"use client";

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
              <Suspense fallback={null}>
                <AppBridgeWrapper>{children}</AppBridgeWrapper>
              </Suspense>
            </RecentlyViewedProvider>
          </BookmarkProvider>
        </CartProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

