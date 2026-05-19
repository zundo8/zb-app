import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    // In a real app we would verify this token, for now we assume it's valid if passed
    // or fallback to userId provided in body

    const body = await req.json();
    const { orderId, userId, returnItems } = body;

    if (!orderId || !userId || !returnItems || !returnItems.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.customerId !== userId) {
      return NextResponse.json({ error: "Unauthorized: Order does not belong to user" }, { status: 403 });
    }

    const isDelivered = String(order.status || '').toLowerCase() === "delivered" ||
                        String(order.deliveryStatus || '').toLowerCase() === "delivered" ||
                        String(order.status || '').toLowerCase() === "active" ||
                        String(order.status || '').toLowerCase() === "completed";
    if (!isDelivered) {
      return NextResponse.json({ error: "Returns are only available for delivered orders" }, { status: 400 });
    }

    let estimatedRefund = 0;
    const itemsToReturn = [];

    for (const returnItem of returnItems) {
      const orderItem = order.items.find((item: any) => item.id === returnItem.orderItemId);
      if (!orderItem) continue;

      const itemRefund = orderItem.price * returnItem.quantity;
      estimatedRefund += itemRefund;

      itemsToReturn.push({
        productId: orderItem.productId,
        orderId: order.id,
        customerId: userId,
        sku: orderItem.sku,
        reason: returnItem.reason,
        status: "REQUESTED",
        refundAmount: itemRefund,
        comments: returnItem.comments
      });
    }

    // Create the ReturnRequest
    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        customerId: userId,
        status: "pending_approval",
        estimatedRefund,
        returns: {
          create: itemsToReturn.map((item: any) => ({
            productId: item.productId!,
            customerId: item.customerId,
            orderId: item.orderId,
            sku: item.sku,
            reason: item.comments ? `${item.reason} - ${item.comments}` : item.reason,
            status: item.status,
            refundAmount: item.refundAmount
          }))
        }
      },
      include: {
        returns: true
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "return_initiated" }
    });

    return NextResponse.json({
      returnRequestId: returnRequest.id,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
      estimatedRefund: returnRequest.estimatedRefund,
      createdAt: returnRequest.createdAt,
      items: returnRequest.returns
    });
  } catch (error: any) {
    console.error("Create Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
