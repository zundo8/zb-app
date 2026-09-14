import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processOrderRefund } from '@/lib/services/refundService';
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('ORDERS', 'edit');
    let { id } = params;

    // Check if it is a MobileOrder ID
    const mobileOrder = await prisma.mobileOrder.findUnique({
      where: { id }
    });
    if (mobileOrder && mobileOrder.shopifyOrderId) {
      const syncedOrder = await prisma.order.findUnique({
        where: { shopifyOrderId: mobileOrder.shopifyOrderId }
      });
      if (syncedOrder) {
        id = syncedOrder.id;
      }
    }

    const email = session.user?.email || 'admin';

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.status.toLowerCase() !== 'cancelled') {
      return NextResponse.json({ success: false, error: 'Only cancelled orders can be refunded' }, { status: 400 });
    }

    console.log(`[Admin Refund Retry] Manual refund retry triggered by ${email} for Order ${id}`);
    const result = await processOrderRefund(id, email);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message || 'Refund successfully processed' });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Refund execution failed' }, { status: 500 });
    }
  } catch (error: any) {
    if (error?.message === '401' || error?.message === '403') {
      return handleAuthError(error);
    }
    console.error('[Admin Refund Retry API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
