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
      return NextResponse.json({
        error: `Shopify order creation failed: ${shopifyError.message}. Please verify product availability and Shopify credentials before retrying.`
      }, { status: 502 });
    }

    if (!shopifyOrderId) {
      return NextResponse.json({
        error: "Shopify order creation returned no order ID."
      }, { status: 500 });
    }

    // Create the real local Order & update the exchange request transactionally
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create real local Order row for replacement items
      const newItems = (shopifyOrder.line_items || []).map((li: any) => {
        const matchingEx = exchangeRequest.exchanges.find((ex: any) => ex.newProduct?.sku === li.sku);
        return {
          shopifyLineItemId: li.id?.toString() || `EXC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          productId: matchingEx?.newProductId || null,
          title: li.title || "Exchange Replacement",
          quantity: li.quantity || 1,
          price: parseFloat(li.price || '0'),
          sku: li.sku || ""
        };
      });

      const localOrder = await tx.order.create({
        data: {
          shopId: exchangeRequest.order.shopId,
          shopifyOrderId: shopifyOrderId,
          customerId: exchangeRequest.customerId,
          status: "confirmed",
          orderType: "EXCHANGE",
          totalPrice: exchangeRequest.priceDifference > 0 ? exchangeRequest.priceDifference : 0,
          paymentStatus: exchangeRequest.priceDifference > 0 ? "paid" : "free",
          fulfillmentStatus: "unfulfilled",
          shippingAddress: exchangeRequest.order.shippingAddress,
          billingAddress: exchangeRequest.order.billingAddress,
          note: `Exchange replacement order for #${exchangeRequest.order.shopifyOrderId}`,
          items: {
            create: newItems
          }
        }
      });

      // 2. Update the exchange request with the new Shopify order ID
      const updatedRequest = await tx.exchangeRequest.update({
        where: { id },
        data: {
          status: "new_order_created",
          newShopifyOrderId: shopifyOrderId,
        }
      });

      // 3. Update individual exchange items with the local Order.id
      await tx.exchange.updateMany({
        where: { exchangeRequestId: id },
        data: {
          status: "NEW_ORDER_CREATED",
          newOrderId: localOrder.id,
        }
      });

      return {
        updatedRequest,
        localOrderId: localOrder.id
      };
    });

    // Auto-send Exchange Item Shipped WhatsApp notification
    try {
      const { sendExchangeShipped } = await import('@/lib/whatsapp/templates');
      const cust = exchangeRequest.order.customer;
      let phone = cust?.phone;
      if (!phone && exchangeRequest.order.shippingAddress) {
        try {
          const parsed = typeof exchangeRequest.order.shippingAddress === 'string'
            ? JSON.parse(exchangeRequest.order.shippingAddress)
            : exchangeRequest.order.shippingAddress;
          phone = parsed?.phone;
        } catch (_) {}
      }
      if (phone) {
        const orderIdDisplay = shopifyOrder?.name || shopifyOrderId;
        const customerName = cust?.name || 'Valued Customer';
        await sendExchangeShipped({
          phone,
          customerName,
          orderId: orderIdDisplay,
          trackingNumber: shopifyOrderId || 'N/A',
          trackingUrl: `https://app.zicabella.com/orders/${shopifyOrderId}`,
        });
      }
    } catch (waErr: any) {
      console.error('[Exchange Create Order] WhatsApp notification error:', waErr.message);
    }

    return NextResponse.json({
      success: true,
      shopifyOrderId,
      localOrderId: result.localOrderId,
      shopifyOrder: shopifyOrder ? {
        id: shopifyOrder.id,
        name: shopifyOrder.name,
        order_number: shopifyOrder.order_number,
        total_price: shopifyOrder.total_price,
      } : null,
      exchangeRequest: result.updatedRequest
    });
  } catch (error: any) {
    console.error("Create Exchange Shopify Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
