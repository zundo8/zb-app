import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

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

  const awaitingApprovalCompletedAt = status === 'awaiting_approval' ? createdAt : null;
  const approvedCompletedAt = status === 'approved' ? new Date(order.updatedAt).toISOString() : null;
  const shippedCompletedAt = delivery === 'shipped' ? new Date(order.updatedAt).toISOString() : null;
  const outForDeliveryCompletedAt = delivery === 'out_for_delivery' ? new Date(order.updatedAt).toISOString() : null;
  const deliveredCompletedAt = delivery === 'delivered' ? new Date(order.updatedAt).toISOString() : null;

  return [
    { step: 'order_placed', completedAt: createdAt },
    { step: 'awaiting_approval', completedAt: awaitingApprovalCompletedAt ?? createdAt },
    { step: 'approved', completedAt: approvedCompletedAt },
    { step: 'shipped', completedAt: shippedCompletedAt },
    { step: 'out_for_delivery', completedAt: outForDeliveryCompletedAt },
    { step: 'delivered', completedAt: deliveredCompletedAt },
  ];
}

export async function GET(req: Request, { params }: { params: { orderId: string } }) {
  const auth = getAppAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { items: true, shipments: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.customerId !== auth.customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    return NextResponse.json({
      order: {
        orderId: order.id,
        orderNumber: orderNumberFromOrder(order),
        createdAt: order.createdAt,
        paymentMethod: paymentMethodFromOrder(order),
        paymentStatus: paymentStatusFromOrder(order),
        fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
        lineItems: (order.items || []).map((it: any) => ({
          productId: it.productId,
          variantId: null,
          name: it.title,
          size: null,
          quantity: it.quantity,
          price: it.price,
          imageUrl: null,
        })),
        total: order.totalPrice,
        subtotal: order.subtotalPrice ?? order.totalPrice,
        deliveryFee: null,
        shippingAddress: parseShippingAddress(order.shippingAddress),
        tracking: trackingFromOrder(order),
        statusTimeline: statusTimeline(order),
      },
    });
  } catch (e: any) {
    console.error('[App API] orders/[orderId] error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

