"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Edit2, RefreshCw, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VariantOption {
  id: string;
  variantId: string;
  size: string;
  sku: string | null;
}

interface ProductOption {
  id: string;
  shopifyProductId: string;
  title: string;
  price: number;
  image: string | null;
  variants: VariantOption[];
}

interface LineItemEditorProps {
  orderId: string;
  lineItemId: string;
  shopifyLineItemId?: string;
  currentProductId?: string | null;
  currentTitle: string;
  currentSku?: string | null;
  currentQuantity: number;
  currentPrice: number;
  onSuccess?: () => void;
}

export default function LineItemEditor({
  orderId,
  lineItemId,
  shopifyLineItemId,
  currentProductId,
  currentTitle,
  currentSku,
  currentQuantity,
  currentPrice,
  onSuccess
}: LineItemEditorProps) {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";

  const [isEditing, setIsEditing] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  const [savingLocal, setSavingLocal] = useState(false);
  const [stagedSuccess, setStagedSuccess] = useState(false);
  const [stagedData, setStagedData] = useState<any>(null);

  const [syncingShopify, setSyncingShopify] = useState(false);

  // Fetch product catalog when editor opens
  useEffect(() => {
    if (isEditing && products.length === 0) {
      setLoadingProducts(true);
      fetch("/api/admin/products-list")
        .then((res) => res.json())
        .then((data) => {
          setProducts(data.products || []);
        })
        .catch((err) => {
          console.error("Failed to load products:", err);
          toast.error("Failed to load product list");
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [isEditing, products.length]);

  if (!isSuperAdmin) {
    return null; // Non-super admins get no editing UI affordance
  }

  const selectedProduct = products.find(
    (p) => p.id === selectedProductId || p.shopifyProductId === selectedProductId
  );
  const availableVariants = selectedProduct?.variants || [];

  const handleConfirmEdit = async () => {
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    const variantObj = availableVariants.find((v) => v.variantId === selectedVariantId || v.id === selectedVariantId);

    setSavingLocal(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/edit-line-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItemId,
          newProductId: selectedProduct?.shopifyProductId || selectedProductId,
          newVariantId: variantObj?.variantId || selectedVariantId,
          newTitle: selectedProduct?.title || currentTitle,
          newSku: variantObj?.sku || selectedVariantId,
          newSize: variantObj?.size || "Standard",
          newImage: selectedProduct?.image || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to edit line item");

      toast.success(data.message || "Line item updated locally");
      setStagedSuccess(true);
      setStagedData({
        oldShopifyLineItemId: shopifyLineItemId || lineItemId,
        newVariantId: variantObj?.variantId || selectedVariantId,
        quantity: currentQuantity
      });
      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error saving edit");
    } finally {
      setSavingLocal(false);
    }
  };

  const handleSyncShopify = async () => {
    if (!stagedData) {
      toast.error("No staged changes to sync");
      return;
    }

    setSyncingShopify(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/sync-shopify-line-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stagedData)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Shopify sync failed");
      }

      toast.success(data.message || "Successfully synced to Shopify");
      setStagedSuccess(false);
      setStagedData(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync line item to Shopify");
    } finally {
      setSyncingShopify(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2 mt-2 flex-wrap">
      {!isEditing ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
            title="Super Admin: Correct Product/Variant"
          >
            <Edit2 className="w-3 h-3" />
            Correct Product/Size
          </button>

          {stagedSuccess && (
            <button
              onClick={handleSyncShopify}
              disabled={syncingShopify}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {syncingShopify ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync to Shopify
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 space-y-3 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Super Admin Correction Tool
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-foreground/40 hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingProducts ? (
            <div className="flex items-center gap-2 text-[11px] text-foreground/40 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading product catalog...
            </div>
          ) : (
            <>
              {/* Product Selector */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">
                  Select Correct Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId("");
                  }}
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dependent Variant/Size Selector */}
              {selectedProduct && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">
                    Select Variant / Size
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Choose Variant / Size --</option>
                    {availableVariants.map((v) => (
                      <option key={v.id} value={v.variantId}>
                        Size: {v.size} {v.sku ? `(SKU: ${v.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action controls */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-foreground/50 hover:bg-foreground/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEdit}
                  disabled={savingLocal || !selectedProductId}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-black font-bold rounded-lg text-[10px] uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {savingLocal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Confirm Staged Edit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
