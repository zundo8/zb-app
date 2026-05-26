"use client";

import { usePathname } from "next/navigation";
import StorefrontHeader from "./StorefrontHeader";
import StorefrontNav from "./StorefrontNav";
import { useEffect, useState, Suspense } from "react";
import PageLoader from "./PageLoader";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  footer: React.ReactNode;
}

export default function StorefrontLayout({ children, footer }: StorefrontLayoutProps) {
  const pathname = usePathname();
  const [collections, setCollections] = useState<any[]>([]);
  const [isMobileApp, setIsMobileApp] = useState(false);
  
  useEffect(() => {
    fetch("/api/shopify/collections?usage=header")
      .then(res => res.json())
      .then(data => setCollections(data))
      .catch(err => console.error("Error fetching collections for header:", err));

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('platform') === 'mobile' || params.get('app') === 'true') {
        setIsMobileApp(true);
      }
    }
  }, []);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-background text-foreground selection:bg-foreground/10 transition-colors duration-500">
      <Suspense fallback={null}>
        <PageLoader />
      </Suspense>
      {!isMobileApp && <StorefrontHeader collections={collections} />}
      
      {/* ── Main Content ── */}
      <div className="relative z-10 w-full overflow-x-hidden">
        {children}
      </div>

      {/* ── Footer (passed from server) ── */}
      {!isMobileApp && pathname !== "/login" && pathname !== "/chat" && footer}

      {/* ── Shared Bottom Nav ── */}
      {!isMobileApp && <StorefrontNav />}
    </div>
  );
}
