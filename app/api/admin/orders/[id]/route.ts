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
      select: { status: true, deliveryStatus: true, customerId: true, paymentStatus: true }
    });

    // Auto-cancel sub-statuses if status is set to cancelled
    if (body.status === 'cancelled') {
      body.paymentStatus = oldOrder?.paymentStatus === 'paid' ? 'paid' : 'cancelled';
      body.fulfillmentStatus = 'cancelled';
      body.deliveryStatus = 'cancelled';
      
      const order = await prisma.order.findUnique({ where: { id } });
      if (order && order.shopifyOrderId && !order.shopifyOrderId.startsWith('#') && !order.shopifyOrderId.startsWith('app_pending_')) {
        try {
          const { cancelOrder } = await import('@/lib/shopify-admin');
          await cancelOrder(order.shopifyOrderId);
        } catch (shopifyErr) {
          console.error('[Admin Order PATCH] Failed to cancel order in Shopify:', shopifyErr);
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: body,
    });

    // Trigger auto refund if order status was set to cancelled
    if (body.status === 'cancelled') {
      try {
        const { processOrderRefund } = await import('@/lib/services/refundService');
        await processOrderRefund(id);
      } catch (refundErr) {
        console.error('[Admin Order PATCH] Refund processing failed:', refundErr);
      }
    }

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

        // Module 3: Automatic Order Email Webhook Trigger (Non-blocking / Fire-and-forget)
        try {
          const localApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com'}/api/orders/status-update`;
          const apiSecret = process.env.INTERNAL_API_SECRET || 'ZB_INTERNAL_SECRET_987654321';
          
          prisma.order.findUnique({
            where: { id: updated.id },
            include: {
              customer: true,
              items: true,
              shipments: { orderBy: { createdAt: 'desc' } }
            }
          }).then((fullOrder) => {
            if (fullOrder && fullOrder.customer && fullOrder.customer.email) {
              const latestShipment = fullOrder.shipments?.[0];
              const resolvedStatus = statusChanged ? fullOrder.status : fullOrder.deliveryStatus;
              
              const payload = {
                orderId: fullOrder.id,
                newStatus: resolvedStatus,
                customerEmail: fullOrder.customer.email,
                customerName: fullOrder.customer.name || 'Valued Customer',
                paymentMethod: fullOrder.paymentMethod || undefined,
                items: fullOrder.items.map((i: any) => ({
                  name: i.title,
                  size: i.sku?.split('-')?.pop() || 'M',
                  quantity: i.quantity,
                  price: i.price,
                  image: i.image || null,
                })),
                total: fullOrder.totalPrice,
                currency: fullOrder.currency || 'INR',
                trackingNumber: latestShipment?.trackingNumber || undefined,
                courier: latestShipment?.courier || undefined,
              };

              fetch(localApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-secret': apiSecret,
                },
                body: JSON.stringify(payload),
              })
              .then(res => res.json())
              .then(resData => console.log('[Admin Order Status Trigger] Email status webhook success:', resData))
              .catch(err => console.error('[Admin Order Status Trigger] Email status webhook fetch error:', err));
            }
          }).catch(err => console.error('[Admin Order Status Trigger] Error loading full order for email:', err));
        } catch (emailErr) {
          console.error('[Admin Order Status Trigger] Background email trigger failed:', emailErr);
        }
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
