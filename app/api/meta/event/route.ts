import { NextRequest, NextResponse } from 'next/server';
import { sendCapiEvent } from '@/lib/metaCapi';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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

    const session = await getServerSession(authOptions);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               req.headers.get('x-real-ip') || 
               req.ip || 
               '127.0.0.1';

    const fbp = req.cookies.get('_fbp')?.value;
    const fbc = req.cookies.get('_fbc')?.value;
    const externalId = req.cookies.get('zb_external_id')?.value;

    const guestEmail = req.cookies.get('zb_guest_email')?.value;
    const guestPhone = req.cookies.get('zb_guest_phone')?.value;
    const guestFn = req.cookies.get('zb_guest_fn')?.value;
    const guestLn = req.cookies.get('zb_guest_ln')?.value;
    const guestCountry = req.cookies.get('zb_guest_country')?.value;
    const guestState = req.cookies.get('zb_guest_st')?.value;
    const guestCity = req.cookies.get('zb_guest_ct')?.value;
    const guestZip = req.cookies.get('zb_guest_zp')?.value;
    const fbLoginId = req.cookies.get('zb_fb_login_id')?.value;

    const sessionUserData: Record<string, any> = {};
    if (session?.user) {
      sessionUserData.em = session.user.email || undefined;
      sessionUserData.ph = (session.user as any).phone || (session as any).customer?.phone || undefined;
      const name = session.user.name;
      if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts[0]) sessionUserData.fn = parts[0];
        if (parts.length > 1) sessionUserData.ln = parts.slice(1).join(' ');
      }
      sessionUserData.external_id = (session.user as any).id || undefined;
    }

    const mergedUserData = {
      client_ip_address: ip,
      fbp: fbp || userData?.fbp,
      fbc: fbc || userData?.fbc,
      external_id: externalId || sessionUserData.external_id || userData?.external_id,
      em: guestEmail || sessionUserData.em || userData?.em,
      ph: guestPhone || sessionUserData.ph || userData?.ph,
      fn: guestFn || sessionUserData.fn || userData?.fn,
      ln: guestLn || sessionUserData.ln || userData?.ln,
      country: guestCountry || userData?.country,
      st: guestState || userData?.st,
      ct: guestCity || userData?.ct,
      zp: guestZip || userData?.zp,
      fb_login_id: fbLoginId || userData?.fb_login_id,
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
