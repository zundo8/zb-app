import { NextResponse } from 'next/server';
import { generateLabel } from '@/lib/delhivery/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const awb = searchParams.get('awb');
    if (!awb) {
      return NextResponse.json({ error: 'AWB query parameter is required' }, { status: 400 });
    }

    const pdfBlob = await generateLabel(awb);
    if (!pdfBlob) {
      return NextResponse.json({ error: 'Failed to generate label' }, { status: 500 });
    }

    const arrayBuffer = await pdfBlob.arrayBuffer();
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="label-${awb}.pdf"`,
      }
    });
  } catch (err: any) {
    console.error('[Label API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
