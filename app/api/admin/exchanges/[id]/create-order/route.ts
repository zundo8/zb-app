import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createOrder } from "@/lib/shopify-admin";
import { issueStoreCredits } from "@/lib/storeCreditsHelper";
import { createDelhiveryShipment, fetchWaybill } from "@/lib/delhivery";

/**
 * POST /api/admin/exchanges/[id]/create-order
 * Creates the replacement Shopify+local order, handles COD/Prepaid/Store Credit,
 * and generates a forward Delhivery shipment with AWB.
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

    // Idempotency check: if order already created, return existing
    if (exchangeRequest.status === "new_order_created" && exchangeRequest.newShopifyOrderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { shopifyOrderId: exchangeRequest.newShopifyOrderId }
      });
      return NextResponse.json({
        success: true,
        message: "Order already created for this exchange",
        shopifyOrderId: exchangeRequest.newShopifyOrderId,
        localOrderId: existingOrder?.id || null,
        exchangeRequest
      });
    }

    if (!["qc_passed", "received", "approved"].includes(exchangeRequest.status)) {
      return NextResponse.json({ error: `Exchange must pass QC before creating replacement order. Current status: ${exchangeRequest.status}` }, { status: 400 });
    }

    const priceDiff = exchangeRequest.priceDifference || 0;
    const isCod = exchangeRequest.settlementPreference === "COD_ON_DELIVERY" && priceDiff > 0;
    const orderTotalAmount = priceDiff > 0 ? priceDiff : 0;
    const isNegativeDiff = priceDiff < 0;
    const negativeDiffAmount = Math.abs(priceDiff);

    let paymentStatus = "free";
    if (priceDiff > 0) {
      paymentStatus = isCod ? "cod_pending" : "paid";
    }

    // Build the Shopify order payload
    const customer = exchangeRequest.order.customer;
    let shippingAddress: any = null;
    try {
      shippingAddress = exchangeRequest.order.shippingAddress 
        ? JSON.parse(exchangeRequest.order.shippingAddress)
        : null;
    } catch (_) {}

    const lineItems = exchangeRequest.exchanges.map((ex: any) => {
      const newProduct = ex.newProduct;
      return {
        title: newProduct?.title || "Exchange Replacement",
        quantity: 1,
        price: orderTotalAmount > 0 ? (orderTotalAmount / exchangeRequest.exchanges.length).toFixed(2) : "0.00",
        sku: newProduct?.sku || "",
        requires_shipping: true,
      };
    });

    const shopifyOrderPayload: any = {
      line_items: lineItems,
      financial_status: paymentStatus === "paid" ? "paid" : "pending",
      fulfillment_status: null,
      note: `Exchange replacement for original order #${exchangeRequest.order.shopifyOrderId || exchangeRequest.orderId}. Settlement: ${exchangeRequest.settlementPreference}`,
      tags: `exchange,exchange-order,original-order-${exchangeRequest.order.shopifyOrderId || exchangeRequest.orderId}${isCod ? ',COD' : ''}`,
      total_discounts: "0.00",
      send_receipt: true,
      send_fulfillment_receipt: true,
    };

    if (customer?.shopifyId) {
      shopifyOrderPayload.customer = { id: parseInt(customer.shopifyId, 10) };
    } else if (customer?.email) {
      shopifyOrderPayload.email = customer.email;
    }

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
        error: `Shopify order creation failed: ${shopifyError.message}. Please verify product availability before retrying.`
      }, { status: 502 });
    }

    if (!shopifyOrderId) {
      return NextResponse.json({ error: "Shopify order creation returned no order ID." }, { status: 500 });
    }

    // Execute local order creation, exchange status update, and store credit issuance transactionally
    const result = await prisma.$transaction(async (tx: any) => {
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

      // 1. Local Order creation
      const localOrder = await tx.order.create({
        data: {
          shopId: exchangeRequest.order.shopId,
          shopifyOrderId: shopifyOrderId,
          customerId: exchangeRequest.customerId,
          status: "confirmed",
          orderType: "EXCHANGE",
          totalPrice: orderTotalAmount,
          paymentStatus: paymentStatus,
          fulfillmentStatus: "unfulfilled",
          shippingAddress: exchangeRequest.order.shippingAddress,
          billingAddress: exchangeRequest.order.billingAddress,
          note: `Exchange replacement order for #${exchangeRequest.order.shopifyOrderId}`,
          items: {
            create: newItems
          }
        }
      });

      // 2. Issue Store Credit for negative difference if applicable
      let storeCreditRecord = null;
      if (isNegativeDiff && negativeDiffAmount > 0) {
        storeCreditRecord = await tx.storeCredit.create({
          data: {
            customerId: exchangeRequest.customerId,
            amount: negativeDiffAmount,
            type: "exchange_adjustment",
            description: `Store credit issued for exchange adjustment on order #${exchangeRequest.order.shopifyOrderId || exchangeRequest.orderId}`,
            orderId: localOrder.id,
            remainingAmount: negativeDiffAmount,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1-year expiry
          }
        });

        await tx.customer.update({
          where: { id: exchangeRequest.customerId },
          data: {
            storeCredits: {
              increment: negativeDiffAmount
            }
          }
        });
      }

      // 3. Update ExchangeRequest status
      const updatedRequest = await tx.exchangeRequest.update({
        where: { id },
        data: {
          status: "new_order_created",
          newShopifyOrderId: shopifyOrderId,
        }
      });

      // 4. Update individual exchange items
      await tx.exchange.updateMany({
        where: { exchangeRequestId: id },
        data: {
          status: "NEW_ORDER_CREATED",
          newOrderId: localOrder.id,
        }
      });

      return {
        updatedRequest,
        localOrderId: localOrder.id,
        storeCreditIssued: negativeDiffAmount
      };
    });

    // 5. Create Forward Delhivery Shipment for the replacement order
    let forwardAwb: string | null = null;
    let forwardShipmentStatus = 'manifested';
    let delhiveryShipmentRaw: any = null;

    try {
      let addrObj: any = {};
      const shippingRaw = exchangeRequest.order.shippingAddress;
      if (typeof shippingRaw === 'string') {
        try { addrObj = JSON.parse(shippingRaw); } catch (_) { addrObj = { add: shippingRaw }; }
      } else if (shippingRaw && typeof shippingRaw === 'object') {
        addrObj = shippingRaw;
      }

      const name = addrObj.name || (addrObj.first_name ? `${addrObj.first_name} ${addrObj.last_name || ''}`.trim() : customer?.name || 'Customer');
      const add = addrObj.add || addrObj.address1 || addrObj.street || addrObj.fullAddress || (typeof shippingRaw === 'string' ? shippingRaw : 'Address Not Specified');
      const pin = addrObj.pin || addrObj.zip || addrObj.pincode || addrObj.postalCode || '110001';
      const phone = addrObj.phone || customer?.phone || '9999999999';
      const prodDesc = exchangeRequest.exchanges.map((ex: any) => ex.newProduct?.sku || 'Replacement Item').join(', ');

      const delhRes = await createDelhiveryShipment({
        name,
        add,
        pin: String(pin),
        phone: String(phone),
        order: shopifyOrderId,
        payment_mode: isCod ? 'COD' : 'Prepaid',
        total_amount: String(orderTotalAmount),
        cod_amount: isCod ? String(priceDiff) : '0',
        products_desc: `Exchange Replacement: ${prodDesc}`,
        weight: '500',
        shipping_mode: 'Surface',
        seller_name: 'Zica Bella',
      }, process.env.DELHIVERY_PICKUP_LOCATION || 'Zica Bella Warehouse');

      delhiveryShipmentRaw = delhRes;
      forwardAwb = delhRes?.packages?.[0]?.waybill || delhRes?.packages?.[0]?.wbn || delhRes?.upload_wbn || null;

      if (!forwardAwb) {
        // Fallback waybill fetch
        try {
          const wbData = await fetchWaybill();
          if (wbData?.waybill) forwardAwb = wbData.waybill;
        } catch (_) {}
      }

      if (forwardAwb) {
        await prisma.order.update({
          where: { id: result.localOrderId },
          data: { delhivery_awb: forwardAwb }
        });

        await prisma.shipment.create({
          data: {
            orderId: result.localOrderId,
            awb: forwardAwb,
            trackingNumber: forwardAwb,
            courier: "Delhivery",
            status: forwardShipmentStatus,
            type: "outbound",
            trackingUrl: `https://www.delhivery.com/track/package/${forwardAwb}`,
            rawDelhiveryResponse: JSON.stringify(delhiveryShipmentRaw)
          }
        });
      }
    } catch (shipErr: any) {
      console.error("[Exchange Create Order] Forward Delhivery shipment creation warning:", shipErr.message);
    }

    // 6. Send WhatsApp notification with REAL forward AWB and tracking URL
    try {
      const { sendExchangeShipped } = await import('@/lib/whatsapp/templates');
      let phone = customer?.phone;
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
        const customerName = customer?.name || 'Valued Customer';
        await sendExchangeShipped({
          phone,
          customerName,
          orderId: orderIdDisplay,
          trackingNumber: forwardAwb || shopifyOrderId || 'N/A',
          trackingUrl: forwardAwb ? `https://www.delhivery.com/track/package/${forwardAwb}` : `https://app.zicabella.com/orders/${shopifyOrderId}`,
        });
      }
    } catch (waErr: any) {
      console.error('[Exchange Create Order] WhatsApp notification error:', waErr.message);
    }

    return NextResponse.json({
      success: true,
      shopifyOrderId,
      localOrderId: result.localOrderId,
      forwardAwb,
      storeCreditIssued: result.storeCreditIssued,
      exchangeRequest: result.updatedRequest
    });
  } catch (error: any) {
    console.error("Create Exchange Replacement Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
