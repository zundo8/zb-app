import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryStatus: 'delivered' },
    });

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
        `Your order ${orderNumber} is now delivered.`,
        { orderId: order.id, status: 'delivered' }
      );
    } catch (e) {
      console.error('[Admin] delivered push failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Admin] mark-delivered error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

