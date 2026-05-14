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

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        take: limit,
        skip: offset,
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
      prisma.returnRequest.count({ where })
    ]);

    const formattedReturns = returns.map((r: any) => ({
      returnRequestId: r.id,
      orderId: r.orderId,
      shopifyOrderId: r.order?.shopifyOrderId,
      userId: r.customerId,
      userName: r.order?.customer?.name || "Unknown",
      userEmail: r.order?.customer?.email || "",
      status: r.status,
      estimatedRefund: r.estimatedRefund,
      actualRefund: r.actualRefund,
      createdAt: r.createdAt,
      items: r.returns
    }));

    return NextResponse.json({
      returns: formattedReturns,
      total
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

    const returnRequest = await prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId,
          customerId,
          estimatedRefund: parseFloat(estimatedRefund) || resolvedItems.reduce((acc, i) => acc + i.refundAmount, 0),
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
