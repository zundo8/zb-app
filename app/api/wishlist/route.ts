import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAppAuthFromRequest } from "@/lib/appAuth";

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

    return NextResponse.json({ items: wishlistItems });
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

    if (action === "remove") {
      await prisma.wishlist.deleteMany({
        where: {
          customerId: auth.customerId,
          productId: productId
        }
      });
      return NextResponse.json({ success: true, message: "Removed from wishlist" });
    } else {
      // Check if product exists in local DB, if not, we might need to sync it from Shopify
      // For now, assume it exists or create a stub if we have the ID
      let product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
          // If it's a shopify ID, we might need to find it by shopifyProductId
          product = await prisma.product.findUnique({
              where: { shopifyProductId: productId }
          });
      }

      if (!product) {
        return NextResponse.json({ error: "Product not found in database" }, { status: 404 });
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
        update: {} // No update needed if already exists
      });

      return NextResponse.json({ success: true, item });
    }
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return NextResponse.json({ error: "Failed to update wishlist" }, { status: 500 });
  }
}
