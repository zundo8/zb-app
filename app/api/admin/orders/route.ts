import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllOrders } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const fulfillmentStatus = searchParams.get('fulfillmentStatus');
    const platform = searchParams.get('platform');
    const search = searchParams.get('search');
    const sync = searchParams.get('sync') === 'true';

    // Removed automatic live sync on every request to avoid "heavy load" and timeout issues.
    // Syncing is now handled manually via the 'Sync Shopify' button in the dashboard.

    const conditions: any[] = [];
    
    // ─── STRICT ORDER SEPARATION ───
    // The main Orders page should ONLY show orders that are either:
    // 1. Native Shopify orders (synced or direct)
    // 2. Mobile orders that have been APPROVED and SYNCED to Shopify (numeric shopifyOrderId)
    // It must EXCLUDE any mobile order that is still in pending/awaiting_approval status (starting with # or ZB)
    conditions.push({
      NOT: {
        AND: [
          { orderType: 'MOBILE_APP' },
          { 
            OR: [
              { shopifyOrderId: { startsWith: 'ZB' } },
              { shopifyOrderId: { startsWith: '#ZB' } },
              { shopifyOrderId: { contains: '#' } },
              { status: 'awaiting_approval' },
              { status: 'payment_pending' }
            ]
          }
        ]
      }
    });

    if (status && status !== 'any') {
      conditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== 'any') {
      if (paymentStatus === 'failed') {
        conditions.push({ 
          OR: [
            { paymentStatus: 'failed' },
            { paymentStatus: 'voided' },
            { status: 'payment_failed' }
          ]
        });
      } else {
        conditions.push({ paymentStatus });
      }
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'any') {
      conditions.push({ fulfillmentStatus });
    }

    if (search) {
      conditions.push({
        OR: [
          { shopifyOrderId: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { tags: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};
    console.log('[Admin Orders] Final WHERE clause:', JSON.stringify(where));

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        items: true,
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.order.count({ where });

    return NextResponse.json({
      success: true,
      orders,
      total,
      hasMore: total > offset + limit
    });
  } catch (error: any) {
    console.error('[Admin Orders API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
