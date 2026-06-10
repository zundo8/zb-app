import { fetchCollectionByHandle, fetchEnabledCollections } from "@/lib/shopify-admin";
import { ShopifyProduct } from "@/lib/shopify-admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";

import CollectionHeaderClient from "@/components/CollectionHeaderClient";
import CollectionFilters from "@/components/CollectionFilters";
import CollectionProductGrid from "@/components/CollectionProductGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const { collection } = await fetchCollectionByHandle(params.handle, 1).catch(() => ({ collection: null }));
  if (!collection) {
    return {
      title: "Collection Not Found - Zica Bella",
    };
  }

  const title = `${collection.title} Collection | Premium Streetwear - Zica Bella`;
  const plainDesc = collection.body_html
    ? collection.body_html.replace(/<[^>]*>/g, '').slice(0, 160) + '...'
    : `Explore the exclusive ${collection.title} series at Zica Bella. India's #1 premium luxury streetwear label and fastest growing fashion app.`;

  const image = collection.image?.src || "/zb-logo-220px.png";

  return {
    title,
    description: plainDesc,
    keywords: `${collection.title}, streetwear collection, zica bella, premium apparel, limited capsule drop`,
    openGraph: {
      title,
      description: plainDesc,
      type: "website",
      url: `https://zicabella.com/collections/${collection.handle}`,
      images: [
        {
          url: image,
          alt: collection.title,
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: plainDesc,
      images: [image],
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": collection.title,
            "url": `https://zicabella.com/collections/${collection.handle}`,
            "description": collection.body_html ? collection.body_html.replace(/<[^>]*>/g, '') : `Shop the ${collection.title} collection at Zica Bella.`,
            "image": collection.image?.src || "https://zicabella.com/zb-logo-220px.png",
            "mainEntity": {
              "@type": "ItemList",
              "itemListElement": products.map((product, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "url": `https://zicabella.com/products/${product.handle}`,
                "name": product.title,
                "image": product.images?.[0]?.src || product.image?.src || "https://zicabella.com/zb-logo-220px.png"
              }))
            }
          })
        }}
      />
      <div className="min-h-screen pt-12">
        {/* Header & Filters — contained width */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-header">
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
        <div className="relative z-10 w-full pb-32">
          <CollectionProductGrid
            products={products}
            viewMode={viewMode}
            selectedSize={selectedSize}
          />
        </div>
      </div>
    </>
  );
}
