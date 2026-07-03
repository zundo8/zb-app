import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where = status && status !== 'all' ? { status } : {};

    const [exchanges, total] = await Promise.all([
      prisma.exchangeRequest.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          exchanges: {
            include: { originalProduct: true, newProduct: true }
          },
          order: {
            include: { customer: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.exchangeRequest.count({ where })
    ]);

    const formattedExchanges = exchanges.map((e: any) => ({
      exchangeRequestId: e.id,
      orderId: e.orderId,
      shopifyOrderId: e.order?.shopifyOrderId,
      userId: e.customerId,
      userName: e.order?.customer?.name || "Unknown",
      userEmail: e.order?.customer?.email || "",
      status: e.status,
      priceDifference: e.priceDifference,
      paymentStatus: e.paymentStatus,
      createdAt: e.createdAt,
      reason: e.reason,
      returnRequestId: e.returnRequestId,
      newShopifyOrderId: e.newShopifyOrderId,
      items: e.exchanges
    }));

    return NextResponse.json({
      exchanges: formattedExchanges,
      total
    });
  } catch (error: any) {
    console.error("Fetch Admin Exchanges Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, customerId, items } = await req.json();

    if (!orderId || !items || !items.length) {
      return NextResponse.json({ error: "Order ID and items are required" }, { status: 400 });
    }

    const resolvedExchanges = await Promise.all(items.map(async (item: any) => {
      const originalItem = await prisma.orderItem.findUnique({
        where: { id: item.originalLineItemId }
      });

      if (!originalItem) {
        throw new Error(`Original order item ${item.originalLineItemId} not found`);
      }

      let newProductId = item.newProductId;
      if (!newProductId && item.newVariantId) {
         const product = await prisma.product.findFirst({
           where: { shopifyProductId: item.newVariantId.split('/').pop() }
         });
         newProductId = product?.id;
      }

      return {
        originalProductId: originalItem.productId,
        newProductId: newProductId,
        reason: item.reason || "Admin manual exchange"
      };
    }));

    const exchangeRequest = await prisma.$transaction(async (tx: any) => {
      const er = await tx.exchangeRequest.create({
        data: {
          orderId,
          customerId,
          status: 'pending_approval',
          exchanges: {
            create: resolvedExchanges.map((ex: any) => ({
              originalProductId: ex.originalProductId!,
              newProductId: ex.newProductId!,
              orderId,
              status: 'REQUESTED',
              reason: ex.reason
            }))
          }
        },
        include: {
          exchanges: true
        }
      });

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'exchange_initiated' }
      });

      return er;
    });

    return NextResponse.json({ success: true, exchangeRequest });
  } catch (error: any) {
    console.error("Create Admin Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
