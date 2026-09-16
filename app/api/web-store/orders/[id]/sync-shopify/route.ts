import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { pullAndSyncShopifyOrder } from "@/lib/services/shopifyOrderSyncService";
import { findShopifyOrderByInternalNumber } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveWebStoreOrder(id: string) {
  if (!id) return null;

  if (UUID_REGEX.test(id)) {
    try {
      const order = await prisma.webStoreOrder.findUnique({ where: { id } });
      if (order) return order;
    } catch {}
  }

  try {
    const order = await prisma.webStoreOrder.findUnique({ where: { orderNumber: id } });
    if (order) return order;
  } catch {}

  try {
    const order = await prisma.webStoreOrder.findFirst({ where: { razorpayOrderId: id } });
    if (order) return order;
  } catch {}

  // Fallback to master Order to find linked WebStoreOrder
  try {
    const mOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { internalOrderNumber: id },
          { shopifyOrderName: id },
          { shopifyOrderId: id }
        ]
      }
    });
    if (mOrder?.internalOrderNumber) {
      const wso = await prisma.webStoreOrder.findUnique({
        where: { orderNumber: mOrder.internalOrderNumber }
      });
      if (wso) return wso;
    }
  } catch {}

  return null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = params.id;
    let webStoreOrder = await resolveWebStoreOrder(orderId);

    if (!webStoreOrder) {
      return NextResponse.json({ error: "Web store order not found" }, { status: 404 });
    }

    // Determine Shopify Order ID
    let shopifyOrderId = webStoreOrder.shopifyOrderId;

    if (!shopifyOrderId && webStoreOrder.notes) {
      const match = webStoreOrder.notes.match(/Shopify:\s*(\d+)/i);
      if (match) {
        shopifyOrderId = match[1];
      }
    }

    if (!shopifyOrderId && webStoreOrder.orderNumber) {
      const shopifyOrder = await findShopifyOrderByInternalNumber(webStoreOrder.orderNumber);
      if (shopifyOrder?.id) {
        shopifyOrderId = String(shopifyOrder.id);
      }
    }

    if (!shopifyOrderId) {
      // Check master Order
      const mOrder = await prisma.order.findFirst({
        where: { internalOrderNumber: webStoreOrder.orderNumber }
      });
      if (mOrder?.shopifyOrderId && /^\d+$/.test(mOrder.shopifyOrderId)) {
        shopifyOrderId = mOrder.shopifyOrderId;
      }
    }

    if (!shopifyOrderId) {
      return NextResponse.json(
        { success: false, error: "No Shopify order associated with this order" },
        { status: 404 }
      );
    }

    const result = await pullAndSyncShopifyOrder(shopifyOrderId, {
      webStoreOrderId: webStoreOrder.id,
      fallbackOrderNumber: webStoreOrder.orderNumber,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to pull Shopify updates" },
        { status: 500 }
      );
    }

    const updatedWebStoreOrder = await prisma.webStoreOrder.findUnique({
      where: { id: webStoreOrder.id }
    });

    return NextResponse.json({
      success: true,
      order: updatedWebStoreOrder,
      trackingNumber: result.trackingNumber,
      trackingUrl: result.trackingUrl,
      courier: result.courier,
      deliveryStatus: result.deliveryStatus,
      fulfillmentStatus: result.fulfillmentStatus,
      message: "Shopify tracking and status synced successfully"
    });
  } catch (error: any) {
    console.error("[WebStore Order Sync Shopify] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
