/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const VALID_EVENTS = new Set([
  'page_view', 'view_item', 'add_to_cart', 'remove_from_cart',
  'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info',
  'payment_initiated', 'purchase', 'refund', 'cart_abandoned', 'cart_recovered',
  'session_started',
]);

export async function POST(req: Request) {
  // Rate limit: 120 req/min per IP
  const rateLimitResult = await checkRateLimit(req, 'analytics-track', { maxRequests: 120, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const body = await req.json();
    const {
      eventId, eventName, sessionId, anonymousId, platform,
      productId, variantId, cartId, orderId,
      value, currency, quantity, pageUrl, customerId,
      deviceType, browser, os, referrer,
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
      country, region, city, metadata,
    } = body;

    // Validate required fields
    if (!eventId || !eventName) {
      return NextResponse.json({ error: 'eventId and eventName are required' }, { status: 400 });
    }

    if (!VALID_EVENTS.has(eventName)) {
      return NextResponse.json({ error: 'Invalid event name' }, { status: 400 });
    }

    // Upsert session (if sessionId and anonymousId provided)
    if (sessionId && anonymousId) {
      try {
        const existing = await prisma.analyticsSession.findFirst({
          where: { id: sessionId },
        });

        if (existing) {
          // Update existing session
          await prisma.analyticsSession.update({
            where: { id: existing.id },
            data: {
              lastActiveAt: new Date(),
              currentPage: pageUrl || existing.currentPage,
              pageViews: eventName === 'page_view' ? { increment: 1 } : undefined,
              customerId: customerId || existing.customerId,
            },
          });
        } else {
          // Check if this is a new visitor (no previous sessions with this anonymousId)
          const prevSessionCount = await prisma.analyticsSession.count({
            where: { anonymousId },
          });

          await prisma.analyticsSession.create({
            data: {
              id: sessionId,
              anonymousId,
              customerId: customerId || null,
              platform: platform || 'web',
              landingPage: pageUrl || null,
              currentPage: pageUrl || null,
              pageViews: eventName === 'page_view' ? 1 : 0,
              deviceType: deviceType || null,
              browser: browser || null,
              os: os || null,
              referrer: referrer || null,
              utmSource: utmSource || null,
              utmMedium: utmMedium || null,
              utmCampaign: utmCampaign || null,
              country: country || null,
              region: region || null,
              city: city || null,
              isNew: prevSessionCount === 0,
            },
          });
        }
      } catch (sessionErr: any) {
        // Don't fail the event if session upsert fails
        console.warn('[Analytics] Session upsert failed:', sessionErr.message);
      }
    }

    // Insert event with deduplication via unique eventId
    try {
      await prisma.analyticsEvent.create({
        data: {
          eventId,
          eventName,
          sessionId: sessionId || null,
          customerId: customerId || null,
          anonymousId: anonymousId || null,
          platform: platform || 'web',
          productId: productId || null,
          variantId: variantId || null,
          cartId: cartId || null,
          orderId: orderId || null,
          value: value != null ? parseFloat(String(value)) : null,
          currency: currency || 'INR',
          quantity: quantity != null ? parseInt(String(quantity), 10) : null,
          pageUrl: pageUrl || null,
          referrer: referrer || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmContent: utmContent || null,
          utmTerm: utmTerm || null,
          deviceType: deviceType || null,
          browser: browser || null,
          os: os || null,
          country: country || null,
          region: region || null,
          city: city || null,
          metadata: metadata || null,
        },
      });
    } catch (eventErr: any) {
      // Unique constraint violation = duplicate event = silently ignore
      if (eventErr.code === 'P2002') {
        return NextResponse.json({ ok: true, dedup: true });
      }
      throw eventErr;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Analytics Track] Error:', error.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
