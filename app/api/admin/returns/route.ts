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
    const standaloneWhere = status && status !== 'all' ? { returnRequestId: null, status: status.toUpperCase() } : { returnRequestId: null };

    const [returns, total, statusGroups, standaloneReturns, standaloneTotal, standaloneStatusGroups] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        include: {
          returns: {
            include: { product: true }
          },
          order: {
            include: { customer: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.return.findMany({
        where: standaloneWhere,
        include: {
          product: true,
          customer: true,
          order: {
            include: { customer: true }
          }
        },
        orderBy: { requestedAt: "desc" }
      }),
      prisma.return.count({ where: standaloneWhere }),
      prisma.return.groupBy({
        by: ['status'],
        where: { returnRequestId: null },
        _count: { id: true }
      })
    ]);

    const formattedReturns = returns.map((r: any) => ({
      returnRequestId: r.id,
      orderId: r.orderId,
      shopifyOrderId: r.order?.shopifyOrderId || r.order?.shopifyOrderName || r.order?.internalOrderNumber || r.orderId,
      orderCreatedAt: r.order?.createdAt,
      userId: r.customerId,
      userName: r.order?.customer?.name || "Unknown",
      userEmail: r.order?.customer?.email || "",
      status: r.status,
      estimatedRefund: r.estimatedRefund,
      actualRefund: r.actualRefund,
      createdAt: r.createdAt,
      items: r.returns
    }));

    const formattedStandalone = standaloneReturns.map((sr: any) => ({
      returnRequestId: sr.id,
      orderId: sr.orderId,
      shopifyOrderId: sr.order?.shopifyOrderId || sr.order?.shopifyOrderName || sr.order?.internalOrderNumber || sr.orderId,
      orderCreatedAt: sr.order?.createdAt,
      userId: sr.customerId,
      userName: sr.order?.customer?.name || sr.customer?.name || "Unknown",
      userEmail: sr.order?.customer?.email || sr.customer?.email || "",
      status: sr.status.toLowerCase(),
      estimatedRefund: sr.refundAmount || 0,
      actualRefund: sr.refundAmount || null,
      createdAt: sr.requestedAt || sr.updatedAt,
      isStandalone: true,
      items: [{
        id: sr.id,
        productId: sr.productId,
        sku: sr.sku,
        quantity: sr.quantity || 1,
        reason: sr.reason,
        refundAmount: sr.refundAmount,
        status: sr.status,
        product: sr.product
      }]
    }));

    const combined = [...formattedReturns, ...formattedStandalone].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const statusCounts: Record<string, number> = {};
    
    // Aggregate ReturnRequest status counts
    statusGroups.forEach((g: any) => {
      const s = g.status.toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + g._count.id;
    });

    // Aggregate standalone Return status counts
    standaloneStatusGroups.forEach((g: any) => {
      const s = g.status.toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + g._count.id;
    });

    const paginated = combined.slice(offset, offset + limit);

    return NextResponse.json({
      returns: paginated,
      total: combined.length,
      statusCounts
    });
  } catch (error: any) {
    console.error("Fetch Admin Returns Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, customerId, items, estimatedRefund } = await req.json();

    if (!orderId || !items || !items.length) {
      return NextResponse.json({ error: "Order ID and items are required" }, { status: 400 });
    }

    // Resolve product IDs and metadata for each item
    const resolvedItems = await Promise.all(items.map(async (item: any) => {
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: item.lineItemId }
      });
      
      if (!orderItem) {
        throw new Error(`Order item ${item.lineItemId} not found`);
      }

      return {
        productId: orderItem.productId,
        sku: orderItem.sku,
        quantity: item.quantity || orderItem.quantity,
        reason: item.reason || "Admin manual return",
        refundAmount: (orderItem.price * (item.quantity || orderItem.quantity))
      };
    }));

    const returnRequest = await prisma.$transaction(async (tx: any) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId,
          customerId,
          estimatedRefund: parseFloat(estimatedRefund) || resolvedItems.reduce((acc: any, i: any) => acc + i.refundAmount, 0),
          status: 'pending_approval',
          returns: {
            create: resolvedItems.map((item: any) => ({
              productId: item.productId,
              customerId: customerId,
              orderId: orderId,
              sku: item.sku,
              quantity: item.quantity,
              reason: item.reason,
              refundAmount: item.refundAmount,
              status: "REQUESTED"
            }))
          }
        },
        include: {
          returns: true
        }
      });

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'return_initiated' }
      });

      return rr;
    });

    return NextResponse.json({ success: true, returnRequest });
  } catch (error: any) {
    console.error("Create Admin Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
