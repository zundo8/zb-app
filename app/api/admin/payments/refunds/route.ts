import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const refunds = await prisma.returnRequest.findMany({
      where: {
        status: "approved",
        actualRefund: { not: null },
      },
      include: {
        order: {
          select: {
            shopifyOrderId: true,
            customerId: true,
            customer: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        returns: {
          include: {
            product: true
          }
        }
      },
      orderBy: { updatedAt: "desc" },
    });

    // Format the data for the UI
    const formattedRefunds = refunds.map(r => ({
      id: r.id,
      orderId: r.order.shopifyOrderId,
      customerName: r.order.customer.name,
      customerEmail: r.order.customer.email,
      amount: r.actualRefund,
      status: "COMPLETED", // Since we only fetch approved with actualRefund
      date: r.updatedAt,
      reason: r.reason || "Product Return",
      items: r.returns.map(item => item.product.title).join(", ")
    }));

    return NextResponse.json({ refunds: formattedRefunds });
  } catch (error: any) {
    console.error("Refunds GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
