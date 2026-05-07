import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

function parseShippingAddress(raw: string | null) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return {
      name: o.name || '',
      line1: o.line1 || o.address1 || o.street || '',
      line2: o.line2 || o.address2 || '',
      city: o.city || '',
      state: o.state || o.province || '',
      pincode: o.pincode || o.zip || '',
      phone: o.phone || '',
      email: o.email || '',
      country: 'India' as const,
    };
  } catch {
    return null;
  }
}

function orderNumberFromOrder(order: any) {
  const tags = String(order.tags || '');
  const m = tags.match(/zb-order-(ZB-\d+)/i);
  if (m?.[1]) return m[1].toUpperCase();
  const so = String(order.shopifyOrderId || '');
  if (so.startsWith('#ZB-')) return so.replace(/^#/, '');
  return so.replace(/^#/, '') || order.id;
}

function paymentMethodFromOrder(order: any): 'COD' | 'PREPAID' {
  const pm = String(order.paymentMethod || '').toUpperCase();
  if (pm.includes('COD') || pm.includes('CASH')) return 'COD';
  return 'PREPAID';
}

function paymentStatusFromOrder(order: any): 'pending' | 'paid' {
  const ps = String(order.paymentStatus || '').toLowerCase();
  return ps === 'paid' ? 'paid' : 'pending';
}

function trackingFromOrder(order: any) {
  const shipments = Array.isArray(order.shipments) ? order.shipments : [];
  const latest = shipments
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest?.awb && !latest?.trackingNumber) return null;
  return {
    awb: latest.awb || latest.trackingNumber || null,
    carrier: latest.courier || null,
    lastLocation: latest.currentLocation || null,
    estimatedDelivery: latest.estimatedDelivery ? new Date(latest.estimatedDelivery).toISOString() : null,
  };
}

function statusTimeline(order: any) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : null;
  const status = String(order.status || '').toLowerCase();
  const delivery = String(order.deliveryStatus || '').toLowerCase();
  const updatedAt = new Date(order.updatedAt).toISOString();

  const isDelivered = delivery === 'delivered';
  const isOutForDelivery = isDelivered || delivery === 'out_for_delivery';
  const isShipped = isOutForDelivery || delivery === 'shipped';
  const isApproved = isShipped || status === 'approved';
  const isAwaiting = isApproved || status === 'awaiting_approval';

  return [
    { step: 'order_placed', completedAt: createdAt },
    { step: 'awaiting_approval', completedAt: isAwaiting ? createdAt : null },
    { step: 'approved', completedAt: isApproved ? updatedAt : null },
    { step: 'shipped', completedAt: isShipped ? updatedAt : null },
    { step: 'out_for_delivery', completedAt: isOutForDelivery ? updatedAt : null },
    { step: 'delivered', completedAt: isDelivered ? updatedAt : null },
  ];
}

export async function GET(req: Request, { params }: { params: { orderId: string } }) {
  const url = new URL(req.url);
  const qCustomerId = url.searchParams.get('customerId');
  const qPhone = url.searchParams.get('phone');
  const qEmail = url.searchParams.get('email');

  const auth = getAppAuthFromRequest(req);
  
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, shopifyProductId: true, title: true }
            }
          }
        },
        shipments: true,
        customer: true,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: corsHeaders });

    // Auth check: Allow if JWT matches OR if guest tracking info (phone/email) matches the customer
    let isAuthorized = false;
    if (auth && order.customerId === auth.customerId) {
      isAuthorized = true;
    } else if (order.customer) {
      // Check query params for guest tracking
      if (qCustomerId === order.customerId) isAuthorized = true;
      if (qEmail && order.customer.email === qEmail) isAuthorized = true;
      if (qPhone) {
        const orderPhone = order.customer.phone?.replace(/\D/g, '').slice(-10);
        const inputPhone = qPhone.replace(/\D/g, '').slice(-10);
        if (orderPhone && inputPhone && orderPhone === inputPhone) isAuthorized = true;
      }
    } else if (qCustomerId === order.customerId) {
      // Fallback for orders without customer record but matching ID
      isAuthorized = true;
    }

    if (!isAuthorized && !auth) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401, headers: corsHeaders });
    }
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: not your order' }, { status: 403, headers: corsHeaders });
    }


    // Extract size from title if present (e.g. "PRODUCT NAME - XL" → size "XL")
    const formatItem = (it: any) => {
      let size: string | null = null;
      let productName = it.title;
      const sizeMatch = it.title.match(/\s*-\s*(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i);
      if (sizeMatch) {
        size = sizeMatch[1].toUpperCase();
        productName = it.title.replace(sizeMatch[0], '').trim();
      }

      return {
        id: it.id,
        productId: it.productId,
        title: productName,
        fullTitle: it.title,
        name: productName,
        size,
        quantity: it.quantity,
        price: it.price,
        sku: it.sku,
        image: null, // Will be resolved client-side from product data
        imageUrl: null,
        shopifyProductId: it.product?.shopifyProductId || null,
      };
    };

    return NextResponse.json({
      order: {
        id: order.id,
        orderId: order.id,
        orderNumber: orderNumberFromOrder(order),
        createdAt: order.createdAt,
        status: order.status,
        paymentMethod: paymentMethodFromOrder(order),
        paymentStatus: paymentStatusFromOrder(order),
        fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
        deliveryStatus: order.deliveryStatus || 'pending',
        items: (order.items || []).map(formatItem),
        lineItems: (order.items || []).map(formatItem),
        total: order.totalPrice,
        totalPrice: order.totalPrice,
        subtotal: order.subtotalPrice ?? order.totalPrice,
        subtotalPrice: order.subtotalPrice ?? order.totalPrice,
        totalTax: order.totalTax || 0,
        currency: order.currency || 'INR',
        deliveryFee: null,
        shippingAddress: parseShippingAddress(order.shippingAddress),
        tracking: trackingFromOrder(order),
        statusTimeline: statusTimeline(order),
        note: order.note,
        tags: order.tags,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
      },
    }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('[App API] orders/[orderId] error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
