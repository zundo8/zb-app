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

    if (!orderId || !items || items.length === 0) {
      return NextResponse.json({ error: "Order ID and items are required" }, { status: 400 });
    }

    const exchangeRequest = await prisma.exchangeRequest.create({
      data: {
        orderId,
        customerId,
        status: 'pending_approval',
        exchanges: {
          create: items.map((item: any) => ({
            originalLineItemId: item.originalLineItemId,
            newVariantId: item.newVariantId,
            reason: item.reason || "Admin manual exchange"
          }))
        }
      },
      include: {
        exchanges: true
      }
    });

    return NextResponse.json({ success: true, exchangeRequest });
  } catch (error: any) {
    console.error("Create Admin Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
