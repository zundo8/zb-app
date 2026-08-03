import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('user_id');
    
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user ? (session.user as any).id : null;
    const sessionEmail = session?.user?.email;

    if (!sessionUserId && !userIdParam) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { id: userIdParam || "" },
                { id: sessionUserId || "" },
                { email: sessionEmail || "" }
            ]
        }
    });

    if (!customer) {
        return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: { 
        customerId: customer.id,
        NOT: {
          OR: [
            { status: { in: ['failed', 'FAILED', 'payment_failed', 'payment_pending', 'CANCELLED', 'cancelled'] } },
            { paymentStatus: { in: ['failed', 'cancelled', 'voided', 'FAILED', 'CANCELLED'] } },
            {
              AND: [
                { paymentStatus: { notIn: ['paid', 'cod_upfront_paid', 'partially_paid', 'refunded', 'partially_refunded', 'PAID', 'SUCCESS', 'success'] } },
                { paymentMethod: { notIn: ['COD', 'cod', 'Cash on Delivery', 'cash_on_delivery'] } }
              ]
            }
          ]
        }
      },
      include: { 
        items: {
          include: {
            product: true
          }
        }, 
        shipments: true,
        returnRequests: {
          include: { returns: true }
        },
        exchangeRequests: {
          include: { exchanges: { include: { newProduct: true, originalProduct: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Match each order with its corresponding webStoreOrder if any and compute eligibility
    const enrichedOrders = await Promise.all(
      orders.map(async (order: any) => {
        let webStoreOrder = null;
        if (order.razorpayOrderId) {
          webStoreOrder = await prisma.webStoreOrder.findFirst({
            where: { razorpayOrderId: order.razorpayOrderId }
          });
        }
        if (!webStoreOrder) {
          webStoreOrder = await prisma.webStoreOrder.findFirst({
            where: {
              notes: {
                contains: `Local: ${order.id}`
              }
            }
          });
        }
        if (!webStoreOrder && order.shopifyOrderId) {
          webStoreOrder = await prisma.webStoreOrder.findFirst({
            where: {
              notes: {
                contains: `Shopify: ${order.shopifyOrderId}`
              }
            }
          });
        }
        
        const orderNumber = webStoreOrder?.orderNumber || (order.shopifyOrderId && !order.shopifyOrderId.startsWith('app_pending_') ? order.shopifyOrderId : `#ZB${order.id.slice(-5).toUpperCase()}`);
        
        // Filter out auto-created internal exchange returns from customer view
        const userReturnRequests = (order.returnRequests || []).filter((r: any) => !r.reason || !r.reason.includes('EXCHANGE_RETURN'));
        const userExchangeRequests = order.exchangeRequests || [];

        const activeReturn = userReturnRequests.find((r: any) => r.status !== 'cancelled');
        const activeExchange = userExchangeRequests.find((e: any) => e.status !== 'cancelled');
        const hasActiveRequest = !!(activeReturn || activeExchange);

        const isDelivered = String(order.deliveryStatus || order.status || '').toLowerCase() === 'delivered';
        const deliveredTimestamp = order.deliveredAt || order.createdAt;
        const diffDays = isDelivered ? Math.ceil(Math.abs(Date.now() - new Date(deliveredTimestamp).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const isWithin15Days = isDelivered && diffDays <= 15;
        const isEligible = isWithin15Days && !hasActiveRequest;
        const remainingDays = Math.max(0, 15 - diffDays);

        return {
          ...order,
          orderNumber,
          userReturnRequests,
          userExchangeRequests,
          activeReturn: activeReturn || null,
          activeExchange: activeExchange || null,
          hasActiveRequest,
          isDelivered,
          isWithin15Days,
          isEligible,
          remainingDays
        };
      })
    );

    return NextResponse.json({ orders: enrichedOrders });
  } catch (error: any) {
    console.error("Fetch Orders Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
