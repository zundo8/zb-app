/**
 * OpenAI (ChatGPT) Ads — CAPI Proxy Route
 * Parallels app/api/snap/event/route.ts
 *
 * POST /api/openai-ads/event
 * Accepts client event payloads and forwards them server-side
 * with IP, user-agent, identity enrichment, and value adjustment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendOpenAiEvent, toMinorUnits } from '@/lib/openai-capi';
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
      data,
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
    const ip = req.cookies.get('zb_client_ip')?.value || getClientIP(req);

    // Read __obref cookie for hybrid dedup
    const obref = req.cookies.get('__obref')?.value || undefined;

    // Guest identity cookies
    const guestEmail = req.cookies.get('zb_guest_email')?.value;
    const guestPhone = req.cookies.get('zb_guest_phone')?.value;
    const guestFn = req.cookies.get('zb_guest_fn')?.value;
    const guestLn = req.cookies.get('zb_guest_ln')?.value;
    const guestCountry = req.cookies.get('zb_guest_country')?.value;
    const guestState = req.cookies.get('zb_guest_st')?.value;
    const guestCity = req.cookies.get('zb_guest_ct')?.value;
    const guestZip = req.cookies.get('zb_guest_zp')?.value;

    // ── IP Geolocation Fallback ──
    let ipGeo: Awaited<ReturnType<typeof lookupIpGeo>> = null;
    const hasClientGeo = !!(guestCountry || guestState || guestCity || guestZip);
    if (!hasClientGeo) {
      ipGeo = await lookupIpGeo(getClientIP(req), req);
    }

    // ── Server-side value adjustment ──
    // Apply getReportedValue for purchase/checkout events (matching Meta/Snap)
    let adjustedData = data ? { ...data } : undefined;
    if (adjustedData?.amount !== undefined) {
      // The amount arriving here is already in minor units from the client hook.
      // Convert back to major units for getReportedValue, then re-convert.
      const majorValue = adjustedData.amount / 100;
      const metaEventName = eventName === 'order_created' ? 'Purchase' : (eventName === 'checkout_started' ? 'InitiateCheckout' : eventName);
      const reportedValue = getReportedValue(metaEventName, majorValue);
      if (reportedValue !== undefined) {
        adjustedData.amount = toMinorUnits(reportedValue, adjustedData.currency || 'INR');
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

    const result = await sendOpenAiEvent({
      eventName,
      eventId,
      eventSourceUrl,
      userAgent: (userAgent && userAgent.trim()) ? userAgent : (req.headers.get('user-agent') || ''),
      ipAddress: ip,
      obref,
      userData: mergedUserData,
      data: adjustedData,
    });

    return NextResponse.json({ ...result });
  } catch (err: any) {
    console.error('[OpenAI CAPI Route Error]', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
