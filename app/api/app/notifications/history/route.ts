import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  const auth = getAppAuthFromRequest(req);
  console.log(`[API] Fetching notification history. Auth: ${auth ? auth.customerId : 'GUEST'}`);
  
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Fetch customer to check segment membership
    let isVip = false;
    if (auth?.customerId) {
      const customer = await db.customer.findUnique({
        where: { id: auth.customerId },
        select: { ordersCount: true }
      });
      if (customer && customer.ordersCount > 3) {
        isVip = true;
      }
    }

    // Fetch notifications that were either 'all' target, specific to this user, or matching their segment
    const notifications = await db.notificationSend.findMany({
      where: {
        status: 'sent',
        OR: [
          { targetType: 'all' },
          auth?.customerId ? { 
            AND: [
              { targetType: 'user' },
              { 
                OR: [
                  { targetValue: auth.customerId },
                  auth.customerPhone ? { targetValue: auth.customerPhone } : { targetValue: 'NEVER_MATCH' },
                  auth.customerEmail ? { targetValue: auth.customerEmail } : { targetValue: 'NEVER_MATCH' },
                ]
              }
            ]
          } : { targetType: 'NEVER_MATCH' },
          isVip ? { targetType: 'segment' } : { targetType: 'NEVER_MATCH' }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[API] Found ${notifications.length} notifications for ${auth ? auth.customerId : 'GUEST'}`);

    return NextResponse.json({
      success: true,
      notifications: notifications.map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        date: n.createdAt,
        isRead: false, // We'd need a separate table to track per-user read status
        data: n.data ? JSON.parse(n.data) : {}
      }))
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('App notification fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
