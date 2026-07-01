import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processOrderRefund } from '@/lib/services/refundService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Basic verification token to prevent arbitrary triggers in production
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    // Only check in production
    if (process.env.NODE_ENV === 'production' && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Refund Retry] Commencing auto refund retries...');

    // Fetch all cancelled orders where refund failed and attempts < 3
    const failedOrders = await prisma.order.findMany({
      where: {
        status: 'cancelled',
        refundStatus: 'failed',
        refundAttempts: { lt: 3 }
      },
      select: {
        id: true,
        internalOrderNumber: true,
        refundAttempts: true
      }
    });

    console.log(`[Cron Refund Retry] Found ${failedOrders.length} failed refund records to retry.`);

    const results = [];
    for (const order of failedOrders) {
      console.log(`[Cron Refund Retry] Retrying refund for Order ${order.internalOrderNumber} (Attempt #${order.refundAttempts + 1})...`);
      const res = await processOrderRefund(order.id, 'cron');
      results.push({
        orderId: order.id,
        orderNumber: order.internalOrderNumber,
        success: res.success,
        error: res.error || null
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('[Cron Refund Retry API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
