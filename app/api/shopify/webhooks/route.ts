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
      case 'orders/updated':
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
  const finalSubtotalPrice = orderData.total_line_items_price 
    ? parseFloat(orderData.total_line_items_price) 
    : (orderData.subtotal_price ? parseFloat(orderData.subtotal_price) : finalTotalPrice);

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

  // Trigger WhatsApp Notifications
  const phone = orderData.customer?.phone || orderData.billing_address?.phone || orderData.shipping_address?.phone || dbCustomer?.phone;
  if (phone) {
    try {
      const { getWhatsAppSetting } = await import('@/lib/whatsapp/logger');
      let orderIdStr = orderData.order_number || orderData.id?.toString();
      if (order.internalOrderNumber) {
        orderIdStr = order.internalOrderNumber;
      }

      if (topic === 'orders/create' || (topic === 'orders/paid' && order.paymentStatus === 'paid')) {
        const gateway = (orderData.gateway || (orderData.payment_gateway_names && orderData.payment_gateway_names[0]) || '').toLowerCase();
        const isCOD = gateway.includes('cod') || gateway.includes('cash_on_delivery') || gateway.includes('delivery') || gateway.includes('manual');

        if (isCOD) {
          const isCodEnabled = await getWhatsAppSetting('cod_confirmation_enabled', 'true') === 'true';
          if (isCodEnabled) {
            const templateName = await getWhatsAppSetting('template_cod_confirmation', 'zica_cod_confirmation_v1');
            const alreadySent = await prisma.whatsAppMessage.findFirst({
              where: { orderId: String(orderIdStr), templateName }
            });
            if (!alreadySent) {
              const { sendCODConfirmation } = await import('@/lib/whatsapp/templates');
              await sendCODConfirmation({ phone, customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there', orderId: String(orderIdStr) });
            }
          }
        } else {
          const isConfirmedEnabled = await getWhatsAppSetting('order_confirmed', 'true') === 'true';
          if (isConfirmedEnabled) {
            const templateName = await getWhatsAppSetting('template_order_confirmed', 'zica_order_confirmed_v1');
            const alreadySent = await prisma.whatsAppMessage.findFirst({
              where: { orderId: String(orderIdStr), templateName }
            });
            if (!alreadySent) {
              const firstLineItem = (orderData.line_items || [])[0];
              const productImageUrl = firstLineItem?.image?.src || firstLineItem?.image || '';
              const orderStatusUrl = orderData.order_status_url || '';
              const { sendOrderConfirmation } = await import('@/lib/whatsapp/templates');
              await sendOrderConfirmation({ phone, customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there', orderId: String(orderIdStr), productImageUrl, orderStatusUrl });
            }
          }
        }
      } else if (topic === 'orders/fulfilled') {
        const isShippedEnabled = await getWhatsAppSetting('order_shipped', 'true') === 'true';
        if (isShippedEnabled) {
          const fulfillment = orderData.fulfillments?.[0] || {};
          const courier = fulfillment.tracking_company || 'our shipping partner';
          const trackingNumber = fulfillment.tracking_number || 'TBA';
          
          let estimatedDelivery = '3-5 business days';
          if (fulfillment.estimated_delivery_at) {
            try {
              estimatedDelivery = new Date(fulfillment.estimated_delivery_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
            } catch (e: any) {
              console.warn('[Shopify Webhook WhatsApp] Failed to parse estimated_delivery_at date:', e.message);
            }
          }
          const trackingUrl = fulfillment.tracking_url || fulfillment.tracking_urls?.[0] || '';
          const templateName = await getWhatsAppSetting('template_order_shipped', 'zica_order_shipped');
          const alreadySent = await prisma.whatsAppMessage.findFirst({
            where: { orderId: String(orderIdStr), templateName }
          });
          if (!alreadySent) {
            const { sendShippingUpdate } = await import('@/lib/whatsapp/templates');
            await sendShippingUpdate({ phone, customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there', orderId: String(orderIdStr), trackingNumber, trackingUrl });
          }
        }
      } else if (topic === 'orders/cancelled' || orderData.cancelled_at) {
        const isStatusEnabled = await getWhatsAppSetting('order_status', 'true') === 'true';
        if (isStatusEnabled) {
          const templateName = await getWhatsAppSetting('template_order_status', 'zb_order_status');
          const alreadySent = await prisma.whatsAppMessage.findFirst({
            where: { orderId: String(orderIdStr), templateName, body: { contains: 'Cancelled' } }
          });
          if (!alreadySent) {
            const { sendOrderStatus } = await import('@/lib/whatsapp/templates');
            await sendOrderStatus({
              phone,
              customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there',
              orderId: String(orderIdStr),
              status: 'Cancelled',
              extraInfo: 'Your order has been cancelled. Any refund due will be processed shortly.',
              orderStatusUrl: orderData.order_status_url || ''
            });
          }
        }
      } else if (topic === 'orders/updated') {
        let shipmentStatus = '';
        if (orderData.fulfillments && Array.isArray(orderData.fulfillments)) {
          for (const f of orderData.fulfillments) {
            if (f.shipment_status) {
              shipmentStatus = f.shipment_status.toLowerCase();
              break;
            }
          }
        }
        
        const isDelivered = deliveryStatus === 'delivered' || shipmentStatus === 'delivered' || shipmentStatus === 'success';
        const isOutForDelivery = deliveryStatus === 'out_for_delivery' || shipmentStatus === 'out_for_delivery';
        
        if (isDelivered) {
          const isDeliveredEnabled = await getWhatsAppSetting('order_delivered', 'true') === 'true';
          if (isDeliveredEnabled) {
            const templateName = await getWhatsAppSetting('template_order_delivered', 'zica_order_delivered_v1');
            const alreadySent = await prisma.whatsAppMessage.findFirst({
              where: { orderId: String(orderIdStr), templateName }
            });
            if (!alreadySent) {
              const firstLineItem = (orderData.line_items || [])[0];
              const productImageUrl = firstLineItem?.image?.src || firstLineItem?.image || '';
              const { sendDelivered } = await import('@/lib/whatsapp/templates');
              await sendDelivered({ phone, customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there', orderId: String(orderIdStr), productImageUrl });
            }
          }
        } else if (isOutForDelivery) {
          const isOutForDeliveryEnabled = await getWhatsAppSetting('out_for_delivery', 'true') === 'true';
          if (isOutForDeliveryEnabled) {
            const templateName = await getWhatsAppSetting('template_out_for_delivery', 'zb_out_for_delivery');
            const alreadySent = await prisma.whatsAppMessage.findFirst({
              where: { orderId: String(orderIdStr), templateName }
            });
            if (!alreadySent) {
              const { sendOutForDelivery } = await import('@/lib/whatsapp/templates');
              await sendOutForDelivery({ phone, orderId: String(orderIdStr), customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there' });
            }
          }
        } else {
          const isStatusEnabled = await getWhatsAppSetting('order_status', 'true') === 'true';
          if (isStatusEnabled) {
            let status = '';
            let extraInfo = '';
            if (orderData.financial_status === 'refunded') {
              status = 'Refunded';
              extraInfo = 'Your refund has been processed. It should reflect in 5-7 business days.';
            } else if (orderData.fulfillment_status === 'partial') {
              status = 'Partially Shipped';
              extraInfo = 'Part of your order is on its way. The rest will follow soon.';
            }
            
            if (status) {
              const templateName = await getWhatsAppSetting('template_order_status', 'zb_order_status');
              const alreadySent = await prisma.whatsAppMessage.findFirst({
                where: { orderId: String(orderIdStr), templateName, body: { contains: status } }
              });
              if (!alreadySent) {
                const { sendOrderStatus } = await import('@/lib/whatsapp/templates');
                await sendOrderStatus({
                  phone,
                  customerName: orderData.customer?.first_name || orderData.billing_address?.first_name || 'there',
                  orderId: String(orderIdStr),
                  status,
                  extraInfo,
                  orderStatusUrl: orderData.order_status_url || ''
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[Shopify Webhook WhatsApp] Failed to process WhatsApp notifications:', err.message);
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
