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
    const standaloneWhere = status && status !== 'all' ? { exchangeRequestId: null, status: status.toUpperCase() } : { exchangeRequestId: null };

    const [exchanges, total, statusGroups, standaloneExchanges, standaloneTotal, standaloneStatusGroups] = await Promise.all([
      prisma.exchangeRequest.findMany({
        where,
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
      prisma.exchangeRequest.count({ where }),
      prisma.exchangeRequest.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.exchange.findMany({
        where: standaloneWhere,
        include: {
          originalProduct: true,
          newProduct: true,
          order: {
            include: { customer: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.exchange.count({ where: standaloneWhere }),
      prisma.exchange.groupBy({
        by: ['status'],
        where: { exchangeRequestId: null },
        _count: { id: true }
      })
    ]);

    const formattedExchanges = exchanges.map((e: any) => ({
      exchangeRequestId: e.id,
      orderId: e.orderId,
      shopifyOrderId: e.order?.shopifyOrderId || e.order?.shopifyOrderName || e.order?.internalOrderNumber || e.orderId,
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

    const formattedStandalone = standaloneExchanges.map((se: any) => ({
      exchangeRequestId: se.id,
      orderId: se.orderId,
      shopifyOrderId: se.order?.shopifyOrderId || se.order?.shopifyOrderName || se.order?.internalOrderNumber || se.orderId,
      userId: se.order?.customerId || "",
      userName: se.order?.customer?.name || "Unknown",
      userEmail: se.order?.customer?.email || "",
      status: se.status.toLowerCase(),
      priceDifference: se.priceDifference || 0,
      paymentStatus: se.paymentStatus || 'not_required',
      createdAt: se.createdAt,
      reason: se.reason,
      returnRequestId: null,
      newShopifyOrderId: se.newOrderId,
      isStandalone: true,
      items: [{
        id: se.id,
        orderId: se.orderId,
        originalProductId: se.originalProductId,
        newProductId: se.newProductId,
        status: se.status,
        priceDifference: se.priceDifference,
        createdAt: se.createdAt,
        updatedAt: se.updatedAt,
        paymentStatus: se.paymentStatus,
        newOrderId: se.newOrderId,
        exchangeRequestId: null,
        reason: se.reason,
        qcStatus: se.qcStatus,
        qcNotes: se.qcNotes,
        originalProduct: se.originalProduct,
        newProduct: se.newProduct
      }]
    }));

    const combined = [...formattedExchanges, ...formattedStandalone].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const statusCounts: Record<string, number> = {};
    
    // Aggregate ExchangeRequest status counts
    statusGroups.forEach((g: any) => {
      const s = g.status.toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + g._count.id;
    });

    // Aggregate standalone Exchange status counts
    standaloneStatusGroups.forEach((g: any) => {
      const s = g.status.toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + g._count.id;
    });

    const paginated = combined.slice(offset, offset + limit);

    return NextResponse.json({
      exchanges: paginated,
      total: combined.length,
      statusCounts
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
