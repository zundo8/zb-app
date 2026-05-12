"use client";

import { useEffect, useState } from "react";
import {
  PackageSearch,
  ExternalLink,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
} from "lucide-react";

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string | null;
  barcode: string | null;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  status: string;
  product_type: string;
  vendor: string;
  tags: string;
  image: { src: string } | null;
  variants: ShopifyVariant[];
}

const SHOPIFY_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com";

export default function ProductsPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [updating, setUpdating] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/products?limit=250");
      const data = await res.json();
      setProducts(data.products || []);
      if (data.error) setError(`Shopify API: ${data.error}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleStatus = async (product: ShopifyProduct) => {
    const newStatus = product.status === "active" ? "draft" : "active";
    setUpdating(product.id);
    try {
      const res = await fetch(`/api/shopify/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, status: newStatus } : p
        )
      );
      showToast(`"${product.title}" set to ${newStatus}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = products
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter(
      (p) =>
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.vendor.toLowerCase().includes(search.toLowerCase()) ||
        p.variants.some((v) =>
          (v.sku || "").toLowerCase().includes(search.toLowerCase())
        )
    );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-foreground/90 dark:bg-background/80 backdrop-blur-xl rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground border border-foreground/[0.05] flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div className="space-y-1">
          <div className="px-2 py-0.5 bg-foreground/[0.03] rounded-md text-[7px] font-normal text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 uppercase tracking-[0.3em] w-fit">inventory hub</div>
          <h1 className="text-lg font-normal text-foreground uppercase tracking-[0.2em] mb-0.5 leading-none mt-1">
            Products
          </h1>
          <p className="text-[9px] text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 font-normal uppercase tracking-[0.2em] mt-1">
            Manage your Shopify spectrum — {products.length} nodes.
          </p>
        </div>
        <button
          onClick={loadProducts}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-foreground/[0.05] rounded-md text-[8px] font-normal uppercase tracking-[0.2em] text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 disabled:opacity-50 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          REFRESH
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10" />
          <input
            className="w-full bg-foreground/[0.02] border border-foreground/[0.05] rounded-md pl-9 pr-4 py-2 text-[10px] font-normal text-foreground placeholder:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10 focus:outline-none focus:border-foreground/10 transition-all uppercase tracking-[0.1em]"
            placeholder="SEARCH SPECTRUM, SKUS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-foreground/[0.02] border border-foreground/[0.03] rounded-md">
          {(["all", "active", "draft"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[8px] font-normal uppercase tracking-[0.2em] transition-all ${
                statusFilter === s
                  ? "bg-foreground text-background shadow-md shadow-foreground/5"
                  : "text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 hover:text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-4 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Product List */}
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="bg-foreground/50 dark:bg-foreground/[0.01] rounded-[1rem] p-12 text-center flex justify-center border border-foreground/[0.02]">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-foreground/50 dark:bg-foreground/[0.01] rounded-[1rem] p-12 text-center border border-foreground/[0.02]">
            <PackageSearch className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight lowercase">No nodes detected</h3>
            <p className="text-[10px] text-muted-foreground/20 mt-1 font-bold uppercase tracking-widest uppercase">
              {search ? "Zero matches in spectrum." : "No nodes in Shopify relay."}
            </p>
          </div>
        ) : (
          filtered.map((product) => {
            const totalStock = product.variants.reduce(
              (acc, v) => acc + (v.inventory_quantity || 0),
              0
            );
            const isUpdating = updating === product.id;
 
            return (
              <div
                key={product.id}
                className="bg-foreground/50 dark:bg-foreground/[0.01] backdrop-blur-3xl rounded-[1rem] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-foreground/[0.02] shadow-sm transition-all"
              >
                {/* Left: Image + Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-foreground/[0.02] border border-foreground/[0.05] flex items-center justify-center shrink-0 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image.src}
                        alt={product.title}
                        className="w-full h-full object-cover rounded-lg grayscale opacity-70"
                      />
                    ) : (
                      <PackageSearch className="w-4 h-4 text-muted-foreground/10" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-normal text-foreground uppercase tracking-[0.1em] lowercase truncate">
                      {product.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 text-[7px] font-normal uppercase tracking-[0.3em]">
                      {product.vendor && (
                        <span className="text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 bg-foreground/[0.02] px-1.5 py-0.5 rounded-[2px] border border-foreground/[0.03]">
                          {product.vendor}
                        </span>
                      )}
                      {product.product_type && (
                        <span className="text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 bg-foreground/[0.02] px-1.5 py-0.5 rounded-[2px] border border-foreground/[0.03]">
                          {product.product_type}
                        </span>
                      )}
                      <span className="text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 bg-foreground/[0.02] px-1.5 py-0.5 rounded-[2px] border border-foreground/[0.03]">
                        {product.variants.length} SKU{product.variants.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
 
                {/* Right: Stats + Actions */}
                <div className="flex items-center gap-4 md:gap-5 shrink-0">
                  <div className="text-center">
                    <p className="text-[7px] text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10 uppercase font-normal tracking-[0.3em] mb-1 leading-none">
                      RELAY
                    </p>
                    <p
                      className={`text-[11px] font-normal tracking-[0.1em] ${
                        totalStock < 10 ? "text-rose-500" : "text-foreground"
                      }`}
                    >
                      {totalStock}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[7px] text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10 uppercase font-normal tracking-[0.3em] mb-1 leading-none">
                      VALUATION
                    </p>
                    <p className="text-[11px] font-normal tracking-[0.1em] text-foreground">
                      ₹{parseFloat(product.variants[0]?.price || "0").toLocaleString("en-IN")}
                    </p>
                  </div>
 
                  {/* Status Toggle */}
                  <button
                    onClick={() => toggleStatus(product)}
                    disabled={isUpdating}
                    title={product.status === "active" ? "Set to Draft" : "Set to Active"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[7px] font-normal uppercase tracking-[0.2em] transition-all disabled:opacity-50 ${
                      product.status === "active"
                        ? "bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/10"
                        : "bg-foreground/[0.04] text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 border border-foreground/[0.05]"
                    }`}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : product.status === "active" ? (
                      <Eye className="w-3 h-3" strokeWidth={1.5} />
                    ) : (
                      <EyeOff className="w-3 h-3" strokeWidth={1.5} />
                    )}
                    {product.status}
                  </button>
 
                  {/* Open in Shopify */}
                  <a
                    href={`https://${SHOPIFY_DOMAIN}/admin/products/${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-foreground/[0.01] border border-foreground/[0.02] rounded-lg transition-all text-muted-foreground/10 hover:text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40"
                    title="Open in Shopify Admin"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
