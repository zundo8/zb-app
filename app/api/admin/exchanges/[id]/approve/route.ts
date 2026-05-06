import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { action } = body;

    if (action !== "approve") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: {
        exchanges: { include: { newProduct: true } },
        order: { include: { items: true } }
      }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    // Automatically create a new order (Order 2) with the replacement products
    const newOrderShopifyId = `EXC-${exchangeRequest.order.shopifyOrderId}-${Date.now()}`;
    
    // Create new order items
    const newItems = exchangeRequest.exchanges.map((ex: any) => ({
      shopifyLineItemId: `EXC-ITEM-${Date.now()}-${Math.random()}`,
      productId: ex.newProductId,
      title: ex.newProduct?.title || "Exchange Replacement",
      quantity: 1, // simplified
      price: ex.newProduct?.price || 0,
      sku: ex.newProduct?.sku || ""
    }));

    const newOrder = await prisma.order.create({
      data: {
        shopId: exchangeRequest.order.shopId,
        shopifyOrderId: newOrderShopifyId,
        customerId: exchangeRequest.customerId,
        status: "confirmed",
        orderType: "EXCHANGE",
        totalPrice: exchangeRequest.priceDifference > 0 ? exchangeRequest.priceDifference : 0,
        paymentStatus: exchangeRequest.priceDifference > 0 ? "paid" : "free",
        fulfillmentStatus: "unfulfilled",
        shippingAddress: exchangeRequest.order.shippingAddress,
        billingAddress: exchangeRequest.order.billingAddress,
        items: {
          create: newItems
        }
      }
    });

    const updatedRequest = await prisma.exchangeRequest.update({
      where: { id },
      data: {
        status: "approved"
      }
    });

    // Update the individual exchange items
    await prisma.exchange.updateMany({
      where: { exchangeRequestId: id },
      data: { 
        status: "APPROVED",
        newOrderId: newOrder.id
      }
    });

    // Update original order status
    await prisma.order.update({
      where: { id: exchangeRequest.orderId },
      data: { status: "exchange_approved" }
    });

    return NextResponse.json({
      success: true,
      newOrderId: newOrder.id,
      exchangeRequest: updatedRequest
    });
  } catch (error: any) {
    console.error("Approve Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
