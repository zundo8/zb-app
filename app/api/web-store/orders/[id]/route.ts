import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Fetch details of a single web store order
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await prisma.webStoreOrder.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error("[Web Store Single Order GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update order details (fulfillment, tracking, notes, payment status)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fulfillmentStatus,
      trackingNumber,
      trackingUrl,
      paymentStatus,
      notes
    } = body;

    // Check if order exists
    const order = await prisma.webStoreOrder.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build update object dynamically based on provided fields
    const data: any = {};
    if (fulfillmentStatus !== undefined) data.fulfillmentStatus = fulfillmentStatus;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus;
    if (notes !== undefined) data.notes = notes;

    const updatedOrder = await prisma.webStoreOrder.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error("[Web Store Single Order PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
