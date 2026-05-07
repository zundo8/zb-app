import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const history = await db.notificationSend.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await db.notificationSend.count();

    return NextResponse.json({
      success: true,
      history,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch notification history:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
