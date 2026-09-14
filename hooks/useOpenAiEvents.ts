/**
 * OpenAI (ChatGPT) Ads — Client Event Hook
 * Parallels hooks/useSnapEvents.ts
 *
 * Provides per-event methods that fire both the browser pixel
 * and the server-side CAPI route with a shared eventId for dedup.
 */

import { trackOpenAiClientEvent, toMinorUnits, readObrefCookie, OPENAI_ADS_PIXEL_ID } from '@/lib/openaiPixel';
import { getClientCookie } from '@/lib/snapPixel';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const firedEventsCache = new Map<string, number>();

function shouldFireEvent(key: string): boolean {
  const now = Date.now();
  const lastFired = firedEventsCache.get(key);
  if (lastFired && now - lastFired < 1000) {
    return false;
  }
  firedEventsCache.set(key, now);
  return true;
}

async function sendToOpenAiCapiRoute(payload: Record<string, any>): Promise<any> {
  try {
    // Merge guest identity cookies (same pattern as Snap)
    const isLoggedIn = getClientCookie('zb_user_logged_in') === 'true';
    const isCheckoutEvent = ['checkout_started', 'order_created'].includes(payload.eventName);

    const identityData: Record<string, any> = {};
    if (isLoggedIn || isCheckoutEvent) {
      identityData.em = getClientCookie('zb_guest_email') || undefined;
      identityData.ph = getClientCookie('zb_guest_phone') || undefined;
      identityData.fn = getClientCookie('zb_guest_fn') || undefined;
      identityData.ln = getClientCookie('zb_guest_ln') || undefined;
    }

    const callerUserData = payload.userData || {};
    const mergedUserData = {
      ...identityData,
      ...callerUserData,
    };

    // For lead_created, always forward the email even if not logged in
    if (!isLoggedIn && !isCheckoutEvent && payload.eventName === 'lead_created' && payload.userData?.em) {
      mergedUserData.em = payload.userData.em;
    }

    const enrichedPayload = {
      ...payload,
      userData: mergedUserData,
    };

    const res = await fetch('/api/openai-ads/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Silent — no console spam per spec
  }
  return null;
}

function getBasePayload(eventName: string, overrideEventId?: string) {
  return {
    eventId: overrideEventId || `${eventName}_oai_${uuidv4()}`,
    eventName,
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    eventTime: Date.now(),
  };
}

export interface OpenAiContentItem {
  id: string;
  name?: string;
  content_type?: string;
  quantity?: number;
  amount?: number;   // integer minor units
  currency?: string;
}

export function useOpenAiEvents() {
  const trackPageView = () => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const cacheKey = `OAI-PageView-${typeof window !== 'undefined' ? window.location.pathname : ''}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('page_viewed');
    const data = { type: 'contents' as const };

    trackOpenAiClientEvent('page_viewed', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data });
  };

  const trackContentsViewed = (
    contentId: string,
    contentName: string,
    value?: number,
    currency = 'INR',
    contentCategory?: string,
  ) => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const cacheKey = `OAI-ContentsViewed-${contentId}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('contents_viewed');
    const data: Record<string, any> = {
      type: 'contents',
      contents: [{
        id: contentId,
        name: contentName,
        content_type: 'product',
        quantity: 1,
        ...(value !== undefined ? { amount: toMinorUnits(value, currency), currency } : {}),
      }],
    };
    if (value !== undefined) {
      data.amount = toMinorUnits(value, currency);
      data.currency = currency;
    }

    trackOpenAiClientEvent('contents_viewed', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data });
  };

  const trackItemsAdded = (
    contentId: string,
    contentName: string,
    value: number,
    currency = 'INR',
    contentCategory?: string,
    numberItems = 1,
  ) => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const cacheKey = `OAI-ItemsAdded-${contentId}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('items_added');
    const data: Record<string, any> = {
      type: 'contents',
      amount: toMinorUnits(value, currency),
      currency,
      contents: [{
        id: contentId,
        name: contentName,
        content_type: 'product',
        quantity: numberItems,
        amount: toMinorUnits(value, currency),
        currency,
      }],
    };

    trackOpenAiClientEvent('items_added', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data });
  };

  const trackCheckoutStarted = (
    value: number,
    numberItems: number,
    currency = 'INR',
    contentCategory?: string,
    contentIds?: string[],
    userData?: Record<string, any>,
  ) => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const cacheKey = `OAI-CheckoutStarted-${value}-${numberItems}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('checkout_started');
    const contents: OpenAiContentItem[] = (contentIds || []).map(id => ({
      id,
      content_type: 'product',
      quantity: 1,
    }));
    const data: Record<string, any> = {
      type: 'contents',
      amount: toMinorUnits(value, currency),
      currency,
      ...(contents.length > 0 ? { contents } : {}),
    };

    trackOpenAiClientEvent('checkout_started', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data, userData });
  };

  const trackOrderCreated = (
    orderId: string,
    value: number,
    currency = 'INR',
    contents: OpenAiContentItem[] = [],
    userData?: Record<string, any>,
  ) => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const cacheKey = `OAI-OrderCreated-${orderId}`;
    if (!shouldFireEvent(cacheKey)) return;

    // Use orderId as eventId for dedup with server-side fire
    const base = getBasePayload('order_created', orderId);
    const data: Record<string, any> = {
      type: 'contents',
      amount: toMinorUnits(value, currency),
      currency,
      ...(contents.length > 0 ? { contents } : {}),
    };

    trackOpenAiClientEvent('order_created', data, orderId);
    sendToOpenAiCapiRoute({ ...base, data, userData });
  };

  const trackLeadCreated = (email?: string) => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const base = getBasePayload('lead_created');
    const data = { type: 'customer_action' as const };
    const userData = email ? { em: email } : undefined;

    trackOpenAiClientEvent('lead_created', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data, userData });
  };

  const trackRegistrationCompleted = () => {
    if (!OPENAI_ADS_PIXEL_ID) return;
    const base = getBasePayload('registration_completed');
    const data = { type: 'customer_action' as const };

    trackOpenAiClientEvent('registration_completed', data, base.eventId);
    sendToOpenAiCapiRoute({ ...base, data });
  };

  return {
    trackPageView,
    trackContentsViewed,
    trackItemsAdded,
    trackCheckoutStarted,
    trackOrderCreated,
    trackLeadCreated,
    trackRegistrationCompleted,
  };
}
