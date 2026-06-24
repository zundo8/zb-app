import { NextRequest, NextResponse } from 'next/server';
import { eventTracker } from '@/lib/services/eventTracker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      customerId,
      customerPhone,
      orderId,
      productId,
      eventSource = 'web',
      metadata = {}
    } = body;

    if (!eventName) {
      return NextResponse.json({ error: 'Missing eventName parameter' }, { status: 400 });
    }

    const result = await eventTracker.track({
      eventName,
      customerId,
      customerPhone,
      orderId,
      productId,
      eventSource,
      metadata
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Track Event API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
