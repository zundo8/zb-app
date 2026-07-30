"use client";

import { usePathname } from "next/navigation";
import StorefrontHeader from "./StorefrontHeader";
import StorefrontNav from "./StorefrontNav";
import { useEffect, useState, Suspense } from "react";
import PageLoader from "./PageLoader";
import Script from "next/script";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  footer: React.ReactNode;
}

export default function StorefrontLayout({ children, footer }: StorefrontLayoutProps) {
  const pathname = usePathname();
  const [collections, setCollections] = useState<any[]>([]);
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    fetch("/api/shopify/collections?location=header")
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
    <div className="liquid-glass-body min-h-[100dvh] max-w-full text-foreground selection:bg-white/10 transition-colors duration-500">
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={null}>
        <PageLoader />
      </Suspense>
      {!isMobileApp && <StorefrontHeader collections={collections} />}
      
      {/* ── Main Content ── */}
      <div className="relative z-10 w-full overflow-x-clip">
        {children}
      </div>

      {/* ── Footer (passed from server) ── */}
      {!isMobileApp && 
        (!mounted || (
          pathname !== "/login" && 
          pathname !== "/chat" && 
          pathname !== "/support" && 
          !pathname.startsWith("/checkout") && 
          !pathname.startsWith("/payment")
        )) && 
        footer}
    </div>
  );
}

