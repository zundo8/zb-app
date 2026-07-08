import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.mobileOrder.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: { select: { featuredImage: true, title: true } }
          }
        },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    let shippingAddress: any = null;
    try {
      shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
    } catch {
      shippingAddress = null;
    }

    const orderNumber = order.orderNumber || order.id;

    let latestShipment = null;
    if (order.shopifyOrderId) {
      const syncedOrder = await prisma.order.findFirst({
        where: { shopifyOrderId: order.shopifyOrderId },
        include: { shipments: { orderBy: { createdAt: 'desc' } } }
      });
      latestShipment = syncedOrder?.shipments?.[0] || null;
    }

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
        razorpayPaymentId: order.paymentId,
        shopifyOrderId: order.shopifyOrderId && /^\d+$/.test(String(order.shopifyOrderId)) ? order.shopifyOrderId : null,
        shippingAddress,
        customer: order.customer,
        items: order.items.map((item: any) => ({
          ...item,
          image: item.image || item.product?.featuredImage || null,
          title: item.title || item.product?.title || 'Unknown Product',
        })),
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
    console.error('[Admin] mobile-orders/[id] GET error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { status, paymentStatus, fulfillmentStatus, deliveryStatus, note, tags } = body;

    const updated = await prisma.mobileOrder.update({
      where: { id: params.id },
      data: {
        status: status !== undefined ? status : undefined,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : undefined,
        fulfillmentStatus: fulfillmentStatus !== undefined ? fulfillmentStatus : undefined,
        deliveryStatus: deliveryStatus !== undefined ? deliveryStatus : undefined,
        note: note !== undefined ? note : undefined,
        tags: tags !== undefined ? tags : undefined,
      },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (e: any) {
    console.error('[Admin] mobile-orders/[id] PATCH error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
