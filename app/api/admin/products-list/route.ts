import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

import { fetchAllProducts } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAuth();

    // 1. Fetch products from DB
    const products = await prisma.product.findMany({
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        sku: true,
        price: true,
        featuredImage: true,
        handle: true,
      },
      orderBy: { title: "asc" }
    });

    // 2. Fetch product SKUs/variants from product_skus table
    const productSkus = await prisma.product_skus.findMany({
      select: {
        id: true,
        product_id: true,
        sku: true,
        size: true,
        shopify_variant_id: true,
      }
    });

    // Group SKUs by product_id
    const skuMap = new Map<string, any[]>();
    for (const skuItem of productSkus) {
      const existing = skuMap.get(skuItem.product_id) || [];
      existing.push({
        id: skuItem.shopify_variant_id || skuItem.sku || skuItem.id,
        variantId: skuItem.shopify_variant_id || skuItem.sku || skuItem.id,
        size: skuItem.size || "Standard",
        sku: skuItem.sku,
      });
      skuMap.set(skuItem.product_id, existing);
    }

    // 3. Fetch Shopify products to retrieve exact Shopify variant IDs and sizes (26-38, XS-XXL)
    let shopifyProductsMap = new Map<string, any>();
    try {
      const shopifyProducts = await fetchAllProducts(250);
      for (const sp of shopifyProducts) {
        const cleanId = String(sp.id).replace(/^gid:\/\/shopify\/Product\//, '');
        shopifyProductsMap.set(cleanId, sp);
        shopifyProductsMap.set(String(sp.id), sp);
      }
    } catch (shopifyErr) {
      console.error("[Products API] Could not fetch Shopify products:", shopifyErr);
    }

    const ALPHA_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "FREE SIZE"];
    const NUMERIC_WAIST_SIZES = ["26", "28", "30", "32", "34", "36", "38"];

    const isBottomsCategory = (title: string = "") => {
      const lower = title.toLowerCase();
      return (
        lower.includes("pant") ||
        lower.includes("jean") ||
        lower.includes("trouser") ||
        lower.includes("short") ||
        lower.includes("bottom") ||
        lower.includes("denim") ||
        lower.includes("skirt") ||
        lower.includes("cargo") ||
        lower.includes("jogger")
      );
    };

    const formattedProducts = products.map((p: any) => {
      const spId = String(p.shopifyProductId || "").replace(/^gid:\/\/shopify\/Product\//, '');
      const sp = shopifyProductsMap.get(spId) || shopifyProductsMap.get(String(p.shopifyProductId));

      let variants: any[] = [];
      const seenVariantIds = new Set<string>();
      const seenSizes = new Set<string>();

      // A. Populate from real Shopify variants (highest priority for Shopify sync)
      if (sp && sp.variants && sp.variants.length > 0) {
        for (const v of sp.variants) {
          const gid = String(v.id).startsWith("gid://")
            ? String(v.id)
            : `gid://shopify/ProductVariant/${v.id}`;

          const sizeName = v.title || v.option1 || "Standard";
          seenVariantIds.add(gid);
          seenVariantIds.add(String(v.id));
          seenSizes.add(String(sizeName).toUpperCase());

          variants.push({
            id: gid,
            variantId: gid,
            size: sizeName,
            sku: v.sku || p.sku || null,
          });
        }
      }

      // B. Populate from DB product_skus table
      const dbSkus = skuMap.get(p.id) || skuMap.get(p.shopifyProductId) || [];
      for (const item of dbSkus) {
        const vId = item.shopify_variant_id || item.variantId || item.id;
        if (!seenVariantIds.has(vId)) {
          seenVariantIds.add(vId);
          seenSizes.add(String(item.size).toUpperCase());
          variants.push(item);
        }
      }

      // C. Populate appropriate category size fallbacks (numeric 26-38 for jeans/pants, alpha for tops)
      const targetSizes = isBottomsCategory(p.title) ? NUMERIC_WAIST_SIZES : ALPHA_SIZES;
      for (const size of targetSizes) {
        if (!seenSizes.has(size.toUpperCase())) {
          const synthId = p.sku ? `${p.sku}-${size}` : `size_${size}`;
          variants.push({
            id: `${p.id}_size_${size}`,
            variantId: synthId,
            size: size,
            sku: p.sku ? `${p.sku}-${size}` : null,
          });
        }
      }

      return {
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        price: p.price,
        image: p.featuredImage,
        sku: p.sku,
        variants
      };
    });

    let finalFormattedProducts = formattedProducts;

    // Fallback: If DB returns 0 products, format and return directly from Shopify Admin API
    if (finalFormattedProducts.length === 0 && shopifyProductsMap.size > 0) {
      const allShopifyProds = Array.from(new Set(Array.from(shopifyProductsMap.values())));
      finalFormattedProducts = allShopifyProds.map((sp: any) => {
        const variants = (sp.variants || []).map((v: any) => ({
          id: String(v.id).startsWith('gid://') ? String(v.id) : `gid://shopify/ProductVariant/${v.id}`,
          variantId: String(v.id).startsWith('gid://') ? String(v.id) : `gid://shopify/ProductVariant/${v.id}`,
          size: v.title || v.option1 || 'Standard',
          sku: v.sku || null
        }));

        return {
          id: String(sp.id),
          shopifyProductId: String(sp.id),
          title: sp.title,
          price: parseFloat(sp.variants?.[0]?.price || '0'),
          image: sp.images?.[0]?.src || sp.image?.src || '',
          sku: sp.variants?.[0]?.sku || '',
          variants
        };
      });
    }

    return NextResponse.json({ products: finalFormattedProducts });
  } catch (error: any) {
    try {
      const { fetchAllProducts } = await import("@/lib/shopify-admin");
      const shopifyProds = await fetchAllProducts(250);
      const formatted = shopifyProds.map((sp: any) => ({
        id: String(sp.id),
        shopifyProductId: String(sp.id),
        title: sp.title,
        price: parseFloat(sp.variants?.[0]?.price || '0'),
        image: sp.images?.[0]?.src || sp.image?.src || '',
        sku: sp.variants?.[0]?.sku || '',
        variants: (sp.variants || []).map((v: any) => ({
          id: String(v.id).startsWith('gid://') ? String(v.id) : `gid://shopify/ProductVariant/${v.id}`,
          size: v.title || 'Standard',
          sku: v.sku || null
        }))
      }));
      return NextResponse.json({ products: formatted });
    } catch (e2) {
      return handleAuthError(error);
    }
  }
}
