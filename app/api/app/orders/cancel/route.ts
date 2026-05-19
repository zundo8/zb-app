import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import { cancelOrder as cancelShopifyOrder } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const auth = getAppAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    const { orderId, reason } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400, headers: corsHeaders });
    }

    // Find order and check ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: corsHeaders });
    }

    if (order.customerId !== auth.customerId) {
      return NextResponse.json({ error: 'Unauthorized: not your order' }, { status: 403, headers: corsHeaders });
    }

    // Only allow cancellation if order is not already processed/shipped
    const status = (order.status || '').toLowerCase();
    if (status === 'approved' || status === 'shipped' || status === 'delivered') {
      return NextResponse.json({ error: 'Order cannot be cancelled after approval' }, { status: 400, headers: corsHeaders });
    }

    // 1. Update local database
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        paymentStatus: order.paymentStatus === 'paid' ? 'paid' : 'cancelled',
        fulfillmentStatus: 'cancelled',
        deliveryStatus: 'cancelled',
        note: order.note ? `${order.note}\nCancelled by user. Reason: ${reason || 'Not provided'}` : `Cancelled by user. Reason: ${reason || 'Not provided'}`,
        updatedAt: new Date(),
      }
    });

    // 2. Try to cancel in Shopify if shopifyOrderId exists
    if (order.shopifyOrderId) {
      try {
        await cancelShopifyOrder(order.shopifyOrderId.replace(/^#/, ''), reason || 'customer');
      } catch (e) {
        console.error('[Cancel Order] Shopify cancellation failed:', e);
        // We continue even if Shopify fail, as we already marked it cancelled in our DB
      }
    }

    // 3. Automatic Order Email Webhook Trigger (Non-blocking)
    try {
      const localApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com'}/api/orders/status-update`;
      const apiSecret = process.env.INTERNAL_API_SECRET || 'ZB_INTERNAL_SECRET_987654321';
      
      const fullOrder = await prisma.order.findUnique({
        where: { id: updatedOrder.id },
        include: { items: true }
      });

      if (fullOrder && order.customer && order.customer.email) {
        const payload = {
          orderId: fullOrder.id,
          newStatus: 'cancelled',
          customerEmail: order.customer.email,
          customerName: order.customer.name || 'Valued Customer',
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
        .then(resData => console.log('[Cancel Order] Email webhook success:', resData))
        .catch(err => console.error('[Cancel Order] Email webhook fetch error:', err));
      }
    } catch (emailErr) {
      console.error('[Cancel Order] Background email trigger failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('[Cancel Order] Error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
