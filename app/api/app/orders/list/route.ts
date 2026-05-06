import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

function parseShippingAddress(raw: string | null) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    // normalize to requested app shape
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
  // Prefer tag `zb-order-ZB-1234`, fallback to `shopifyOrderId` if it looks like our `#ZB-...`
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
  const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';

  const awaitingApprovalCompletedAt = status === 'awaiting_approval' ? createdAt : null;
  const approvedCompletedAt = status === 'approved' ? new Date(order.updatedAt).toISOString() : null;
  const shippedCompletedAt = delivery === 'shipped' ? new Date(order.updatedAt).toISOString() : null;
  const outForDeliveryCompletedAt = delivery === 'out_for_delivery' ? new Date(order.updatedAt).toISOString() : null;
  const deliveredCompletedAt = delivery === 'delivered' ? new Date(order.updatedAt).toISOString() : null;

  return [
    { step: 'order_placed', completedAt: createdAt },
    { step: 'awaiting_approval', completedAt: awaitingApprovalCompletedAt ?? (paid ? createdAt : createdAt) },
    { step: 'approved', completedAt: approvedCompletedAt },
    { step: 'shipped', completedAt: shippedCompletedAt },
    { step: 'out_for_delivery', completedAt: outForDeliveryCompletedAt },
    { step: 'delivered', completedAt: deliveredCompletedAt },
  ];
}

export async function GET(req: Request) {
  const auth = getAppAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId')?.trim();
  if (!customerId) return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  if (customerId !== auth.customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    // #region agent log
    fetch('http://127.0.0.1:7424/ingest/50560bdb-f431-4214-80ff-aed57193ade4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ff929'},body:JSON.stringify({sessionId:'7ff929',runId:'api-orders-pre',hypothesisId:'H1',location:'app/api/app/orders/list/route.ts:GET',message:'orders/list called',data:{hasAuth:!!auth,customerIdMatch:customerId===auth.customerId,customerIdLen:customerId.length,authCustomerIdLen:auth.customerId.length,hasAuthHeader:!!req.headers.get('authorization'),authHeaderLen:(req.headers.get('authorization')||'').length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const orders = await prisma.order.findMany({
      where: { customerId },
      include: { items: true, shipments: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      orders: orders.map((o: any) => ({
        orderId: o.id,
        orderNumber: orderNumberFromOrder(o),
        createdAt: o.createdAt,
        paymentMethod: paymentMethodFromOrder(o),
        paymentStatus: paymentStatusFromOrder(o),
        fulfillmentStatus: o.fulfillmentStatus || 'unfulfilled',
        lineItems: (o.items || []).map((it: any) => ({
          productId: it.productId,
          variantId: null,
          name: it.title,
          size: null,
          quantity: it.quantity,
          price: it.price,
          imageUrl: null,
        })),
        total: o.totalPrice,
        subtotal: o.subtotalPrice ?? o.totalPrice,
        deliveryFee: null,
        shippingAddress: parseShippingAddress(o.shippingAddress),
        tracking: trackingFromOrder(o),
        statusTimeline: statusTimeline(o),
      })),
    });
  } catch (e: any) {
    console.error('[App API] orders/list error:', e);
    // #region agent log
    fetch('http://127.0.0.1:7424/ingest/50560bdb-f431-4214-80ff-aed57193ade4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ff929'},body:JSON.stringify({sessionId:'7ff929',runId:'api-orders-pre',hypothesisId:'H1',location:'app/api/app/orders/list/route.ts:catch',message:'orders/list error',data:{err:String(e?.message||e)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: e?.message || 'Internal server error', orders: [] }, { status: 500 });
  }
}

