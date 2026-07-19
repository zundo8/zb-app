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
    'graphic-tees': 'Heavyweight Graphic Tees | Premium Streetwear | Zica Bella®',
    'tshirts-under-5000': 'Luxury Streetwear Tees Under ₹5000 | Zica Bella®',
    'oversized-tees': 'Oversized drop-shoulder Tees | Heavyweight Blanks | Zica Bella®',
  };

  const descMap: Record<string, string> = {
    'graphic-tees':
      'Explore India\'s finest heavyweight graphic tees. Crafted with custom-engineered oversized drop-shoulder patterns, premium double-yarn cotton, and high-density vintage prints. Wear with intent.',
    'tshirts-under-5000':
      'Discover premium graphic tees and oversized street fits under ₹5000. Luxury fabric architecture, hand-finished washes, and bold graphics without the luxury markup.',
    'oversized-tees':
      'Boxy drop-shoulder oversized t-shirts engineered from custom heavyweight cotton blanks. The ultimate subculture streetwear essential for men & women.',
  };

  const collectionTitle = collection?.title || params.handle.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const title = titleMap[params.handle] ?? `${collectionTitle} | Luxury Streetwear Drop | Zica Bella®`;
  const description =
    descMap[params.handle] ??
    `Shop the ${collectionTitle} capsule collection at Zica Bella®. Featuring custom relaxed silhouettes, heavyweight premium blanks, and original subculture graphics. Designed in Italy, crafted in India.`;

  const customKeywords = [
    collectionTitle,
    'Zica Bella collections',
    'luxury streetwear India',
    'oversized fit t-shirts',
    'heavyweight hoodies',
    'graphic print apparel',
    'streetwear capsule drop',
    'pre-shrunk cotton blanks',
  ];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zicabella.com';

  return {
    title,
    description,
    keywords: customKeywords.join(', '),
    alternates: {
      canonical: `${siteUrl}/collections/${params.handle}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/collections/${params.handle}`,
      type: 'website',
      images: collection?.image?.src
        ? [{ url: collection.image.src, width: 800, height: 800, alt: collection.title }]
        : [{ url: `${siteUrl}/og-image.jpg`, width: 1200, height: 630, alt: 'Zica Bella®' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: collection?.image?.src ? [collection.image.src] : [`${siteUrl}/og-image.jpg`],
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
