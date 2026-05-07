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

    // Fetch notifications that were either 'all' target or specific to this user
    const notifications = await db.notificationSend.findMany({
      where: {
        status: 'sent',
        OR: [
          { targetType: 'all' },
          auth?.customerId ? { 
            AND: [
              { targetType: 'user' },
              { targetValue: auth.customerId }
            ]
          } : { targetType: 'NEVER_MATCH' }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[API] Found ${notifications.length} notifications for ${auth ? auth.customerId : 'GUEST'}`);

    return NextResponse.json({
      success: true,
      notifications: notifications.map(n => ({
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
