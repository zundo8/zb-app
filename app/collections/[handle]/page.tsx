import { fetchCollectionByHandle, fetchEnabledCollections } from "@/lib/shopify-admin";
import { ShopifyProduct } from "@/lib/shopify-admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";

import CollectionHeaderClient from "@/components/CollectionHeaderClient";
import CollectionFilters from "@/components/CollectionFilters";
import CollectionProductGrid from "@/components/CollectionProductGrid";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { CategorySEOContent } from "@/components/seo/CategorySEOContent";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateMetadata({
  params,
}: {
  params: { handle: string }
}): Promise<Metadata> {
  const { collection } = await fetchCollectionByHandle(params.handle, 1).catch(() => ({ collection: null }));

  const titleMap: Record<string, string> = {
    'graphic-tees': 'Best Graphic Tees in India | Zica Bella',
    'tshirts-under-5000': 'Best T-Shirts Under ₹5000 | Zica Bella',
    'oversized-tees': 'Oversized T-Shirts for Men & Women | Zica Bella',
  };

  const descMap: Record<string, string> = {
    'graphic-tees':
      'Shop the best graphic tees in India. Premium prints, ethically crafted, starting at ₹799. Free shipping above ₹999.',
    'tshirts-under-5000':
      'Discover the best t-shirts under ₹5000 in India. Zica Bella graphic tees, oversized fits, and statement fashion — all under budget.',
    'oversized-tees':
      'Oversized t-shirts for men and women. Crafted in India with premium cotton and bold graphics.',
  };

  const title = titleMap[params.handle] ?? `${collection?.title ?? params.handle} | Zica Bella`;
  const description =
    descMap[params.handle] ??
    `Shop ${collection?.title ?? params.handle} at Zica Bella. Crafted in India · Worn with Intent.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://zicabella.com/collections/${params.handle}`,
    },
    openGraph: {
      title,
      description,
      url: `https://zicabella.com/collections/${params.handle}`,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Zica Bella' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpg'],
    },
  };
}

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
  
  const allCollections = await fetchEnabledCollections('page');

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

  const collectionLdData = {
    title: collection.title,
    slug: collection.handle,
    description: collection.body_html ? collection.body_html.replace(/<[^>]*>/g, '') : undefined,
    products: products.map(p => ({
      name: p.title,
      slug: p.handle,
      price: parseFloat(p.variants?.[0]?.price || "0"),
      image: p.images?.[0]?.src || p.image?.src || undefined
    }))
  };

  return (
    <>
      <CollectionJsonLd collection={collectionLdData} />
      <div className="min-h-screen pt-12">
        {/* Header & Filters — contained width */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-header">
          {/* Visual Breadcrumb */}
          <div className="mb-4">
            <Breadcrumb
              items={[
                { name: 'Home', url: '/' },
                { name: 'Collections', url: '/collections' },
                { name: collection.title, url: `/collections/${collection.handle}` },
              ]}
            />
          </div>

          {/* Collection selector */}
          <div className="mb-4">
            <CollectionHeaderClient 
              currentHandle={params.handle}
              currentTitle={collection.title}
              allCollections={allCollections}
              currentImage={collection.image?.src}
            />
          </div>

          {/* Minimalist Filter Bar */}
          <CollectionFilters allSizes={allSizes} />
        </div>

        {/* Product Grid — edge-to-edge, minimal gaps */}
        <div className="relative z-10 w-full pb-16">
          <CollectionProductGrid
            products={products}
            viewMode={viewMode}
            selectedSize={selectedSize}
          />
        </div>

        {/* GEO/SEO content block */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 text-foreground">
          <CategorySEOContent slug={params.handle as any} />
        </div>
      </div>
    </>
  );
}
