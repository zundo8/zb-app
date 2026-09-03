import { NextRequest, NextResponse } from 'next/server';
import { sendSnapEvent } from '@/lib/snap-capi';
import { getReportedValue } from '@/lib/metaCapi';
import { getClientIP, lookupIpGeo } from '@/lib/ip-geo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventName,
      eventId,
      eventTime,
      eventSourceUrl,
      userAgent,
      userData,
      customData,
    } = body;

    if (!eventName || !eventId || !eventSourceUrl) {
      return NextResponse.json({ error: 'Missing required event parameters' }, { status: 400 });
    }

    // Exclude admin dashboard and admin routes
    const urlLower = (eventSourceUrl || '').toLowerCase();
    if (urlLower.includes('/dashboard') || urlLower.includes('/admin') || urlLower.includes('/web-store')) {
      return NextResponse.json({ success: false, skipped: true }, { status: 200 });
    }

    // Extract request-scoped metadata
    const ip = req.cookies.get('zb_client_ip')?.value ||
               req.headers.get('do-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               req.headers.get('x-real-ip') ||
               req.ip ||
               '127.0.0.1';

    const scClickId = req.cookies.get('ScCid')?.value || req.cookies.get('_sccid')?.value;
    const scCookie1 = req.cookies.get('_scid')?.value;
    const uuidC1 = req.cookies.get('zb_external_id')?.value;

    const guestEmail = req.cookies.get('zb_guest_email')?.value;
    const guestPhone = req.cookies.get('zb_guest_phone')?.value;
    const guestFn = req.cookies.get('zb_guest_fn')?.value;
    const guestLn = req.cookies.get('zb_guest_ln')?.value;
    const guestCountry = req.cookies.get('zb_guest_country')?.value;
    const guestState = req.cookies.get('zb_guest_st')?.value;
    const guestCity = req.cookies.get('zb_guest_ct')?.value;
    const guestZip = req.cookies.get('zb_guest_zp')?.value;

    // ── IP Geolocation Fallback ──
    // If all client-side address cookies are absent (user denied/ignored location prompt)
    // AND the event is not PURCHASE (that uses checkout Google Maps data),
    // look up city/state/country from the visitor's IP address.
    let ipGeo: Awaited<ReturnType<typeof lookupIpGeo>> = null;
    const hasClientGeo = !!(guestCountry || guestState || guestCity || guestZip);
    if (!hasClientGeo) {
      ipGeo = await lookupIpGeo(getClientIP(req));
    }

    // Apply server-side value adjustment for PURCHASE and START_CHECKOUT (matching Meta's getReportedValue)
    let adjustedCustomData = customData ? { ...customData } : undefined;
    if (adjustedCustomData?.price !== undefined) {
      const realValue = parseFloat(String(adjustedCustomData.price));
      const metaEventName = eventName === 'PURCHASE' ? 'Purchase' : (eventName === 'START_CHECKOUT' ? 'InitiateCheckout' : eventName);
      const reportedValue = getReportedValue(metaEventName, realValue);
      if (reportedValue !== undefined) {
        adjustedCustomData.price = reportedValue;
      }
    }

    const mergedUserData = {
      em: userData?.em || guestEmail,
      ph: userData?.ph || guestPhone,
      fn: userData?.fn || guestFn,
      ln: userData?.ln || guestLn,
      country: userData?.country || guestCountry || ipGeo?.countryCode?.toLowerCase(),
      st: userData?.st || guestState || ipGeo?.region,
      ct: userData?.ct || guestCity || ipGeo?.city,
      zp: userData?.zp || guestZip || ipGeo?.zip,
    };

    const result = await sendSnapEvent({
      eventName,
      eventId,
      eventTime,
      eventSourceUrl,
      userAgent: (userAgent && userAgent.trim()) ? userAgent : (req.headers.get('user-agent') || ''),
      ipAddress: ip,
      scClickId: userData?.sc_click_id || scClickId,
      scCookie1: userData?.sc_cookie1 || scCookie1,
      uuidC1: userData?.uuid_c1 || uuidC1,
      userData: mergedUserData,
      customData: adjustedCustomData,
    });

    return NextResponse.json({ ...result });
  } catch (err: any) {
    console.error('[Snap CAPI Route Error]', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
