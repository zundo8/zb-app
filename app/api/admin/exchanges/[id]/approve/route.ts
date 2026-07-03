import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { action } = body;

    if (action && action !== "approve") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: {
        exchanges: { include: { newProduct: true, originalProduct: true } },
        order: { include: { items: true, customer: true, shop: true } }
      }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    if (exchangeRequest.status !== "pending_approval") {
      return NextResponse.json({ error: "Exchange request is not pending approval" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create a ReturnRequest for the original items (customer needs to send them back)
      const returnItemsData = exchangeRequest.exchanges.map((ex: any) => {
        // Find the matching order item for the original product
        const orderItem = exchangeRequest.order.items.find(
          (oi: any) => oi.productId === ex.originalProductId
        );
        return {
          productId: ex.originalProductId,
          customerId: exchangeRequest.customerId,
          orderId: exchangeRequest.orderId,
          sku: orderItem?.sku || ex.originalProduct?.sku || "",
          reason: ex.reason || exchangeRequest.reason || "Exchange - returning original item",
          status: "APPROVED",
          refundAmount: 0, // No refund — this is an exchange
        };
      });

      const estimatedRefund = 0; // No refund for exchange returns

      const returnRequest = await tx.returnRequest.create({
        data: {
          orderId: exchangeRequest.orderId,
          customerId: exchangeRequest.customerId,
          status: "approved",
          estimatedRefund,
          actualRefund: 0,
          approvedAt: new Date(),
          reason: `Auto-created return for exchange #${id.slice(0, 8)}`,
          returns: {
            create: returnItemsData
          }
        },
        include: { returns: true }
      });

      // 2. Create a reverse shipment for the return pickup
      const reverseAwb = `ZBEXR${String(Math.floor(100000 + Math.random() * 900000))}`;
      await tx.shipment.create({
        data: {
          orderId: exchangeRequest.orderId,
          awb: reverseAwb,
          trackingNumber: reverseAwb,
          courier: "Delhivery",
          status: "pickup_pending",
          trackingUrl: `https://www.delhivery.com/track/package/${reverseAwb}`,
          rawDelhiveryResponse: JSON.stringify({
            success: true,
            pickup_pending: true,
            message: "Exchange reverse pickup order registered."
          })
        }
      });

      // 3. Create a new local order for the replacement products
      const newOrderShopifyId = `EXC-${exchangeRequest.order.shopifyOrderId}-${Date.now()}`;
      const newItems = exchangeRequest.exchanges.map((ex: any) => ({
        shopifyLineItemId: `EXC-ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        productId: ex.newProductId,
        title: ex.newProduct?.title || "Exchange Replacement",
        quantity: 1,
        price: ex.newProduct?.price || 0,
        sku: ex.newProduct?.sku || ""
      }));

      const newOrder = await tx.order.create({
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
          note: `Exchange from order #${exchangeRequest.order.shopifyOrderId}. ${exchangeRequest.exchanges.map((ex: any) => `${ex.originalProduct?.title} → ${ex.newProduct?.title}`).join(', ')}`,
          items: {
            create: newItems
          }
        }
      });

      // 4. Update the ExchangeRequest status & link to the return
      const updatedRequest = await tx.exchangeRequest.update({
        where: { id },
        data: {
          status: "approved",
          returnRequestId: returnRequest.id,
        }
      });

      // 5. Update individual exchange items
      await tx.exchange.updateMany({
        where: { exchangeRequestId: id },
        data: {
          status: "APPROVED",
          newOrderId: newOrder.id
        }
      });

      // 6. Update original order status
      await tx.order.update({
        where: { id: exchangeRequest.orderId },
        data: { status: "exchange_approved" }
      });

      return {
        exchangeRequest: updatedRequest,
        newOrderId: newOrder.id,
        returnRequestId: returnRequest.id,
      };
    });

    console.log(`✅ Exchange ${id} approved. Return created: ${result.returnRequestId}, New order: ${result.newOrderId}`);

    // SKU lifecycle tracking: mark original item SKUs as EXCHANGED
    try {
      const { markSkuStatus } = await import('@/lib/services/skuService');
      for (const ex of exchangeRequest.exchanges) {
        // Find the original item's SKU from the order items
        const orderItem = exchangeRequest.order.items.find(
          (oi: any) => oi.productId === ex.originalProductId
        );
        const sku = orderItem?.sku || (ex as any).originalProduct?.sku;
        if (sku) {
          await markSkuStatus(sku, 'EXCHANGED', 'EXCHANGE_OUT', 'Admin (Exchange Approve)');
        }
      }
    } catch (skuErr) {
      console.error('[Exchange Approve] SKU status update failed:', skuErr);
    }

    return NextResponse.json({
      success: true,
      newOrderId: result.newOrderId,
      returnRequestId: result.returnRequestId,
      exchangeRequest: result.exchangeRequest
    });
  } catch (error: any) {
    console.error("Approve Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
