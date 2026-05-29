import { fetchCollectionByHandle, fetchEnabledCollections } from "@/lib/shopify-admin";
import { ShopifyProduct } from "@/lib/shopify-admin";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LayoutGrid, Grid3X3, Square } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { notFound } from "next/navigation";

import CollectionHeaderClient from "@/components/CollectionHeaderClient";
import CollectionFilters from "@/components/CollectionFilters";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: { handle: string };
  searchParams: { sort?: string; min?: string; max?: string; size?: string; view?: string };
}) {
  const { collection, products: rawProducts } = await fetchCollectionByHandle(
    params.handle,
    48
  );
  
  const allCollections = await fetchEnabledCollections('page', 'zicabella.com');

  if (!collection) notFound();
 
  const sortBy = searchParams.sort || "featured";
  const minPrice = parseFloat(searchParams.min || "0");
  const maxPrice = parseFloat(searchParams.max || "999999");
  const selectedSize = searchParams.size;
  const viewMode = searchParams.view || "current";

  // Extract all unique sizes from products
  const allSizes = Array.from(new Set(
    rawProducts.flatMap(p => 
      p.variants?.map(v => v.option1) || []
    )
  )).filter((s): s is string => typeof s === "string" && s !== "Default Title" && !s.includes(" / ")); // Simple size extraction

  // Apply filtering
  let products = rawProducts.filter((p) => {
    const price = parseFloat(p.variants?.[0]?.price || "0");
    const matchesPrice = price >= minPrice && price <= maxPrice;
    
    if (!matchesPrice) return false;
    
    return true;
  });

  // Apply sorting
  products = [...products].sort((a, b) => {
    // Primary Sort: selected size availability
    if (selectedSize) {
      const aHasVariant = a.variants?.some(v => v.option1 === selectedSize && (v.inventory_quantity || 0) > 0) ? 1 : 0;
      const bHasVariant = b.variants?.some(v => v.option1 === selectedSize && (v.inventory_quantity || 0) > 0) ? 1 : 0;
      if (aHasVariant !== bHasVariant) {
        return bHasVariant - aHasVariant;
      }
    }
    
    // Secondary Sort: user choice
    if (sortBy === "price-asc") {
      return parseFloat(a.variants?.[0]?.price || "0") - parseFloat(b.variants?.[0]?.price || "0");
    } else if (sortBy === "price-desc") {
      return parseFloat(b.variants?.[0]?.price || "0") - parseFloat(a.variants?.[0]?.price || "0");
    } else if (sortBy === "newest") {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
    
    return 0;
  });

  return (
    <div className="min-h-screen pt-12">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-header">

        {/* Back navigation */}
        <div className="mb-5">
          <CollectionHeaderClient 
            currentHandle={params.handle}
            currentTitle={collection.title}
            allCollections={allCollections}
            currentImage={collection.image?.src}
          />
        </div>

        {/* Minimalist Filter Bar */}
        <CollectionFilters allSizes={allSizes} />

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-heading text-[10px] uppercase tracking-widest text-foreground/25">
              No products found
            </p>
          </div>
        ) : (
          <div className={`grid gap-x-2 md:gap-x-6 gap-y-6 md:gap-y-12 ${
            viewMode === "full" ? "grid-cols-1 md:grid-cols-2" : 
            viewMode === "thumbnail" ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-x-1 md:gap-x-2 gap-y-2 md:gap-y-3" : 
            "grid-cols-2 md:grid-cols-4"
          }`}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} selectedSize={selectedSize} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
