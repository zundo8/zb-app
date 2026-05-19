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
      include: { items: { include: { product: true } } }
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
      if (!orderItem) {
        return NextResponse.json({ error: `Order item ${item.orderItemId} not found` }, { status: 404 });
      }

      // Resolve original product ID — handle null productId gracefully
      let originalProductId = orderItem.productId;
      if (!originalProductId) {
        // Try to find a product by matching title or SKU
        if (orderItem.sku) {
          const matchedProduct = await prisma.product.findFirst({
            where: { sku: orderItem.sku }
          });
          if (matchedProduct) originalProductId = matchedProduct.id;
        }
        if (!originalProductId) {
          // Try by title match as last resort
          const matchedProduct = await prisma.product.findFirst({
            where: { title: orderItem.title }
          });
          if (matchedProduct) originalProductId = matchedProduct.id;
        }
        if (!originalProductId) {
          return NextResponse.json({
            error: `Cannot resolve product for order item "${orderItem.title}". Product association is missing.`
          }, { status: 400 });
        }
      }

      // Find the replacement product
      const newProduct = await prisma.product.findUnique({
        where: { id: item.replacementProductId }
      });

      if (!newProduct) {
        return NextResponse.json({ error: `Replacement product ${item.replacementProductId} not found` }, { status: 404 });
      }

      // Calculate the price difference for this item
      const originalPrice = orderItem.price || 0;
      const newPrice = newProduct.price || 0;
      const itemDiff = (newPrice - originalPrice) * (item.quantity || 1);
      calculatedPriceDifference += itemDiff;

      itemsToExchange.push({
        originalProductId,
        newProductId: item.replacementProductId,
        status: "REQUESTED",
        priceDifference: itemDiff,
        reason: item.reason || "Customer exchange request"
      });
    }

    // Use calculated price difference, fall back to client-provided if available
    const finalPriceDifference = calculatedPriceDifference || paymentDetails?.priceDifference || 0;

    // If positive diff, require payment
    if (finalPriceDifference > 0) {
      if (!paymentDetails || !paymentDetails.paymentId) {
        return NextResponse.json({ error: "Payment required for price difference" }, { status: 400 });
      }
    }

    const paymentStatus = finalPriceDifference > 0 ? "paid" : "not_required";

    const exchangeRequest = await prisma.exchangeRequest.create({
      data: {
        orderId,
        customerId: userId,
        status: "pending_approval",
        priceDifference: finalPriceDifference,
        paymentStatus,
        paymentId: paymentDetails?.paymentId,
        reason: exchangeItems[0]?.reason || "Exchange request",
        exchanges: {
          create: itemsToExchange.map((item: any) => ({
            originalProductId: item.originalProductId,
            newProductId: item.newProductId,
            orderId,
            status: item.status,
            priceDifference: item.priceDifference,
            paymentStatus,
            reason: item.reason
          }))
        }
      },
      include: {
        exchanges: {
          include: { originalProduct: true, newProduct: true }
        }
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
