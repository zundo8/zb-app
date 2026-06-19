import { searchProducts, fetchCollections, fetchProducts } from "@/lib/shopify-admin";
import { Search } from "lucide-react";
import { ShopifyProduct } from "@/lib/shopify-admin";
import SearchResultsClient from "@/components/SearchResultsClient";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

const TRENDING = ["T-shirt", "Jeans", "Pants", "Trousers", "Jorts", "Shirts", "Acid Tees", "Leather"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; min?: string; max?: string };
}) {
  const query = (searchParams.q || "").trim();
  const sortBy = searchParams.sort || "relevance";
  const minPrice = parseFloat(searchParams.min || "0");
  const maxPrice = parseFloat(searchParams.max || "999999");

  const [productsRaw, collections, trendingProducts] = await Promise.all([
    query ? searchProducts(query, 48).catch(() => [] as ShopifyProduct[]) : Promise.resolve([] as ShopifyProduct[]),
    fetchCollections().catch(() => [] as any[]),
    !query ? fetchProducts(12).catch(() => [] as ShopifyProduct[]) : Promise.resolve([] as ShopifyProduct[]),
  ]);

  let products = productsRaw.filter((p) => {
    const price = parseFloat(p.variants?.[0]?.price || "0");
    return price >= minPrice && price <= maxPrice;
  });

  if (sortBy === "price-asc") {
    products.sort((a, b) => parseFloat(a.variants?.[0]?.price || "0") - parseFloat(b.variants?.[0]?.price || "0"));
  } else if (sortBy === "price-desc") {
    products.sort((a, b) => parseFloat(b.variants?.[0]?.price || "0") - parseFloat(a.variants?.[0]?.price || "0"));
  }

  return (
    <div className="min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-28">

        {/* ── Search Bar Area ── */}
        <form method="GET" action="/search" className="mb-12 max-w-xl mx-auto">
          <div className="glass-liquid relative flex items-center rounded-2xl overflow-hidden shadow-md border border-foreground/[0.08] focus-within:border-foreground/25 focus-within:shadow-xl hover:border-foreground/15 transition-all duration-300">
            <Search className="absolute left-5 w-4 h-4 text-foreground/35 pointer-events-none transition-colors" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search Zica Bella…"
              autoFocus={!query}
              autoComplete="off"
              className="w-full pl-12 pr-16 py-[18px] bg-transparent text-sm text-foreground placeholder-foreground/30 focus:outline-none font-light tracking-wide"
            />
            {query && (
              <Link 
                href="/search" 
                className="absolute right-4 px-3 py-1.5 text-[8.5px] uppercase tracking-widest font-semibold text-foreground/45 hover:text-foreground/85 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] hover:bg-foreground/[0.08] active:scale-95 transition-all"
              >
                Clear
              </Link>
            )}
          </div>

          {/* Sort filters */}
          {query && products.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap justify-center animate-fade-up">
              {[
                { label: "Relevance", value: "relevance" },
                { label: "Price ↑",   value: "price-asc" },
                { label: "Price ↓",   value: "price-desc" },
              ].map((opt) => (
                <button
                   key={opt.value}
                   type="submit"
                   name="sort"
                   value={opt.value}
                   className={`px-4 py-1.5 rounded-full text-[8.5px] uppercase tracking-widest transition-all duration-200 active:scale-95 ${
                     sortBy === opt.value
                       ? "bg-foreground text-background font-bold shadow-md"
                       : "glass-button text-foreground/45 border border-foreground/5 hover:border-foreground/15 hover:text-foreground/75"
                   }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* ── Product List Section ── */}
        {products.length > 0 ? (
          <SearchResultsClient products={products} query={query} />
        ) : query ? (
          /* ── No results ── */
          <div className="text-center py-24 flex flex-col items-center gap-5 animate-fade-up">
            <div className="glass-panel w-16 h-16 rounded-full flex items-center justify-center border border-foreground/5 shadow-md">
              <Search className="w-5 h-5 text-foreground/20" />
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-foreground/45">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-[8.5px] sm:text-[9.5px] text-foreground/20 mt-1.5 uppercase tracking-widest">Try a different term or browse below</p>
            </div>
          </div>
        ) : null}

        {/* ── Empty state — show trending + collections + products ── */}
        {!query && (
          <div className="max-w-4xl mx-auto mt-6 animate-fade-up">
            {/* 1. Trending Searches */}
            <div className="mb-14 text-center md:text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-4">Trending Searches</p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {TRENDING.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="glass-button px-5 py-2.5 rounded-full text-[8.5px] uppercase tracking-widest text-foreground/55 hover:text-foreground border border-foreground/5 shadow-sm hover:border-foreground/12 active:scale-95 transition-all duration-200 hover:bg-foreground/[0.01]"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            {/* 2. Explore Collections Media Grid/Slider */}
            {collections.length > 0 && (
              <div className="mb-14">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-4 pl-1">Explore Collections</p>
                <div className="flex overflow-x-auto gap-2.5 pb-4 px-1 snap-x hide-scrollbar scroll-smooth">
                  {collections.filter(c => c.image?.src).slice(0, 8).map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/collections/${c.handle}`}
                      className="group relative min-w-[200px] sm:min-w-[240px] aspect-[4/3] rounded-2xl overflow-hidden border border-foreground/[0.04] bg-foreground/[0.02] shadow-sm hover:shadow-md snap-start transition-all duration-500"
                    >
                      <Image
                        src={c.image?.src}
                        alt={c.title}
                        fill
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                        sizes="(max-width: 768px) 250px, 350px"
                      />
                      {/* Dark Overlay with Liquid Text */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent flex flex-col justify-end p-4">
                        <span className="text-[8px] font-mono font-light text-white/40 tracking-[0.22em] uppercase mb-0.5">
                          Collection
                        </span>
                        <h4 className="text-[10.5px] sm:text-xs font-light uppercase tracking-widest text-white">
                          {c.title}
                        </h4>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 3. New Arrivals (Product Grid) */}
            {trendingProducts.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/30 mb-4 pl-1">New Arrivals</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[3px] px-[2px] md:px-0">
                  {trendingProducts.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
