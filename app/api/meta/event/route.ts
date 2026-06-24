import { NextRequest, NextResponse } from 'next/server';
import { sendCapiEvent } from '@/lib/metaCapi';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      eventId,
      eventSourceUrl,
      userAgent,
      userData,
      customData,
      actionSource,
    } = body;

    if (!eventName || !eventId || !eventSourceUrl || !userAgent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               req.headers.get('x-real-ip') || 
               req.ip || 
               '127.0.0.1';

    const fbp = req.cookies.get('_fbp')?.value;
    const fbc = req.cookies.get('_fbc')?.value;

    const mergedUserData = {
      ...userData,
      client_ip_address: ip,
      fbp: fbp || userData?.fbp,
      fbc: fbc || userData?.fbc,
    };

    console.log('[Meta CAPI Event Received]', eventName, { eventId, customData });

    const result = await sendCapiEvent({
      eventName,
      eventId,
      eventSourceUrl,
      userAgent,
      userData: mergedUserData,
      customData,
      actionSource: actionSource ?? 'website',
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error('[Meta CAPI Route Error]', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
