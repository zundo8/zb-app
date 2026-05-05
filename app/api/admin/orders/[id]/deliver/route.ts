import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const shopifyOrderId = params.id;

    if (!shopifyOrderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { shopifyOrderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found in local database. Please run Full Sync first.' },
        { status: 404 }
      );
    }

    await prisma.order.update({
      where: { shopifyOrderId },
      data: { deliveryStatus: 'delivered' },
    });

    try {
      const { NotificationService } = await import('@/lib/services/notification.service');
      await NotificationService.sendToUser(
        order.customerId,
        'Zica Bella Order Update',
        'Your order is now delivered',
        { orderId: order.id, status: 'delivered' }
      );
    } catch (e) {
      console.error('Failed to send push notification:', e);
    }

    return NextResponse.json({ success: true, deliveryStatus: 'delivered' });
  } catch (error: any) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
