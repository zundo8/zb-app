"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  LayoutGrid,
  Info,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  SlidersHorizontal,
  FolderHeart,
  Eye,
  Check,
  AlertTriangle,
  Move,
  ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import NextImage from "next/image";

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
  created_at: string;
  updated_at: string;
  image: { src: string } | null;
  images: { id: number; src: string }[];
  variants: ShopifyVariant[];
}

interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
}

export default function HomepageProductsCMS() {
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings states
  const [sourceMode, setSourceMode] = useState<"collection" | "products">("products");
  const [selectedCollectionHandle, setSelectedCollectionHandle] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<ShopifyProduct[]>([]);

  // Collections & Catalog database
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ShopifyProduct[]>([]);

  // Filters for Catalog Picker
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"title" | "price" | "created">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Load shop settings, collections, and catalog
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch settings
      const settingsRes = await fetch("/api/admin/settings");
      if (!settingsRes.ok) throw new Error("Failed to load storefront settings");
      const settings = await settingsRes.json();

      // 2. Fetch all collections for selection lists
      const collectionsRes = await fetch("/api/shopify/collections?all=true");
      if (collectionsRes.ok) {
        const cols = await collectionsRes.json();
        setCollections(cols || []);
      }

      // 3. Fetch catalog products (limit 250 for fast client-side performance)
      const catalogRes = await fetch("/api/shopify/products?pageSize=250");
      if (!catalogRes.ok) throw new Error("Failed to fetch Shopify catalog products");
      const catalogData = await catalogRes.json();
      const allProducts: ShopifyProduct[] = catalogData.products || [];
      setCatalogProducts(allProducts);

      // Determine initial source mode
      const isCollectionMode = !!settings.homepageCollection && !settings.homepageProducts;
      setSourceMode(isCollectionMode ? "collection" : "products");
      setSelectedCollectionHandle(settings.homepageCollection || "");

      // Resolve selected products details by order
      const homepageProductsStr = settings.homepageProducts || "";
      const selectedIds = homepageProductsStr
        .split(",")
        .map((id: string) => id.trim())
        .filter(Boolean);

      if (selectedIds.length > 0) {
        const resolved: ShopifyProduct[] = [];
        const missingIds: string[] = [];

        // Try resolving from fetched catalog first to avoid redundant API calls
        selectedIds.forEach((id: string) => {
          const matched = allProducts.find((p: ShopifyProduct) => p.id.toString() === id);
          if (matched) {
            resolved.push(matched);
          } else {
            missingIds.push(id);
          }
        });

        // Fetch any missing products individually
        if (missingIds.length > 0) {
          const fetchedMissing = await Promise.all(
            missingIds.map(async (id) => {
              try {
                const res = await fetch(`/api/shopify/products/${id}`);
                if (!res.ok) return null;
                const data = await res.json();
                return data.product || null;
              } catch {
                return null;
              }
            })
          );
          
          const validMissing = fetchedMissing.filter((p: ShopifyProduct | null): p is ShopifyProduct => p !== null);
          
          // Re-assemble in original order
          const combinedList = [...resolved, ...validMissing];
          const orderedList = selectedIds
            .map((id: string) => combinedList.find((p: ShopifyProduct) => p.id.toString() === id))
            .filter((p: ShopifyProduct | undefined): p is ShopifyProduct => p !== undefined);

          setSelectedProducts(orderedList);
        } else {
          setSelectedProducts(resolved);
        }
      } else {
        setSelectedProducts([]);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while loading settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch catalog when collection filter changes
  useEffect(() => {
    if (loading) return;
    const fetchFilteredCatalog = async () => {
      setCatalogLoading(true);
      try {
        const url = collectionFilter === "all"
          ? "/api/shopify/products?pageSize=250"
          : `/api/shopify/products?pageSize=250&collection=${collectionFilter}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load collection products");
        const data = await res.json();
        setCatalogProducts(data.products || []);
      } catch (err: any) {
        toast.error(err.message || "Error filtering catalog");
      } finally {
        setCatalogLoading(false);
      }
    };
    fetchFilteredCatalog();
  }, [collectionFilter]);

  // Dynamic Product Types list for filtering
  const productTypes = useMemo(() => {
    const types = new Set<string>();
    catalogProducts.forEach((p) => {
      if (p.product_type) types.add(p.product_type);
    });
    return Array.from(types);
  }, [catalogProducts]);

  // Filter and sort available products in catalog
  const filteredCatalog = useMemo(() => {
    let result = [...catalogProducts];

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          (p.tags && p.tags.toLowerCase().includes(q)) ||
          p.variants.some((v) => v.sku && v.sku.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter((p) => p.product_type === typeFilter);
    }

    // Sort catalog
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === "price") {
        const priceA = parseFloat(a.variants[0]?.price || "0");
        const priceB = parseFloat(b.variants[0]?.price || "0");
        cmp = priceA - priceB;
      } else if (sortKey === "created") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [catalogProducts, searchQuery, statusFilter, typeFilter, sortKey, sortDir]);

  // Product Selection Handlers
  const handleAddProduct = (product: ShopifyProduct) => {
    if (selectedProducts.some((p) => p.id === product.id)) {
      toast.error("Product already added to homepage list");
      return;
    }
    setSelectedProducts((prev) => [...prev, product]);
    toast.success(`"${product.title}" added to layout`);
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setSelectedProducts((prev) => {
      const list = [...prev];
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
      return list;
    });
  };

  const handleMoveDown = (index: number) => {
    setSelectedProducts((prev) => {
      if (index === prev.length - 1) return prev;
      const list = [...prev];
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
      return list;
    });
  };

  // Save layout configurations
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: { homepageCollection: string; homepageProducts: string } = {
        homepageCollection: "",
        homepageProducts: ""
      };

      if (sourceMode === "collection") {
        if (!selectedCollectionHandle) {
          throw new Error("Please select a Shopify collection source or toggle to Specific Products mode.");
        }
        payload.homepageCollection = selectedCollectionHandle;
      } else {
        if (selectedProducts.length === 0) {
          throw new Error("Please add at least one product or select a collection source.");
        }
        payload.homepageProducts = selectedProducts.map((p) => p.id.toString()).join(",");
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save settings failed");

      toast.success("Homepage products updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  // Grid slot helper styling and labels
  const getSlotDetails = (index: number) => {
    const num = index + 1;
    if (num >= 1 && num <= 4) {
      return { label: `Grid 1 — Slot ${num}`, colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
    }
    if (num >= 5 && num <= 8) {
      return { label: `Grid 2 — Slot ${num - 4}`, colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    }
    if (num >= 9 && num <= 12) {
      return { label: `Skipped (Not Rendered) — Slot ${num - 8}`, colorClass: "text-amber-500 bg-amber-500/5 border-amber-500/10 opacity-60" };
    }
    if (num >= 13 && num <= 16) {
      return { label: `Grid 3 — Slot ${num - 12}`, colorClass: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
    }
    return { label: `Index ${num} (Overflow)`, colorClass: "text-gray-400 bg-gray-500/5 border-gray-500/10 opacity-40" };
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-foreground/40 animate-spin" />
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Loading Homepage CMS...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="pb-16 space-y-6 max-w-7xl mx-auto px-4"
    >
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-foreground/[0.04] pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-500" /> Homepage Products Manager
          </h1>
          <p className="text-[12px] text-foreground/50 mt-1 max-w-xl">
            Select products directly from your Shopify catalog, search and filter them, and drag or reorder items to set the exact storefront layout grids.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadData}
            className="glass-button flex items-center gap-2 px-3 py-2 text-[11px] font-medium hover:bg-foreground/[0.04] active:scale-95 transition-all text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold bg-foreground text-background dark:bg-white dark:text-black rounded-full hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-md shrink-0"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* source mode selection card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground/[0.03] flex items-center justify-center text-foreground border border-foreground/[0.06]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[12px] font-semibold block text-foreground">Select Homepage Source Mode</span>
              <span className="text-[9px] text-foreground/40 uppercase tracking-widest">Toggle how products are loaded on the main storefront</span>
            </div>
          </div>
          <div className="flex p-0.5 bg-foreground/[0.03] rounded-lg border border-foreground/[0.05] w-full sm:w-auto">
            <button
              onClick={() => setSourceMode("products")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                sourceMode === "products"
                  ? "bg-white text-black dark:bg-zinc-800 dark:text-white shadow-sm border border-foreground/[0.05]"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              Specific Selection ({selectedProducts.length})
            </button>
            <button
              onClick={() => setSourceMode("collection")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                sourceMode === "collection"
                  ? "bg-white text-black dark:bg-zinc-800 dark:text-white shadow-sm border border-foreground/[0.05]"
                  : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              Shopify Collection
            </button>
          </div>
        </div>

        {sourceMode === "collection" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="pt-3 border-t border-foreground/[0.04] space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
              <div>
                <label className="text-[11px] font-semibold text-foreground">Select Source Collection</label>
                <p className="text-[9px] text-foreground/40 uppercase tracking-widest mt-0.5">All products in this collection will load on the homepage</p>
              </div>
              <select
                value={selectedCollectionHandle}
                onChange={(e) => setSelectedCollectionHandle(e.target.value)}
                className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[11px] rounded-lg px-3 py-2 w-full sm:max-w-xs focus:border-foreground/30 outline-none"
              >
                <option value="">-- Choose a collection --</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.handle}>
                    {c.title} ({c.handle})
                  </option>
                ))}
              </select>
            </div>
            {selectedCollectionHandle && (
              <div className="bg-foreground/[0.02] border border-foreground/[0.05] rounded-xl p-4">
                <span className="text-[9px] text-foreground/40 uppercase tracking-widest block mb-3 font-semibold">Live Preview of selected collection</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {catalogProducts.slice(0, 12).map((p) => (
                    <div key={p.id} className="flex flex-col items-center gap-2 text-center p-2 bg-background/40 rounded-lg border border-foreground/[0.03]">
                      <div className="relative aspect-[3/4] w-full rounded-md overflow-hidden bg-foreground/[0.02]">
                        {p.image?.src ? (
                          <NextImage src={p.image.src} alt={p.title} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[7px] text-muted-foreground uppercase">ZB Studio</div>
                        )}
                      </div>
                      <span className="text-[8px] font-bold tracking-wider text-foreground truncate w-full">{p.title}</span>
                    </div>
                  ))}
                  {catalogProducts.length === 0 && (
                    <span className="col-span-full py-4 text-center text-[10px] text-muted-foreground uppercase tracking-widest">No products found in this collection</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {sourceMode === "products" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Current selection and order */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-foreground/[0.04]">
                <div>
                  <span className="text-[12px] font-semibold block text-foreground">Homepage Layout Slots</span>
                  <span className="text-[9px] text-foreground/40 uppercase tracking-widest">Products render in Grid 1, 2, and 3 slots. Skipped items are hidden.</span>
                </div>
                <span className="px-2.5 py-1 text-[9px] font-bold bg-indigo-500/10 text-indigo-400 rounded-full uppercase tracking-wider">
                  {selectedProducts.length} Selected
                </span>
              </div>

              {selectedProducts.length > 16 && (
                <div className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-[10px] leading-relaxed">
                    <strong>Layout Warning:</strong> You have selected {selectedProducts.length} products. The homepage layout only displays indices 1-8 (Grids 1 and 2) and 13-16 (Grid 3). Additional items will be clipped.
                  </p>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {selectedProducts.map((p, index) => {
                    const slot = getSlotDetails(index);
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between p-3 bg-foreground/[0.01] hover:bg-foreground/[0.02] border border-foreground/[0.05] hover:border-foreground/10 rounded-xl gap-3 group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Thumbnail */}
                          <div className="relative aspect-[3/4] w-12 rounded-lg overflow-hidden border border-foreground/10 shrink-0">
                            {p.image?.src ? (
                              <NextImage src={p.image.src} alt={p.title} fill className="object-cover" sizes="50px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[6px] text-muted-foreground">ZB</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-foreground truncate block leading-snug">{p.title}</span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[8px] font-medium text-foreground/40 uppercase tracking-wider">{p.vendor}</span>
                              <span className="text-[8px] text-foreground/30">•</span>
                              <span className="text-[8px] font-medium text-foreground/40 uppercase tracking-wider">{p.product_type}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 text-[7px] font-bold border rounded uppercase tracking-widest ${slot.colorClass}`}>
                                {slot.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="w-7 h-7 flex items-center justify-center bg-foreground/[0.02] hover:bg-foreground/[0.05] disabled:opacity-20 disabled:pointer-events-none rounded-lg text-foreground transition-all border border-foreground/[0.04]"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === selectedProducts.length - 1}
                            className="w-7 h-7 flex items-center justify-center bg-foreground/[0.02] hover:bg-foreground/[0.05] disabled:opacity-20 disabled:pointer-events-none rounded-lg text-foreground transition-all border border-foreground/[0.04]"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(p.id)}
                            className="w-7 h-7 flex items-center justify-center bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-lg text-red-400 transition-all ml-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {selectedProducts.length === 0 && (
                  <div className="py-16 text-center space-y-2 bg-foreground/[0.01] border border-dashed border-foreground/10 rounded-2xl">
                    <ShoppingBag className="w-6 h-6 text-foreground/20 mx-auto" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] block font-light">No products selected yet</span>
                    <span className="text-[8px] text-muted-foreground/50 uppercase tracking-widest block">Choose products from the catalog on the right</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Catalog search and selector */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-foreground/[0.04]">
                <div>
                  <span className="text-[12px] font-semibold block text-foreground">Catalog Products</span>
                  <span className="text-[9px] text-foreground/40 uppercase tracking-widest">Select products to add to your homepage layout</span>
                </div>
              </div>

              {/* Advanced Filters Grid */}
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                  <input
                    type="text"
                    placeholder="Search by title, SKU, vendor, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-foreground/[0.02] border border-foreground/10 focus:border-foreground/30 pl-9 pr-3 py-2 text-[11px] rounded-lg outline-none text-foreground placeholder:text-foreground/40 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Collection Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider">Collection</label>
                    <select
                      value={collectionFilter}
                      onChange={(e) => setCollectionFilter(e.target.value)}
                      className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[10px] rounded-lg px-2.5 py-1.5 focus:border-foreground/30 outline-none w-full"
                    >
                      <option value="all">All Products</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.handle}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[10px] rounded-lg px-2.5 py-1.5 focus:border-foreground/30 outline-none w-full"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  {/* Product Type Filter */}
                  <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                    <label className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[10px] rounded-lg px-2.5 py-1.5 focus:border-foreground/30 outline-none w-full"
                    >
                      <option value="all">All Types</option>
                      {productTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Key */}
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider">Sort Catalog</label>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as any)}
                      className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[10px] rounded-lg px-2.5 py-1.5 focus:border-foreground/30 outline-none w-full"
                    >
                      <option value="title">Product Title</option>
                      <option value="price">Price</option>
                      <option value="created">Date Created</option>
                    </select>
                  </div>

                  {/* Sort Dir */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider">Sort Dir</label>
                    <select
                      value={sortDir}
                      onChange={(e) => setSortDir(e.target.value as any)}
                      className="bg-foreground/[0.02] border border-foreground/10 text-foreground text-[10px] rounded-lg px-2.5 py-1.5 focus:border-foreground/30 outline-none w-full"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {catalogLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 text-foreground/30 animate-spin" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Fetching catalog...</span>
                  </div>
                ) : filteredCatalog.length > 0 ? (
                  filteredCatalog.map((p) => {
                    const isAdded = selectedProducts.some((s) => s.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-foreground/[0.01] border border-foreground/[0.04] rounded-xl gap-3 hover:bg-foreground/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Thumbnail */}
                          <div className="relative aspect-[3/4] w-10 rounded-lg overflow-hidden border border-foreground/10 shrink-0">
                            {p.image?.src ? (
                              <NextImage src={p.image.src} alt={p.title} fill className="object-cover" sizes="40px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[5px] text-muted-foreground">ZB</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-foreground truncate block leading-tight">{p.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] font-medium text-foreground/40 uppercase tracking-widest">{p.vendor}</span>
                              <span className="text-[8px] text-foreground/20">•</span>
                              <span className="text-[9px] font-bold text-foreground/70">₹{p.variants[0]?.price || "0.00"}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded-[4px] text-[6px] font-bold uppercase tracking-wider border ${
                                p.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              }`}>
                                {p.status}
                              </span>
                              {p.product_type && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-foreground/[0.03] text-foreground/50 border border-foreground/[0.06] text-[6px] font-bold uppercase tracking-wider">
                                  {p.product_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Add Button */}
                        <button
                          onClick={() => handleAddProduct(p)}
                          disabled={isAdded}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                            isAdded
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : "bg-foreground text-background dark:bg-white dark:text-black hover:opacity-90 active:scale-95 border border-transparent shadow-sm"
                          }`}
                        >
                          {isAdded ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-light">
                    No matching products found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
