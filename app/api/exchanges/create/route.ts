import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, userId, exchangeItems, paymentDetails } = body;

    if (!orderId || !userId || !exchangeItems || !exchangeItems.length) {
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
      return NextResponse.json({ error: "Exchanges are only available for delivered orders" }, { status: 400 });
    }

    let calculatedPriceDifference = 0;
    const itemsToExchange = [];

    for (const item of exchangeItems) {
      const orderItem = order.items.find((oi: any) => oi.id === item.orderItemId);
      if (!orderItem) continue;

      // In a real app we'd fetch the actual replacement product to get its price
      // For now we assume the client calculated it correctly or we'd query it.
      // E.g. const newProduct = await prisma.product.findUnique({ where: { id: item.replacementProductId } })
      
      const newProduct = await prisma.product.findUnique({
        where: { id: item.replacementProductId }
        // We'd need to find the specific variant price here
      });
      
      if (!newProduct) {
        return NextResponse.json({ error: `Replacement product ${item.replacementProductId} not found` }, { status: 404 });
      }

      // Simplified price difference calculation, using passed priceDifference if any
      
      itemsToExchange.push({
        originalProductId: orderItem.productId,
        newProductId: item.replacementProductId,
        status: "REQUESTED",
        priceDifference: paymentDetails?.priceDifference || 0
      });
    }
    
    // In reality, calculate from real db product prices
    calculatedPriceDifference = paymentDetails?.priceDifference || 0;
    
    // If positive diff, require payment
    if (calculatedPriceDifference > 0) {
      if (!paymentDetails || !paymentDetails.paymentId) {
        return NextResponse.json({ error: "Payment required for price difference" }, { status: 400 });
      }
      // verify razorpay payment here...
    }

    const paymentStatus = calculatedPriceDifference > 0 ? "paid" : "not_required";

    const exchangeRequest = await prisma.exchangeRequest.create({
      data: {
        orderId,
        customerId: userId,
        status: "pending_approval",
        priceDifference: calculatedPriceDifference,
        paymentStatus,
        paymentId: paymentDetails?.paymentId,
        exchanges: {
          create: itemsToExchange.map((item: any) => ({
            originalProductId: item.originalProductId!,
            newProductId: item.newProductId,
            status: item.status,
            priceDifference: item.priceDifference,
            paymentStatus
          }))
        }
      },
      include: {
        exchanges: true
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "exchange_initiated" }
    });

    return NextResponse.json({
      exchangeRequestId: exchangeRequest.id,
      orderId: exchangeRequest.orderId,
      status: exchangeRequest.status,
      priceDifference: exchangeRequest.priceDifference,
      paymentStatus: exchangeRequest.paymentStatus,
      createdAt: exchangeRequest.createdAt,
      items: exchangeRequest.exchanges
    });
  } catch (error: any) {
    console.error("Create Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
