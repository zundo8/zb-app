import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getTrackingStatus } from '@/lib/services/logistics';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId')?.trim();
    const phone = url.searchParams.get('phone')?.trim();
    const email = url.searchParams.get('email')?.trim();
    const orderId = url.searchParams.get('orderId')?.trim();
    const limitRaw = url.searchParams.get('limit');
    const offsetRaw = url.searchParams.get('offset');
    const limit = limitRaw ? Math.max(1, Math.min(50, parseInt(limitRaw, 10) || 10)) : null;
    const offset = offsetRaw ? Math.max(0, parseInt(offsetRaw, 10) || 0) : 0;

    // Quick count mode for admin sync stats
    const countOnly = url.searchParams.get('count') === 'true';
    if (countOnly) {
      const total = await prisma.order.count();
      return NextResponse.json({ total }, { headers: corsHeaders });
    }

    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ orders: [], error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    
    // In a real app we'd verify the JWT, but here we'll ensure the token isn't just empty space
    if (token.length < 5) {
      return NextResponse.json({ orders: [], error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    if (!customerId && !phone && !email && !orderId) {
      return NextResponse.json(
        { orders: [], error: 'customerId, phone, email or orderId query parameter required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let customerIds: string[] = [];

    if (orderId) {
      // Direct order lookup – no need for customer resolution
    } else {
      // Build a flexible customer lookup that handles phone number variants
      const customerWhere: any = { OR: [] };

      if (customerId) customerWhere.OR.push({ id: customerId });

      if (phone) {
        const phoneDigits = phone.replace(/\D/g, '');
        const last10 = phoneDigits.slice(-10);
        customerWhere.OR.push({ phone });
        if (phoneDigits !== phone) customerWhere.OR.push({ phone: phoneDigits });
        if (last10.length === 10) {
          customerWhere.OR.push({ phone: { contains: last10 } });
        }
      }

      if (email) customerWhere.OR.push({ email });

      if (customerWhere.OR.length === 0) {
        return NextResponse.json({ orders: [] }, { headers: corsHeaders });
      }

      const customers = await prisma.customer.findMany({
        where: customerWhere,
        select: { id: true },
      });

      if (customers.length === 0) {
        return NextResponse.json({ orders: [] }, { headers: corsHeaders });
      }
      customerIds = customers.map((c: { id: string }) => c.id);
    }

    const orders = await prisma.order.findMany({
      where: orderId ? { id: orderId } : { customerId: { in: customerIds } },
      include: {
        items: {
          include: {
            product: { select: { id: true, shopifyProductId: true, title: true } },
          },
        },
        shipments: true,
        returns: true,
        exchanges: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { skip: offset, take: limit } : {}),
    });

    const formatted = orders.map((o: any) => {
      const latestShipment = o.shipments?.sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      let parsedShippingAddress = null;
      if (o.shippingAddress) {
        try {
          parsedShippingAddress = JSON.parse(o.shippingAddress);
        } catch {
          parsedShippingAddress = { raw: o.shippingAddress };
        }
      }

      let parsedBillingAddress = null;
      if (o.billingAddress) {
        try {
          parsedBillingAddress = JSON.parse(o.billingAddress);
        } catch {
          parsedBillingAddress = { raw: o.billingAddress };
        }
      }

      // Extract human-readable order number from shopifyOrderId (e.g. "#ZB71451" → "ZB71451")
      const rawOrderId = o.shopifyOrderId || '';
      const orderNumber = rawOrderId.replace(/^#/, '');

      // Extract variant/size info from item title (e.g. "URBANGLYPH LOWER - XL" → size "XL")
      const itemsFormatted = o.items.map((item: any) => {
        let size: string | null = null;
        let productName = item.title;
        
        // Try to extract size from title like "PRODUCT NAME - SIZE"
        const sizeMatch = item.title.match(/\s*-\s*(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i);
        if (sizeMatch) {
          size = sizeMatch[1].toUpperCase();
          productName = item.title.replace(sizeMatch[0], '').trim();
        }

        return {
          id: item.id,
          lineItemId: item.shopifyLineItemId,
          title: productName,
          fullTitle: item.title,
          quantity: item.quantity,
          price: item.price,
          sku: item.sku,
          size,
          productId: item.productId,
          shopifyProductId: item.product?.shopifyProductId || null,
          image: null, // Will be resolved by the app if needed
        };
      });

      // Status Normalization
      let normalizedStatus = (o.status || 'PENDING').toUpperCase();
      if (normalizedStatus.includes(' / ')) {
        normalizedStatus = normalizedStatus.split(' / ')[0].trim();
      }
      
      // Payment method extraction
      const paymentGateway = o.payments?.[0]?.gateway || null;
      const paymentMethod = paymentGateway 
        ? paymentGateway.includes('COD') || paymentGateway.includes('Cash') 
          ? 'Cash on Delivery'
          : paymentGateway
        : null;

      // Parse note for discount/shipping info
      let discountInfo = null;
      let shippingMethodInfo = null;
      if (o.note) {
        const discountMatch = o.note.match(/Discount:\s*([^\|]+)/);
        if (discountMatch) discountInfo = discountMatch[1].trim();
        const shippingMatch = o.note.match(/Shipping:\s*([^\|]+)/);
        if (shippingMatch) shippingMethodInfo = shippingMatch[1].trim();
      }

      return {
        id: o.id,
        orderNumber,
        shopifyOrderId: o.shopifyOrderId,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        status: normalizedStatus,
        rawStatus: o.status,
        paymentStatus: o.paymentStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        deliveryStatus: o.deliveryStatus,
        trackingNumber: latestShipment?.trackingNumber || null,
        trackingUrl: latestShipment?.trackingUrl || (latestShipment?.trackingNumber
          ? latestShipment.courier?.toLowerCase() === 'shiprocket'
            ? `https://shiprocket.co/tracking/${latestShipment.trackingNumber}`
            : `https://www.delhivery.com/track/package/${latestShipment.trackingNumber}`
          : null),
        courier: latestShipment?.courier || null,
        shipmentCreatedAt: latestShipment?.createdAt || null,
        totalPrice: o.totalPrice,
        subtotalPrice: o.subtotalPrice,
        totalTax: o.totalTax,
        currency: o.currency,
        note: o.note,
        tags: o.tags,
        paymentMethod,
        shippingMethod: shippingMethodInfo,
        discountInfo,
        shippingAddress: parsedShippingAddress,
        billingAddress: parsedBillingAddress,
        items: itemsFormatted,
        returns: (o.returns || []).map((r: any) => ({
          id: r.id,
          productId: r.productId,
          reason: r.reason,
          status: r.status,
          refundMethod: r.refundMethod,
          refundAmount: r.refundAmount,
          requestedAt: r.requestedAt,
        })),
        exchanges: (o.exchanges || []).map((e: any) => ({
          id: e.id,
          originalProductId: e.originalProductId,
          newProductId: e.newProductId,
          status: e.status,
          priceDifference: e.priceDifference,
          createdAt: e.createdAt,
        })),
        timeline: {
          placedAt: o.createdAt,
          confirmedAt: o.paymentStatus === 'paid' ? o.updatedAt : null,
          packedAt:
            (o.fulfillmentStatus && String(o.fulfillmentStatus).toLowerCase() !== 'unfulfilled')
              ? o.updatedAt
              : null,
          shippedAt: latestShipment?.createdAt || (o.fulfillmentStatus ? o.updatedAt : null),
          outForDeliveryAt:
            String(o.deliveryStatus || '').toLowerCase() === 'out_for_delivery' ? o.updatedAt : null,
          deliveredAt: String(o.deliveryStatus || '').toLowerCase() === 'delivered' ? o.updatedAt : null,
        },
        shipmentEvents: latestShipment?.events ? JSON.parse(latestShipment.events) : [],
      };
    });

    // Real-time tracking refresh if single order requested
    if (orderId && formatted.length > 0) {
      const order = formatted[0];
      if (order.trackingNumber && order.deliveryStatus !== 'delivered') {
        try {
          const status = await getTrackingStatus(order.trackingNumber);
          if (status && status.status !== 'unknown') {
             // Update the order object in memory for the response
             order.deliveryStatus = status.status;
             order.shipmentEvents = status.events;
             if (status.estimatedDelivery) {
                (order.timeline as any).estimatedDelivery = status.estimatedDelivery;
             }

             // Update DB in background
             prisma.shipment.updateMany({
               where: { trackingNumber: order.trackingNumber },
               data: { 
                 status: status.status,
                 currentLocation: status.location,
                 estimatedDelivery: status.estimatedDelivery ? new Date(status.estimatedDelivery) : undefined,
                 events: JSON.stringify(status.events)
               }
             }).catch(e => console.error('DB Status Sync Error:', e));

             // Also update order delivery status if changed
             if (status.status.toLowerCase() === 'delivered') {
                prisma.order.update({
                  where: { id: order.id },
                  data: { deliveryStatus: 'delivered' }
                }).catch(e => console.error('DB Order Sync Error:', e));
             }
          }
        } catch (e) {
          console.error('Real-time sync failed:', e);
        }
      }
    }

    // Optional pagination metadata (kept non-breaking: existing callers can ignore).
    if (limit && !orderId) {
      const total = await prisma.order.count({
        where: { customerId: { in: customerIds } },
      });
      const hasMore = offset + formatted.length < total;
      return NextResponse.json({ orders: formatted, page: { limit, offset, total, hasMore } }, { headers: corsHeaders });
    }

    if (orderId && formatted.length > 0) {
      return NextResponse.json({ order: formatted[0] }, { headers: corsHeaders });
    }

    return NextResponse.json({ orders: formatted }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[App API] Orders error:', error.message);
    return NextResponse.json(
      { orders: [], error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      customerId, 
      lineItems, 
      shipping_address, 
      appliedStoreCredits = 0, 
      payment_method = 'razorpay',
      financial_status = 'pending',
      payment_id = null,
      razorpay_order_id = null,
      total_price = 0,
      subtotal_price = 0,
      currency = 'INR'
    } = body;

    if (!lineItems?.length || !customerId) {
      return NextResponse.json(
        { success: false, error: 'lineItems and customerId are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 0. Resolve Customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 1. Handle Store Credits if applied
    let creditReduction = 0;
    if (appliedStoreCredits > 0) {
      if ((customer.storeCredits || 0) < appliedStoreCredits) {
        return NextResponse.json(
          { success: false, error: 'Insufficient store credits' },
          { status: 400, headers: corsHeaders }
        );
      }

      creditReduction = appliedStoreCredits;

      // Create transaction
      await prisma.storeCredit.create({
        data: {
          customerId,
          amount: -creditReduction,
          type: 'DEBIT',
          description: `Order Purchase - ${payment_method.toUpperCase()}`,
        }
      });

      // Update customer balance
      await prisma.customer.update({
        where: { id: customerId },
        data: { storeCredits: { decrement: creditReduction } }
      });
    }

    // 2. Create order in Shopify
    // Use shopifyId if available, otherwise fallback to email/phone
    const shopifyOrderPayload: any = {
      line_items: lineItems.map((li: any) => ({
        variant_id: li.variant_id,
        quantity: li.quantity,
      })),
      financial_status: financial_status === 'paid' ? 'paid' : 'pending',
      tags: `AppOrder, ${payment_method.toUpperCase()}${creditReduction > 0 ? `, Credit: ${creditReduction}` : ''}`,
      note: `Ordered via Zica Bella App. Method: ${payment_method.toUpperCase()}. ${creditReduction > 0 ? `Used ${creditReduction} credits.` : ''}`,
      shipping_address,
      use_customer_default_address: !shipping_address,
    };

    if (customer.shopifyId && !customer.shopifyId.startsWith('GUEST')) {
      shopifyOrderPayload.customer = { id: parseInt(customer.shopifyId, 10) };
    } else {
      shopifyOrderPayload.customer = {
        email: customer.email,
        first_name: customer.name?.split(' ')[0] || 'App',
        last_name: customer.name?.split(' ').slice(1).join(' ') || 'User',
      };
    }

    const { createOrder: createShopifyOrder } = require('@/lib/shopify-admin');
    const shopifyOrder = await createShopifyOrder(shopifyOrderPayload);

    // 3. Save to local database
    const shop = await prisma.shop.findFirst();
    if (!shop) throw new Error('No shop configuration found');

    const localOrder = await prisma.order.create({
      data: {
        shopId: shop.id,
        customerId,
        shopifyOrderId: String(shopifyOrder.id),
        totalPrice: total_price || parseFloat(shopifyOrder.total_price),
        subtotalPrice: subtotal_price || parseFloat(shopifyOrder.subtotal_price),
        currency: currency || shopifyOrder.currency,
        status: 'OPEN',
        paymentStatus: financial_status,
        fulfillmentStatus: 'unfulfilled',
        shippingAddress: JSON.stringify(shopifyOrder.shipping_address || shipping_address),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: payment_id,
        paymentMethod: payment_method,
        tags: shopifyOrder.tags,
        items: {
          create: shopifyOrder.line_items.map((li: any) => ({
            shopifyLineItemId: String(li.id),
            productId: li.product_id ? String(li.product_id) : undefined,
            title: li.title,
            quantity: li.quantity,
            price: parseFloat(li.price),
            sku: li.sku,
          }))
        }
      },
      include: { items: true }
    });

    // 4. Record initial payment if captured
    if (financial_status === 'paid' && payment_id) {
       await prisma.payment.create({
         data: {
           orderId: localOrder.id,
           customerId,
           amount: localOrder.totalPrice,
           type: 'INITIAL',
           status: 'success',
           gateway: payment_method,
         }
       });
    }

    return NextResponse.json({ success: true, order: localOrder }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[App API] Create order error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
