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

    // Issue 4 diagnostics (no session dependency — runs before fast path)
    if (process.env.NODE_ENV !== 'production' || process.env.META_TEST_EVENT_CODE) {
      const headersObj: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      console.log(`[Meta CAPI Route IP Diagnostics] Event: ${eventName} | Raw Headers:`, JSON.stringify(headersObj));
    }

    // Extract request-scoped data (synchronous — no I/O)
    const ip = req.cookies.get('zb_client_ip')?.value ||
               req.headers.get('do-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               req.headers.get('x-real-ip') || 
               req.ip || 
               '127.0.0.1';

    const fbp = req.cookies.get('_fbp')?.value;
    const fbc = req.cookies.get('_fbc')?.value;
    const externalId = req.cookies.get('zb_external_id')?.value;
    const isLoggedIn = req.cookies.get('zb_user_logged_in')?.value === 'true';

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

    // Issue 5 fix: Apply server-side value adjustment for Purchase and InitiateCheckout.
    // The client sends the real order/cart value; the adjustment happens here so
    // the real value is never exposed in browser JS or network traffic to Meta.
    // This runs BEFORE any I/O so it's available for the fast-path response.
    let adjustedCustomData = customData ? { ...customData } : undefined;
    if (adjustedCustomData?.value !== undefined) {
      const realValue = adjustedCustomData.value;
      const reportedValue = getReportedValue(eventName, realValue);
      if (reportedValue !== undefined && reportedValue !== realValue) {
        // Dev-only: log both values for internal debugging (never sent to Meta or client)
        if (process.env.NODE_ENV !== 'production' || process.env.META_TEST_EVENT_CODE) {
          console.log(`[Meta CAPI Route] ${eventName} value adjustment — realValue=${realValue}, reportedValue=${reportedValue}, currency=${adjustedCustomData.currency || 'NOT SET'}`);
        }
        adjustedCustomData.value = reportedValue;

        // Scale individual product prices in contents array to avoid mismatch
        if (realValue > 0 && Array.isArray(adjustedCustomData.contents)) {
          const ratio = reportedValue / realValue;
          adjustedCustomData.contents = adjustedCustomData.contents.map((item: any) => {
            const originalItemPrice = item.price !== undefined ? item.price : item.item_price;
            if (originalItemPrice !== undefined && originalItemPrice !== null) {
              const scaledPrice = Math.round(originalItemPrice * ratio * 100) / 100;
              return {
                ...item,
                price: scaledPrice,
                item_price: scaledPrice
              };
            }
            return item;
          });
        }
      }
    }

    // === FAST PATH: Purchase/InitiateCheckout ===
    // Return reportedValue/currency immediately; fire session/Prisma/CAPI in background.
    // This ensures the client receives the adjusted value well within the 2500ms timeout,
    // eliminating the Pixel↔CAPI value mismatch that was degrading Data Quality Score.
    if (['Purchase', 'InitiateCheckout'].includes(eventName)) {
      // Build mergedUserData from cookies + body userData (no session await needed).
      // By the time a user reaches checkout/purchase, MetaPixelRouteTracker has already
      // hashed and stored all session PII in cookies (email, phone, name, DOB, address).
      const mergedUserData: Record<string, any> = {
        client_ip_address: ip,
        client_user_agent: userData?.client_user_agent || userAgent,
        fbp: userData?.fbp || fbp,
        fbc: userData?.fbc || fbc,
        external_id: userData?.external_id || externalId,
        em: userData?.em || guestEmail,
        ph: userData?.ph || guestPhone,
        fn: userData?.fn || guestFn,
        ln: userData?.ln || guestLn,
        country: userData?.country || guestCountry,
        st: userData?.st || guestState,
        ct: userData?.ct || guestCity,
        zp: userData?.zp || guestZip,
        fb_login_id: userData?.fb_login_id || fbLoginId,
        db: userData?.db || guestDob,
      };

      const presentKeys = Object.entries(mergedUserData)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([key]) => key);
      console.log(`[Meta CAPI Event Received] ${eventName} — Deduplication ID: ${eventId} — Customer Identifiers Present: [${presentKeys.join(', ')}]`);

      // Fire CAPI send in background — do NOT await before responding
      sendCapiEvent({
        eventName,
        eventId,
        eventTime,
        eventSourceUrl,
        userAgent,
        userData: mergedUserData,
        customData: adjustedCustomData,
        actionSource: actionSource ?? 'website',
      }).catch((err: any) => {
        console.error(`[Meta CAPI Background ${eventName}] eventId=${eventId} Error:`, err);
      });

      return NextResponse.json({
        success: true,
        reportedValue: adjustedCustomData?.value,
        currency: adjustedCustomData?.currency,
        contents: adjustedCustomData?.contents
      });
    }

    // === STANDARD PATH: All other events (sequential — existing behavior) ===
    const session = await getServerSession(authOptions);

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
    const mergedUserData: Record<string, any> = {
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

    const userIsLoggedIn = isLoggedIn || !!session?.user;
    const isCheckoutEvent = ['InitiateCheckout', 'AddPaymentInfo', 'Purchase'].includes(eventName);

    // If the visitor is not logged in and it's not a checkout event, strip all PII parameters.
    // Omit em, ph, name, address, DOB, fb_login_id. Keep only browser parameters.
    if (!userIsLoggedIn && !isCheckoutEvent) {
      delete mergedUserData.em;
      delete mergedUserData.ph;
      delete mergedUserData.fn;
      delete mergedUserData.ln;
      delete mergedUserData.country;
      delete mergedUserData.st;
      delete mergedUserData.ct;
      delete mergedUserData.zp;
      delete mergedUserData.db;
      delete mergedUserData.fb_login_id;
    }

    // Log identifier coverage summary (what identifiers are present, not the actual values)
    const presentKeys = Object.entries(mergedUserData)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key]) => key);
    console.log(`[Meta CAPI Event Received] ${eventName} — Deduplication ID: ${eventId} — Customer Identifiers Present: [${presentKeys.join(', ')}]`);

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

    return NextResponse.json({ ...result }, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error('[Meta CAPI Route Error]', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
