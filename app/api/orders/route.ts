import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
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
      where: { customerId: customer.id },
      include: { 
        items: {
          include: {
            product: true
          }
        }, 
        shipments: true 
      },
      orderBy: { createdAt: "desc" },
    });

    // Match each order with its corresponding webStoreOrder if any
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
        return {
          ...order,
          orderNumber,
        };
      })
    );

    return NextResponse.json({ orders: enrichedOrders });
  } catch (error: any) {
    console.error("Fetch Orders Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
