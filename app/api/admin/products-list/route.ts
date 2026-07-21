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

    const formattedProducts = products.map((p: any) => {
      const variants = skuMap.get(p.id) || skuMap.get(p.shopifyProductId) || [
        { id: p.sku || p.id, variantId: p.sku || p.id, size: "Standard", sku: p.sku }
      ];
      return {
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        price: p.price,
        image: p.featuredImage,
        variants
      };
    });

    return NextResponse.json({ products: formattedProducts });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
