import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        shipments: {
          orderBy: { createdAt: 'desc' }
        },
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('[Admin Order Detail API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const oldOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true, deliveryStatus: true, customerId: true }
    });

    const updated = await prisma.order.update({
      where: { id },
      data: body,
    });

    // Send push notification if status changed
    if (oldOrder && updated.customerId) {
      const statusChanged = body.status && body.status !== oldOrder.status;
      const deliveryChanged = body.deliveryStatus && body.deliveryStatus !== oldOrder.deliveryStatus;

      if (statusChanged || deliveryChanged) {
        try {
          const { NotificationService } = await import('@/lib/services/notification.service');
          let message = 'Your order status has been updated';
          if (deliveryChanged && updated.deliveryStatus === 'delivered') message = 'Your order has been delivered!';
          else if (deliveryChanged && updated.deliveryStatus === 'out_for_delivery') message = 'Your order is out for delivery!';
          else if (statusChanged && updated.status === 'approved') message = 'Your order has been approved and is being processed';

          await NotificationService.sendToUser(
            updated.customerId,
            'Zica Bella Order Update',
            message,
            { orderId: updated.id, status: updated.status, deliveryStatus: updated.deliveryStatus }
          );
          console.log(`[Admin Order PATCH] Push notification sent to user ${updated.customerId}`);
        } catch (pushErr) {
          console.error('[Admin Order PATCH] Push notification failed:', pushErr);
        }
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
