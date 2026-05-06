import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('user_id');

    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user ? (session.user as any).id : null;
    const sessionEmail = session?.user?.email;

    if (!sessionUserId && !userIdParam) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        items: {
          include: {
            product: true
          }
        }, 
        shipments: true,
        customer: true,
        returnRequests: true,
        exchangeRequests: true
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Security check: Ensure the order belongs to the requester
    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { id: userIdParam || "" },
                { id: sessionUserId || "" },
                { email: sessionEmail || "" }
            ]
        }
    });

    if (!customer || order.customerId !== customer.id) {
       return NextResponse.json({ error: "Unauthorized access to order" }, { status: 403 });
    }

    // Enrich order with tracking data from the latest shipment
    const latestShipment = order.shipments?.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    const enrichedOrder = {
      ...order,
      trackingNumber: latestShipment?.trackingNumber || null,
      trackingUrl: latestShipment?.trackingUrl || null,
      trackingStatus: latestShipment?.status || null,
      currentLocation: latestShipment?.currentLocation || null,
      estimatedDelivery: latestShipment?.estimatedDelivery || null,
      trackingEvents: latestShipment?.events ? JSON.parse(latestShipment.events) : [],
      courier: latestShipment?.courier || null,
      // Build timeline for the TrackingStepper component
      timeline: latestShipment?.events ? 
        JSON.parse(latestShipment.events).reduce((acc: any, event: any) => {
          acc[event.status] = event.timestamp;
          return acc;
        }, {}) : {},
    };

    return NextResponse.json({ order: enrichedOrder });
  } catch (error: any) {
    console.error("Fetch Single Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
