import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        shipments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    let shippingAddress: any = null;
    try {
      shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
    } catch {
      shippingAddress = null;
    }

    const orderNumber =
      String(order.tags || '').match(/zb-order-(ZB-\d+)/i)?.[1]?.toUpperCase() ||
      String(order.shopifyOrderId || '').replace(/^#/, '') ||
      order.id;

    const latestShipment = order.shipments?.[0] || null;

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        fulfillmentStatus: order.fulfillmentStatus,
        deliveryStatus: order.deliveryStatus,
        totalPrice: order.totalPrice,
        subtotalPrice: order.subtotalPrice,
        currency: order.currency,
        note: order.note,
        tags: order.tags,
        razorpayPaymentId: order.razorpayPaymentId,
        shopifyOrderId: order.shopifyOrderId && /^\d+$/.test(String(order.shopifyOrderId)) ? order.shopifyOrderId : null,
        shippingAddress,
        customer: order.customer,
        items: order.items,
        shipment: latestShipment
          ? {
              awb: latestShipment.awb || latestShipment.trackingNumber || null,
              courier: latestShipment.courier || null,
              status: latestShipment.status,
              currentLocation: latestShipment.currentLocation,
              estimatedDelivery: latestShipment.estimatedDelivery,
              trackingUrl: latestShipment.trackingUrl,
              events: (() => {
                try {
                  return latestShipment.events ? JSON.parse(latestShipment.events) : [];
                } catch {
                  return [];
                }
              })(),
            }
          : null,
      },
    });
  } catch (e: any) {
    console.error('[Admin] mobile-orders/[id] error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

