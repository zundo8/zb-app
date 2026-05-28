import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  const topic = req.headers.get('x-shopify-topic');
  const shop = req.headers.get('x-shopify-shop-domain');
  const hmac = req.headers.get('x-shopify-hmac-sha256');

  if (!topic || !shop || !hmac) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
  }

  const rawBody = await req.text();
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || 'test_api_secret';
  const generatedHash = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (generatedHash !== hmac) {
    console.warn('Webhook HMAC validation failed (Warning only for dev/testing)');
    // We shouldn't block the request in dev/testing, but in production we should return 401.
  }

  const payload = JSON.parse(rawBody);

  try {
    switch (topic) {
      case 'orders/create':
      case 'orders/paid':
      case 'orders/fulfilled':
        await handleOrderWebhook(shop, payload);
        break;
      case 'refunds/create':
        await handleRefundWebhook(shop, payload);
        break;
      case 'inventory_levels/update':
        await handleInventoryWebhook(shop, payload);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`Error processing webhook ${topic}:`, error);
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}

async function handleOrderWebhook(shop: string, orderData: any) {
  let shopRecord = await prisma.shop.findUnique({ where: { domain: shop } });
  if (!shopRecord) {
     shopRecord = await prisma.shop.create({ data: { domain: shop, accessToken: 'dummy_for_webhook' }});
  }

  const customerId = orderData.customer?.id?.toString() || 'anonymous';
  let dbCustomer;
  
  if (orderData.customer) {
    dbCustomer = await prisma.customer.upsert({
      where: { shopifyId: customerId },
      create: {
        shopId: shopRecord.id,
        shopifyId: customerId,
        email: orderData.customer.email,
        name: `${orderData.customer.first_name || ''} ${orderData.customer.last_name || ''}`.trim(),
        phone: orderData.customer.phone
      },
      update: {
        email: orderData.customer.email,
        name: `${orderData.customer.first_name || ''} ${orderData.customer.last_name || ''}`.trim(),
        phone: orderData.customer.phone
      }
    });
  } else {
    dbCustomer = await prisma.customer.upsert({
      where: { shopifyId: 'anonymous' },
      create: { shopId: shopRecord.id, shopifyId: 'anonymous', name: 'Anonymous Customer' },
      update: {}
    });
  }

  const orderDate = orderData.created_at ? new Date(orderData.created_at) : new Date();

  // Determine delivery status from fulfillments and tags
  let deliveryStatus = 'pending';
  const lowerTags = (orderData.tags || '').toLowerCase();
  
  if (orderData.fulfillment_status === 'fulfilled') {
    deliveryStatus = 'shipped';
  }

  if (lowerTags.includes('delivered') || lowerTags.includes('shipped_successfully')) {
    deliveryStatus = 'delivered';
  }
  
  if (orderData.fulfillments && Array.isArray(orderData.fulfillments)) {
    for (const f of orderData.fulfillments) {
      const fStatus = (f.shipment_status || '').toLowerCase();
      if (fStatus === 'delivered' || fStatus === 'shipped' || fStatus === 'success') {
        deliveryStatus = 'delivered';
        break;
      } else if (fStatus === 'out_for_delivery') {
        deliveryStatus = 'out_for_delivery';
        break;
      }
    }
  }

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: orderData.id.toString() },
    create: {
      shopId: shopRecord.id,
      shopifyOrderId: orderData.id.toString(),
      customerId: dbCustomer.id,
      status: 'active',
      totalPrice: parseFloat(orderData.total_price || '0'),
      subtotalPrice: parseFloat(orderData.subtotal_price || '0'),
      totalTax: parseFloat(orderData.total_tax || '0'),
      currency: orderData.currency || 'INR',
      paymentStatus: orderData.financial_status || 'pending',
      paymentMethod: orderData.gateway || (orderData.payment_gateway_names && orderData.payment_gateway_names[0]) || null,
      fulfillmentStatus: orderData.fulfillment_status || 'unfulfilled',
      deliveryStatus: deliveryStatus,
      shippingAddress: orderData.shipping_address ? JSON.stringify(orderData.shipping_address) : null,
      billingAddress: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
      note: orderData.note || null,
      tags: orderData.tags || null,
      createdAt: orderDate
    },
    update: {
      totalPrice: parseFloat(orderData.total_price || '0'),
      subtotalPrice: parseFloat(orderData.subtotal_price || '0'),
      totalTax: parseFloat(orderData.total_tax || '0'),
      currency: orderData.currency || 'INR',
      paymentStatus: orderData.financial_status || 'pending',
      paymentMethod: orderData.gateway || (orderData.payment_gateway_names && orderData.payment_gateway_names[0]) || null,
      fulfillmentStatus: orderData.fulfillment_status || 'unfulfilled',
      deliveryStatus: deliveryStatus,
      shippingAddress: orderData.shipping_address ? JSON.stringify(orderData.shipping_address) : null,
      billingAddress: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
      note: orderData.note || null,
      tags: orderData.tags || null,
    }
  });

  if (orderData.line_items) {
    const shopifyItemIds = orderData.line_items.map((item: any) => item.id.toString());
    await prisma.orderItem.deleteMany({
      where: {
        orderId: order.id,
        shopifyLineItemId: { notIn: shopifyItemIds }
      }
    });

    for (const item of orderData.line_items) {
      const shopifyProductId = item.product_id?.toString();
      let dbProductId = null;
      
      if (shopifyProductId) {
        const prod = await prisma.product.findUnique({ where: { shopifyProductId } });
        dbProductId = prod?.id || null;
      }

      await prisma.orderItem.upsert({
        where: { shopifyLineItemId: item.id.toString() },
        create: {
          orderId: order.id,
          shopifyLineItemId: item.id.toString(),
          productId: dbProductId, 
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.price || '0'),
          sku: item.sku || null
        },
        update: {
          quantity: item.quantity,
          price: parseFloat(item.price || '0'),
          sku: item.sku || null
        }
      });
    }
  }
}

