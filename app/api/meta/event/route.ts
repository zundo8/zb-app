import { NextRequest, NextResponse } from 'next/server';
import { sendCapiEvent, getReportedValue } from '@/lib/metaCapi';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

function normalizePhone(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const digits = p.replace(/\D/g, "");
  let base = digits;
  if (digits.length === 12 && digits.startsWith("91")) base = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) base = digits.slice(1);
  return `91${base}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      eventId,
      eventTime, // Received from client for perfect browser-server timestamp sync
      eventSourceUrl,
      userAgent,
      userData,
      customData,
      actionSource,
    } = body;

    // Strict payload validation
    if (!eventName || !eventId || !eventSourceUrl || !userAgent) {
      console.warn('[Meta CAPI Route] Rejected invalid payload: Missing required event metadata');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);

    // Issue 4 diagnostics
    if (process.env.NODE_ENV !== 'production' || process.env.META_TEST_EVENT_CODE) {
      const headersObj: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      console.log(`[Meta CAPI Route IP Diagnostics] Event: ${eventName} | Raw Headers:`, JSON.stringify(headersObj));
    }

    const ip = req.headers.get('do-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
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
    const guestDob = req.cookies.get('zb_guest_dob')?.value;

    const sessionUserData: Record<string, any> = {};
    if (session?.user) {
      sessionUserData.em = session.user.email || undefined;
      const rawPhone = (session.user as any).phone || (session as any).customer?.phone || undefined;
      sessionUserData.ph = normalizePhone(rawPhone);
      const name = session.user.name;
      if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts[0]) sessionUserData.fn = parts[0];
        if (parts.length > 1) sessionUserData.ln = parts.slice(1).join(' ');
      }
      sessionUserData.external_id = (session.user as any).id || undefined;

      const customerId = (session.user as any).id;
      if (customerId) {
        const member = await prisma.communityMember.findUnique({
          where: { customerId },
          select: { dob: true, isVerified: true }
        });
        if (member?.isVerified && member?.dob) {
          const d = new Date(member.dob);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          sessionUserData.db = `${yyyy}${mm}${dd}`;
        }
      }
    }

    // Merge user identity data. Priority: body userData (client-forwarded cookies, most reliable)
    // → server-side cookies → session data. The client always forwards identity cookies in the
    // body for reliability, since server-side cookie access can fail on edge/CDN.
    const mergedUserData = {
      client_ip_address: ip,
      client_user_agent: userData?.client_user_agent || userAgent,
      fbp: userData?.fbp || fbp,
      fbc: userData?.fbc || fbc,
      external_id: userData?.external_id || externalId || sessionUserData.external_id,
      em: userData?.em || guestEmail || sessionUserData.em,
      ph: userData?.ph || guestPhone || sessionUserData.ph,
      fn: userData?.fn || guestFn || sessionUserData.fn,
      ln: userData?.ln || guestLn || sessionUserData.ln,
      country: userData?.country || guestCountry,
      st: userData?.st || guestState,
      ct: userData?.ct || guestCity,
      zp: userData?.zp || guestZip,
      fb_login_id: userData?.fb_login_id || fbLoginId,
      db: userData?.db || guestDob || sessionUserData.db,
    };

    // Issue 4 fix: For PageView events without an authenticated session,
    // strip ph to prevent duplicate phone hash being sent for anonymous visitors.
    // ph should only be sent when we have a real per-user phone number.
    if (eventName === 'PageView' && !session?.user) {
      delete mergedUserData.ph;
    }

    // Log identifier coverage summary (what identifiers are present, not the actual values)
    const presentKeys = Object.entries(mergedUserData)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key]) => key);
    console.log(`[Meta CAPI Event Received] ${eventName} — Deduplication ID: ${eventId} — Customer Identifiers Present: [${presentKeys.join(', ')}]`);

    // Issue 5 fix: Apply server-side value adjustment for Purchase and InitiateCheckout.
    // The client sends the real order/cart value; the adjustment happens here so
    // the real value is never exposed in browser JS or network traffic to Meta.
    let adjustedCustomData = customData ? { ...customData } : undefined;
    if (adjustedCustomData?.value !== undefined) {
      const realValue = adjustedCustomData.value;
      const reportedValue = getReportedValue(eventName, realValue);
      if (reportedValue !== realValue) {
        // Dev-only: log both values for internal debugging (never sent to Meta or client)
        if (process.env.NODE_ENV !== 'production' || process.env.META_TEST_EVENT_CODE) {
          console.log(`[Meta CAPI Route] ${eventName} value adjustment — realValue=${realValue}, reportedValue=${reportedValue}, currency=${adjustedCustomData.currency || 'NOT SET'}`);
        }
        adjustedCustomData.value = reportedValue;
      }
    }

    const result = await sendCapiEvent({
      eventName,
      eventId,
      eventTime, // Forward the exact event time generated on the client
      eventSourceUrl,
      userAgent,
      userData: mergedUserData,
      customData: adjustedCustomData,
      actionSource: actionSource ?? 'website',
    });

    const responsePayload: Record<string, any> = { ...result };
    if (['Purchase', 'InitiateCheckout'].includes(eventName)) {
      responsePayload.reportedValue = adjustedCustomData?.value;
      responsePayload.currency = adjustedCustomData?.currency;
    }

    return NextResponse.json(responsePayload, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error('[Meta CAPI Route Error]', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
