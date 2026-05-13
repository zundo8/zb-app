import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAppAuthFromRequest } from "@/lib/appAuth";
import { fetchProductById } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = getAppAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wishlistItems = await prisma.wishlist.findMany({
      where: { customerId: auth.customerId },
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map to a more useful format for the app
    const items = wishlistItems.map(item => ({
      ...item,
      product: {
        ...item.product,
        // Ensure id is the GID if that's what the app expects for keys
        id: item.product.shopifyProductId.startsWith('gid://') 
          ? item.product.shopifyProductId 
          : `gid://shopify/Product/${item.product.shopifyProductId}`,
        // Map other fields to match FlatProduct
        price: String(item.product.price || '0'),
        images: item.product.featuredImage ? [item.product.featuredImage] : [],
        variants: [], // We don't store variants locally yet
        isSoldOut: false,
        isOnSale: false,
      }
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = getAppAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { productId, action } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Strip GID prefix if present for database lookup
    const cleanId = productId.replace(/^gid:\/\/shopify\/Product\//, '');

    if (action === "remove") {
      await prisma.wishlist.deleteMany({
        where: {
          customerId: auth.customerId,
          product: {
            OR: [
              { id: productId },
              { shopifyProductId: cleanId }
            ]
          }
        }
      });
      return NextResponse.json({ success: true, message: "Removed from wishlist" });
    } else {
      let product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { shopifyProductId: cleanId }
          ]
        }
      });

      if (!product) {
        // Try fetching from Shopify if not in DB
        try {
          const shopifyProduct = await fetchProductById(cleanId);
          if (shopifyProduct) {
             const firstVariant = shopifyProduct.variants?.[0];
             const shop = await prisma.shop.findFirst();
             if (shop) {
               product = await prisma.product.create({
                 data: {
                   shopId: shop.id,
                   shopifyProductId: cleanId,
                   title: shopifyProduct.title,
                   handle: shopifyProduct.handle,
                   price: parseFloat(firstVariant?.price || '0'),
                   featuredImage: shopifyProduct.image?.src || null,
                 }
               });
             }
          }
        } catch (e) {
          console.error("Shopify fetch failed for wishlist add:", e);
        }
      }

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      const item = await prisma.wishlist.upsert({
        where: {
          customerId_productId: {
            customerId: auth.customerId,
            productId: product.id
          }
        },
        create: {
          customerId: auth.customerId,
          productId: product.id
        },
        update: {}
      });

      return NextResponse.json({ success: true, item });
    }
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return NextResponse.json({ error: "Failed to update wishlist" }, { status: 500 });
  }
}
