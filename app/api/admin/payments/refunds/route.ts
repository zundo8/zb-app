import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    // Fetch return refunds and cancellation refunds in parallel
    const [returnRefunds, paymentRefunds] = await Promise.all([
      prisma.returnRequest.findMany({
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
      }),
      prisma.payment.findMany({
        where: {
          type: "refund",
          status: "completed",
        },
        include: {
          customer: {
            select: { name: true, email: true }
          },
          order: {
            select: { shopifyOrderId: true }
          }
        },
        orderBy: { createdAt: "desc" },
      })
    ]);

    // Format return refunds
    const formattedReturnRefunds = returnRefunds.map((r: any) => ({
      id: `ret_${r.id}`,
      orderId: r.order.shopifyOrderId,
      customerName: r.order.customer.name,
      customerEmail: r.order.customer.email,
      amount: r.actualRefund || r.estimatedRefund,
      status: "COMPLETED",
      date: r.updatedAt,
      reason: r.reason || "Product Return",
      items: r.returns.map((item: any) => item.product.title).join(", ")
    }));

    // Format payment refunds (order cancellations)
    const formattedPaymentRefunds = paymentRefunds.map((p: any) => ({
      id: `pay_${p.id}`,
      orderId: p.order?.shopifyOrderId || p.orderId,
      customerName: p.customer?.name || "Guest",
      customerEmail: p.customer?.email || "",
      amount: p.amount,
      status: "COMPLETED",
      date: p.createdAt,
      reason: "Order Cancelled",
      items: "Entire Order"
    }));

    // Combine and sort by date descending
    const allRefunds = [...formattedReturnRefunds, ...formattedPaymentRefunds];
    allRefunds.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter by status if provided (all are COMPLETED in this query, but filter is good for compatibility)
    const filteredRefunds = status && status !== "all"
      ? allRefunds.filter((r: any) => r.status.toLowerCase() === status.toLowerCase())
      : allRefunds;

    return NextResponse.json({ refunds: filteredRefunds });
  } catch (error: any) {
    console.error("Refunds GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
