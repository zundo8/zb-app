import { NextResponse } from 'next/server';
import { trackShipment } from '@/lib/delhivery/api';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const awb = searchParams.get('awb');
    if (!awb) {
      return NextResponse.json({ error: 'AWB query parameter is required' }, { status: 400 });
    }

    const trackingData = await trackShipment(awb);
    if (!trackingData) {
      return NextResponse.json({ error: 'Failed to fetch tracking details from Delhivery' }, { status: 500 });
    }

    return NextResponse.json(trackingData);
  } catch (err: any) {
    console.error('[Track Shipment API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
