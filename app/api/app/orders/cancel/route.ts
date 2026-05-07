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
