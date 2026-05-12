import { NextResponse } from 'next/server';
import { fetchWaybill } from '@/lib/delhivery';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await fetchWaybill();
    // Delhivery response might be { waybill: "..." } or similar
    return NextResponse.json({ success: true, waybill: data.waybill || data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