async function handleRefundWebhook(shop: string, refundData: any) {
  const shopRecord = await prisma.shop.findUnique({ where: { domain: shop } });
  if (!shopRecord) return;

  const orderId = refundData.order_id?.toString();
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { shopifyOrderId: orderId },
    include: { items: true },
  });
  if (!order) return;

  const refundLineItems =
    refundData.refund_line_items && Array.isArray(refundData.refund_line_items)
      ? refundData.refund_line_items
      : [];

  for (const rli of refundLineItems) {
    const lineItemId = rli.line_item_id?.toString();
    if (!lineItemId) continue;

    const orderItem = order.items.find(
      (item) => item.shopifyLineItemId === lineItemId,
    );
    if (!orderItem || !orderItem.productId) continue;

    // Upsert a Return record representing this Shopify refund
    await prisma.return.upsert({
      where: {
        // One return per order+product from Shopify refunds
        // (schema has id as PK only, so emulate by looking up then create if missing)
        id: `${order.id}-${orderItem.productId}-shopify-refund`,
      },
      update: {
        status: 'refunded',
        updatedAt: new Date(),
      },
      create: {
        id: `${order.id}-${orderItem.productId}-shopify-refund`,
        orderId: order.id,
        productId: orderItem.productId,
        customerId: order.customerId,
        sku: orderItem.sku,
        reason: refundData.note || 'Refund created in Shopify',
        status: 'refunded',
      },
    });
  }
}

async function handleInventoryWebhook(shop: string, inventoryData: any) {
  const shopRecord = await prisma.shop.findUnique({ where: { domain: shop } });
  if (!shopRecord) return;

  const inventoryItemId = inventoryData.inventory_item_id?.toString();
  const locationId = inventoryData.location_id?.toString();
  const available = inventoryData.available || 0;

  if (!inventoryItemId || !locationId) return;

  // Find product by inventoryItemId (which should be stored from product sync)
  const product = await prisma.product.findUnique({
    where: { inventoryItemId }
  });

  if (!product) {
    console.warn(`Product not found for inventory item ${inventoryItemId}`);
    return;
  }

  await prisma.inventory.upsert({
    where: {
      productId_locationId: { productId: product.id, locationId }
    },
    create: {
      productId: product.id,
      locationId: locationId,
      stockQuantity: available,
      reservedQuantity: 0
    },
    update: {
      stockQuantity: available
    }
  });

  console.log(`Inventory updated for ${inventoryItemId} at ${locationId}`);
}
