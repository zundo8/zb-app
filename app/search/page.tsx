import { searchProducts, fetchCollections, fetchProducts } from "@/lib/shopify-admin";
import { ShopifyProduct } from "@/lib/shopify-admin";
import SearchResultsClient from "@/components/SearchResultsClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<Metadata> {
  const query = (searchParams.q || "").trim();
  return {
    title: query ? `Search: "${query}" | Zica Bella` : "Search Products | Zica Bella",
    description: query
      ? `Find products matching "${query}" on Zica Bella. Browse our premium graphic tees, streetwear, and designer apparel.`
      : "Search the Zica Bella catalog. Explore premium graphic t-shirts, oversized collections, and luxury Indian streetwear.",
    alternates: {
      canonical: query
        ? `https://zicabella.com/search?q=${encodeURIComponent(query)}`
        : "https://zicabella.com/search",
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; min?: string; max?: string };
}) {
  const query = (searchParams.q || "").trim();
  const sortBy = searchParams.sort || "relevance";
  const minPrice = parseFloat(searchParams.min || "0");
  const maxPrice = parseFloat(searchParams.max || "999999");

  // Fetch collections and trending products unconditionally to support empty states and editorial fallback
  const [productsRaw, collections, trendingProducts] = await Promise.all([
    query ? searchProducts(query, 48).catch(() => [] as ShopifyProduct[]) : Promise.resolve([] as ShopifyProduct[]),
    fetchCollections().catch(() => [] as any[]),
    fetchProducts(24).catch(() => [] as ShopifyProduct[]),
  ]);

  // Filter raw products by price range if specified
  const products = productsRaw.filter((p) => {
    const price = parseFloat(p.variants?.[0]?.price || "0");
    return price >= minPrice && price <= maxPrice;
  });

  return (
    <div className="min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-32 pt-28">
        <SearchResultsClient
          initialProducts={products}
          query={query}
          collections={collections}
          trendingProducts={trendingProducts}
          initialSortBy={sortBy}
        />
      </div>
    </div>
  );
}
