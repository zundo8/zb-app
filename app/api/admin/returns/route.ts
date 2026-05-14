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

    if (!orderId || !items || items.length === 0) {
      return NextResponse.json({ error: "Order ID and items are required" }, { status: 400 });
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        customerId,
        estimatedRefund: parseFloat(estimatedRefund) || 0,
        status: 'pending_approval',
        returns: {
          create: items.map((item: any) => ({
            productId: item.productId || null, // Optional if we only have lineItemId
            lineItemId: item.lineItemId,
            quantity: item.quantity || 1,
            reason: item.reason || "Admin manual return"
          }))
        }
      },
      include: {
        returns: true
      }
    });

    return NextResponse.json({ success: true, returnRequest });
  } catch (error: any) {
    console.error("Create Admin Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
