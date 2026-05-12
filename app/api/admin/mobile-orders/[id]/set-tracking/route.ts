import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const awb = String(body.awb || '').trim();
    const carrier = String(body.carrier || '').trim();

    if (!awb) return NextResponse.json({ error: 'awb is required' }, { status: 400 });
    if (!carrier) return NextResponse.json({ error: 'carrier is required' }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryStatus: 'shipped',
          status: order.status === 'awaiting_approval' ? 'approved' : order.status,
        },
      }),
      prisma.shipment.create({
        data: {
          orderId: order.id,
          awb,
          trackingNumber: awb,
          courier: carrier,
          status: 'shipped',
          events: JSON.stringify([
            {
              status: 'shipped',
              location: '',
              timestamp: new Date().toISOString(),
              description: `Shipped via ${carrier}. AWB: ${awb}`,
            },
          ]),
        },
      }),
    ]);

    // Push notification (non-blocking)
    try {
      const orderNumber =
        String(order.tags || '').match(/zb-order-(ZB[71\d-]+)/i)?.[1]?.toUpperCase() ||
        String(order.shopifyOrderId || '').replace(/^#/, '') ||
        'your order';
      const { NotificationService } = await import('@/lib/services/notification.service');
      await NotificationService.sendToUser(
        order.customerId,
        'Zica Bella Order Update',
        `Your order ${orderNumber} has been shipped via ${carrier}. AWB: ${awb}`,
        { orderId: order.id, status: 'shipped', awb }
      );
    } catch (e) {
      console.error('[Admin] set-tracking push failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Admin] set-tracking error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

