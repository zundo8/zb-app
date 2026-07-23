import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { shopifyFetch, ShopifyProduct } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Fetch all wishlist items flat list with customer and product details
    const wishlistItems = await prisma.wishlist.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            image: true,
            ordersCount: true,
            totalSpent: true,
            createdAt: true,
          }
        },
        product: {
          select: {
            id: true,
            title: true,
            featuredImage: true,
            shopifyProductId: true,
            price: true,
            sku: true,
            handle: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Extract all unique shopify product IDs for enrichment
    const rawShopifyIds = Array.from(
      new Set(
        wishlistItems
          .map((item: any) => item.product?.shopifyProductId)
          .filter(Boolean)
          .map((id: any) => String(id).replace(/^gid:\/\/shopify\/Product\//, ''))
      )
    );

    let shopifyProductsMap = new Map<string, ShopifyProduct>();
    if (rawShopifyIds.length > 0) {
      try {
        const data = await shopifyFetch<{ products: ShopifyProduct[] }>("products.json", {
          ids: rawShopifyIds.join(",")
        });
        if (data?.products && Array.isArray(data.products)) {
          for (const sp of data.products) {
            shopifyProductsMap.set(String(sp.id), sp);
          }
        }
      } catch (err) {
        console.error("Admin Wishlist: Could not fetch Shopify products info:", err);
      }
    }

    // Format and enrich items safely
    const items = wishlistItems.map((item: any) => {
      const customer = item.customer || {
        id: item.customerId || "unknown",
        name: "Guest Customer",
        phone: "",
        email: null,
        image: null,
        ordersCount: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
      };

      const cleanShopifyId = item.product?.shopifyProductId
        ? String(item.product.shopifyProductId).replace(/^gid:\/\/shopify\/Product\//, '')
        : '';
      const shopifyData = cleanShopifyId ? shopifyProductsMap.get(cleanShopifyId) : null;

      const productTitle = shopifyData?.title || item.product?.title || "Unknown Product";
      const featuredImage = shopifyData?.image?.src || item.product?.featuredImage || null;
      const handle = shopifyData?.handle || item.product?.handle || cleanShopifyId;
      
      const priceVal = shopifyData?.variants?.[0]?.price 
        ? parseFloat(shopifyData.variants[0].price) 
        : (item.product?.price || 0);

      // Check stock status across Shopify variants if available
      let inStock = true;
      if (shopifyData?.variants && shopifyData.variants.length > 0) {
        inStock = shopifyData.variants.some((v) => {
          if (!v.inventory_management) return true;
          return (v.inventory_quantity || 0) > 0;
        });
      }

      return {
        id: item.id,
        createdAt: item.createdAt,
        size: item.size || null,
        variantId: item.variantId || null,
        customer: {
          id: customer.id,
          name: customer.name || "Guest Customer",
          phone: customer.phone || "",
          email: customer.email || null,
          image: customer.image || null,
          ordersCount: customer.ordersCount || 0,
          totalSpent: customer.totalSpent || 0,
          createdAt: customer.createdAt,
        },
        product: {
          id: item.product?.id || item.productId,
          title: productTitle,
          featuredImage,
          handle,
          price: priceVal,
          shopifyProductId: item.product?.shopifyProductId || cleanShopifyId,
          cleanShopifyId,
          inStock,
        }
      };
    });

    return NextResponse.json({ items, totalCount: items.length });
  } catch (error) {
    console.error("Admin: Error fetching wishlists:", error);
    return NextResponse.json({ error: "Failed to fetch wishlists" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Wishlist item ID is required" }, { status: 400 });
    }

    await prisma.wishlist.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Wishlist item removed successfully" });
  } catch (error) {
    console.error("Admin: Error deleting wishlist item:", error);
    return NextResponse.json({ error: "Failed to delete wishlist item" }, { status: 500 });
  }
}
