import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchCollections, fetchProductsByCollectionId, clearShopifyCache } from "@/lib/shopify-admin";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const collectionId = params.id;
    const allCollections = await fetchCollections();
    const collection = allCollections.find(c => String(c.id) === String(collectionId));

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Fetch products in the collection
    const products = await fetchProductsByCollectionId(collectionId).catch(() => []);

    // Get product IDs in the collection
    const productIds = products.map(p => String(p.id));

    // Find local products to get their db IDs
    const localProducts = await prisma.product.findMany({
      where: {
        shopifyProductId: {
          in: productIds
        }
      },
      select: { id: true, shopifyProductId: true }
    });

    const localProductIds = localProducts.map((p: { id: string }) => p.id);

    // Find orders containing these products
    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            productId: {
              in: localProductIds
            }
          }
        }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Fetch custom order list from DB
    const shop = await prisma.shop.findFirst({
      select: { collectionProductOrders: true }
    });
    
    let customOrder: string[] = [];
    if (shop?.collectionProductOrders) {
      try {
        const ordersMap = JSON.parse(shop.collectionProductOrders);
        customOrder = ordersMap[String(collectionId)] || ordersMap[collection.handle] || [];
      } catch (e) {
        console.error("Error parsing collectionProductOrders:", e);
      }
    }

    return NextResponse.json({
      collection,
      products,
      orders,
      customOrder
    });
  } catch (error: any) {
    console.error("Collection details GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const collectionId = params.id;
    const { productIds } = await req.json();

    if (!Array.isArray(productIds)) {
      return NextResponse.json({ error: "Invalid productIds list" }, { status: 400 });
    }

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    let ordersMap: Record<string, string[]> = {};
    if (shop.collectionProductOrders) {
      try {
        ordersMap = JSON.parse(shop.collectionProductOrders);
      } catch (e) {
        console.error("Error parsing existing collectionProductOrders:", e);
      }
    }

    ordersMap[String(collectionId)] = productIds.map(String);

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        collectionProductOrders: JSON.stringify(ordersMap)
      }
    });

    // Clear caches
    clearShopifyCache();

    // Revalidate paths
    revalidatePath("/");
    revalidatePath(`/collections/${collectionId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Collection details POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
