import { searchProducts, fetchCollections } from "@/lib/shopify-admin";
import { Search, ArrowRight } from "lucide-react";
import { ShopifyProduct } from "@/lib/shopify-admin";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

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

  const [productsRaw, collections] = await Promise.all([
    query ? searchProducts(query, 48).catch(() => [] as ShopifyProduct[]) : Promise.resolve([] as ShopifyProduct[]),
    fetchCollections().catch(() => [] as any[]),
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

        {/* ── Search Bar ── */}
        <form method="GET" action="/search" className="mb-10 max-w-xl mx-auto">
          <div className="glass-liquid relative flex items-center rounded-2xl overflow-hidden shadow-lg border border-white/5">
            <Search className="absolute left-4 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search Zica Bella…"
              autoFocus={!query}
              autoComplete="off"
              className="w-full pl-11 pr-4 py-4 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
            />
            {query && (
              <Link href="/search" className="absolute right-3 px-2 py-1 text-[8px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
                Clear
              </Link>
            )}
          </div>

          {/* Sort filters */}
          {query && products.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
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
                   className={`px-3.5 py-1.5 rounded-full text-[9px] uppercase tracking-widest transition-all ${
                     sortBy === opt.value
                       ? "bg-white text-black font-bold shadow-md"
                       : "glass-button text-white/50 border border-white/5"
                   }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* ── Results header ── */}
        {query && (
          <div className="flex justify-between items-baseline mb-6 max-w-6xl mx-auto px-1">
            <h1 className="text-[11px] font-medium text-white/60 uppercase tracking-widest">
              &ldquo;{query}&rdquo;
            </h1>
            <p className="text-[9px] text-white/30 uppercase tracking-widest">
              {products.length} {products.length === 1 ? "result" : "results"}
            </p>
          </div>
        )}

        {/* ── Product Grid ── */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 md:gap-x-6 gap-y-8 md:gap-y-12 max-w-6xl mx-auto">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* ── No results ── */}
        {query && products.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="glass-panel w-14 h-14 rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 text-white/20" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-[9px] text-white/20 mt-1.5 uppercase tracking-widest">Try a different term or browse below</p>
            </div>
          </div>
        )}

        {/* ── Empty state — show trending + collections ── */}
        {!query && (
          <div className="max-w-4xl mx-auto mt-6">
            {/* Trending */}
            <div className="mb-10">
              <p className="glass-label mb-3">Trending Searches</p>
              <div className="flex flex-wrap gap-2.5">
                {TRENDING.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="glass-button px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest text-white/60 hover:text-white/90 border border-white/5 shadow-md hover:border-white/10 active:scale-95 transition-all"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            {/* Collections */}
            {collections.length > 0 && (
              <div>
                <p className="glass-label mb-3">Explore Collections</p>
                <div className="flex flex-col gap-0">
                  {collections.slice(0, 10).map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/collections/${c.handle}`}
                      className="group flex items-center justify-between py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span className="text-[13px] font-light uppercase tracking-[0.06em] text-white/50 group-hover:text-white/80 transition-colors">
                        {c.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-white/10 opacity-0 group-hover:opacity-100 group-hover:text-white/40 transition-all transform group-hover:translate-x-1 duration-300" />
                    </Link>
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
