import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createOrder } from "@/lib/shopify-admin";

/**
 * POST /api/admin/exchanges/[id]/create-order
 * Creates a Shopify order with ₹0 amount for the exchange replacement.
 * This is called after QC passes and the admin confirms.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: {
        exchanges: {
          include: { newProduct: true, originalProduct: true }
        },
        order: {
          include: { customer: true, shop: true, items: true }
        }
      }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    if (!["qc_passed", "received", "approved"].includes(exchangeRequest.status)) {
      return NextResponse.json({ error: "Exchange must pass QC before creating Shopify order" }, { status: 400 });
    }

    // Build the Shopify order payload
    const customer = exchangeRequest.order.customer;
    let shippingAddress: any = null;
    try {
      shippingAddress = exchangeRequest.order.shippingAddress 
        ? JSON.parse(exchangeRequest.order.shippingAddress)
        : null;
    } catch {
      // shippingAddress might not be JSON
    }

    // Build line items from exchange replacement products
    const lineItems = exchangeRequest.exchanges.map((ex: any) => {
      const newProduct = ex.newProduct;
      return {
        title: newProduct?.title || "Exchange Replacement",
        quantity: 1,
        price: "0.00", // Zero amount since it's an exchange
        sku: newProduct?.sku || "",
        requires_shipping: true,
      };
    });

    // Build the Shopify order
    const shopifyOrderPayload: any = {
      line_items: lineItems,
      financial_status: "paid",
      fulfillment_status: null,
      note: `Exchange order for original order #${exchangeRequest.order.shopifyOrderId}. Items: ${exchangeRequest.exchanges.map((ex: any) => `${ex.originalProduct?.title} → ${ex.newProduct?.title}`).join(', ')}`,
      tags: `exchange,exchange-order,original-order-${exchangeRequest.order.shopifyOrderId}`,
      total_discounts: "0.00",
      send_receipt: true,
      send_fulfillment_receipt: true,
    };

    // Add customer info if available
    if (customer?.shopifyId) {
      shopifyOrderPayload.customer = {
        id: parseInt(customer.shopifyId, 10)
      };
    } else if (customer?.email) {
      shopifyOrderPayload.email = customer.email;
    }

    // Add shipping address
    if (shippingAddress && typeof shippingAddress === 'object') {
      shopifyOrderPayload.shipping_address = shippingAddress;
    }

    let shopifyOrder: any = null;
    let shopifyOrderId: string | null = null;

    try {
      shopifyOrder = await createOrder(shopifyOrderPayload);
      shopifyOrderId = shopifyOrder?.id?.toString() || shopifyOrder?.name || null;
      console.log(`✅ Shopify exchange order created: ${shopifyOrderId}`);
    } catch (shopifyError: any) {
      console.error("⚠️ Shopify order creation failed:", shopifyError.message);
      // Don't fail entirely — still update local DB
    }

    // Update the exchange request with the new Shopify order
    const updatedRequest = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.exchangeRequest.update({
        where: { id },
        data: {
          status: "new_order_created",
          newShopifyOrderId: shopifyOrderId,
        }
      });

      // Update individual exchange items
      await tx.exchange.updateMany({
        where: { exchangeRequestId: id },
        data: {
          status: "NEW_ORDER_CREATED",
          newOrderId: shopifyOrderId,
        }
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      shopifyOrderId,
      shopifyOrder: shopifyOrder ? {
        id: shopifyOrder.id,
        name: shopifyOrder.name,
        order_number: shopifyOrder.order_number,
        total_price: shopifyOrder.total_price,
      } : null,
      exchangeRequest: updatedRequest
    });
  } catch (error: any) {
    console.error("Create Exchange Shopify Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
