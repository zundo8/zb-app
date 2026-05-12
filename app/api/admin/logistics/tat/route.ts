import { NextResponse } from 'next/server';
import { getExpectedTAT } from '@/lib/delhivery';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const mot = (searchParams.get('mot') || 'S') as 'S' | 'E' | 'N';

    if (!origin || !destination) {
      return NextResponse.json({ success: false, error: 'Origin and destination are required' }, { status: 400 });
    }

    const tat = await getExpectedTAT(origin, destination, mot);
    return NextResponse.json({ success: true, tat });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
