"use client";

import { usePathname } from "next/navigation";
import StorefrontLayout from "@/components/StorefrontLayout";
import { useEffect, useState } from "react";

export default function LayoutWrapper({ 
  children, 
  footer 
}: { 
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/dashboard") || 
                  pathname?.startsWith("/scanner") || 
                  pathname?.startsWith("/portal") || 
                  pathname?.startsWith("/web-store") ||
                  pathname?.startsWith("/unauthorized");
  if (isAdmin) {
    return <>{children}</>;
  }
  return (
    <StorefrontLayout footer={footer}>
      {children}
    </StorefrontLayout>
  );
}
