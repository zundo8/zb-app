import { NextResponse } from 'next/server';
import { schedulePickup } from '@/lib/delhivery/api';

export async function POST(req: Request) {
  try {
    const { pickupDatetime, packageCount } = await req.json();
    if (!pickupDatetime || !packageCount) {
      return NextResponse.json({ error: 'pickupDatetime and packageCount are required' }, { status: 400 });
    }

    const result = await schedulePickup(pickupDatetime, packageCount);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Schedule Pickup API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
