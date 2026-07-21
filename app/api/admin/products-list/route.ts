import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

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

    const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "FREE SIZE"];

    const formattedProducts = products.map((p: any) => {
      const dbSkus = skuMap.get(p.id) || skuMap.get(p.shopifyProductId) || [];
      const existingSizes = new Set(dbSkus.map((item: any) => String(item.size).toUpperCase()));

      const variants = [...dbSkus];

      // Append standard apparel sizes if not already present
      for (const size of STANDARD_SIZES) {
        if (!existingSizes.has(size)) {
          variants.push({
            id: `${p.id}_size_${size}`,
            variantId: p.sku ? `${p.sku}-${size}` : `${p.shopifyProductId || p.id}-${size}`,
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

    return NextResponse.json({ products: formattedProducts });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
