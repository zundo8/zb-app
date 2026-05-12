import { NextResponse } from 'next/server';
import { getShippingLabel } from '@/lib/delhivery';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { waybills } = body;

    if (!waybills || !Array.isArray(waybills) || waybills.length === 0) {
      return NextResponse.json({ success: false, error: 'No waybills provided' }, { status: 400 });
    }

    // Delhivery supports comma-separated waybills
    const result = await getShippingLabel(waybills, true);
    
    // The response structure might vary slightly, but usually it's result.pdf_url or result.packages[0].pdf_url
    const labelUrl = result.pdf_url || result.packages?.[0]?.pdf_url;

    if (labelUrl) {
      return NextResponse.json({ success: true, labelUrl });
    } else {
      return NextResponse.json({ success: false, error: 'Label generation failed', details: result });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
