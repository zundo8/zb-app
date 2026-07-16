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
  let verified = false;
  if (process.env.SHOPIFY_API_SECRET) {
    const hash = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(rawBody, 'utf8').digest('base64');
    if (hash === hmac) verified = true;
  }
  if (!verified && process.env.SHOPIFY_WEBHOOK_SECRET) {
    const hash = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET).update(rawBody, 'utf8').digest('base64');
    if (hash === hmac) verified = true;
  }

  if (!verified) {
    console.warn('Webhook HMAC validation failed (Warning only for dev/testing)');
    // If NOT in development and we have configured secrets, reject the request
    if (process.env.NODE_ENV === 'production') {
      console.error('Webhook signature validation failed in production. Blocking request.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);

  try {
    switch (topic) {
      case 'orders/create':
      case 'orders/paid':
      case 'orders/fulfilled':
      case 'orders/cancelled':
        await handleOrderWebhook(shop, payload, topic);
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

async function handleOrderWebhook(shop: string, orderData: any, topic?: string) {
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

  const isMobileAppOrder = lowerTags.includes('apporder') || lowerTags.includes('mobileapp');
  let finalStatus = isMobileAppOrder ? 'approved' : 'active';
  
  if (topic === 'orders/cancelled' || orderData.cancelled_at) {
    finalStatus = 'cancelled';
    deliveryStatus = 'cancelled';
    orderData.fulfillment_status = 'cancelled';
  }

  // Attempt to link order by internalOrderNumber if shopifyOrderId doesn't match
  let existingLocalOrder = await prisma.order.findUnique({
    where: { shopifyOrderId: orderData.id.toString() }
  });

  let extractedNumber = '';
  if (!existingLocalOrder) {
    // 1. Try tags matching
    const tagMatch = (orderData.tags || '').match(/zb-order-(ZB-\d{4}-\d{5})/i);
    if (tagMatch) {
      extractedNumber = tagMatch[1];
    }

    // 2. Try note attributes matching
    if (!extractedNumber && orderData.note_attributes) {
      const attr = orderData.note_attributes.find((na: any) => na.name === 'internal_order_number');
      if (attr && typeof attr.value === 'string' && attr.value.startsWith('ZB-')) {
        extractedNumber = attr.value;
      }
    }

    if (extractedNumber) {
      console.log(`[Webhook] Extracted internal order number: ${extractedNumber}. Searching local database...`);
      const matchedOrder = await prisma.order.findUnique({
        where: { internalOrderNumber: extractedNumber }
      });
      if (matchedOrder) {
        console.log(`[Webhook] Found matching local order ${matchedOrder.id}. Updating shopifyOrderId to ${orderData.id}...`);
        existingLocalOrder = await prisma.order.update({
          where: { id: matchedOrder.id },
          data: {
            shopifyOrderId: orderData.id.toString(),
            shopifyOrderName: orderData.name || null,
            shopifySyncStatus: 'synced',
            shopifySyncError: null
          }
        });

        // Also update corresponding WebStoreOrder or MobileOrder if needed
        if (matchedOrder.orderType === 'WEB_STORE') {
          await prisma.webStoreOrder.updateMany({
            where: { orderNumber: extractedNumber },
            data: {
              notes: `Linked to Shopify: ${orderData.id.toString()} | Local: ${matchedOrder.id}`
            }
          }).catch((e: any) => {
            console.error('[Webhook] Failed to update webStoreOrder notes:', e.message);
          });
        } else if (matchedOrder.orderType === 'MOBILE_APP') {
          await prisma.mobileOrder.updateMany({
            where: { orderNumber: extractedNumber },
            data: {
              shopifyOrderId: orderData.id.toString(),
              status: 'synced'
            }
          }).catch((e: any) => {
            console.error('[Webhook] Failed to update mobileOrder status:', e.message);
          });
        }
      }
    }
  }

  // Resolve WebStoreOrder to get discount details
  let webStoreOrder = null;
  const lookupNumber = extractedNumber || existingLocalOrder?.internalOrderNumber;
  if (lookupNumber) {
    webStoreOrder = await prisma.webStoreOrder.findUnique({
      where: { orderNumber: lookupNumber }
    });
  }
  if (!webStoreOrder) {
    webStoreOrder = await prisma.webStoreOrder.findFirst({
      where: {
        OR: [
          { razorpayOrderId: orderData.id.toString() },
          { notes: { contains: `Shopify: ${orderData.id}` } }
        ]
      }
    });
  }

  const discountAmount = webStoreOrder?.discountAmount 
    ? Number(webStoreOrder.discountAmount) 
    : (existingLocalOrder?.discountAmount || 0);
  const discountCode = webStoreOrder?.discountCode 
    ? webStoreOrder.discountCode 
    : (existingLocalOrder?.discountCode || null);

  let finalTotalPrice = parseFloat(orderData.total_price || '0');
  const finalSubtotalPrice = orderData.subtotal_price ? parseFloat(orderData.subtotal_price) : finalTotalPrice;

  // Auto-correct undiscounted totalPrice synced from Shopify
  if (discountAmount > 0 && Math.abs(finalTotalPrice - finalSubtotalPrice) < 0.01) {
    finalTotalPrice = finalSubtotalPrice - discountAmount;
  }

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: orderData.id.toString() },
    create: {
      shopId: shopRecord.id,
      shopifyOrderId: orderData.id.toString(),
      shopifyOrderName: orderData.name || null,
      internalOrderNumber: extractedNumber || null,
      shopifySyncStatus: 'synced',
      customerId: dbCustomer.id,
      status: finalStatus,
      totalPrice: finalTotalPrice,
      subtotalPrice: finalSubtotalPrice,
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
      discountAmount: discountAmount,
      discountCode: discountCode,
      createdAt: orderDate
    },
    update: {
      status: finalStatus,
      shopifyOrderName: orderData.name || null,
      totalPrice: finalTotalPrice,
      subtotalPrice: finalSubtotalPrice,
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
      discountAmount: discountAmount,
      discountCode: discountCode,
    }
  });

  if (finalStatus === 'cancelled') {
    try {
      const { processOrderRefund } = await import('@/lib/services/refundService');
      await processOrderRefund(order.id);
    } catch (refundErr) {
      console.error(`[Webhook Route] Refund failed for order ${order.id}:`, refundErr);
    }
  }

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
      let itemImage = null;
      
      if (shopifyProductId) {
        const prod = await prisma.product.findUnique({ where: { shopifyProductId } });
        dbProductId = prod?.id || null;
        itemImage = prod?.featuredImage || null;
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
          sku: item.sku || null,
          image: itemImage || null
        },
        update: {
          quantity: item.quantity,
          price: parseFloat(item.price || '0'),
          sku: item.sku || null,
          image: itemImage || null
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
      (item: any) => item.shopifyLineItemId === lineItemId,
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

  // 1. Try the legacy product-level lookup (matches the first variant stored on Product)
  let product = await prisma.product.findUnique({
    where: { inventoryItemId }
  });

  // 2. If not found, search product_skus for variant-level match
  // This captures webhooks for non-first variants that the product-level lookup misses
  if (!product) {
    try {
      const skuRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT product_id FROM product_skus WHERE inventory_item_id = $1 LIMIT 1`,
        inventoryItemId
      );
      if (skuRows.length > 0) {
        product = await prisma.product.findUnique({
          where: { id: skuRows[0].product_id }
        });
        if (product) {
          console.log(`[Webhook] Matched inventory_item_id ${inventoryItemId} via product_skus → product ${product.id} (${product.title})`);
        }
      }
    } catch (e) {
      console.error(`[Webhook] Error searching product_skus for inventory_item_id ${inventoryItemId}:`, e);
    }
  }

  if (!product) {
    console.warn(`Product not found for inventory item ${inventoryItemId} (checked Product.inventoryItemId and product_skus.inventory_item_id)`);
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

  console.log(`Inventory updated for ${inventoryItemId} at ${locationId} (product: ${product.title})`);
}
