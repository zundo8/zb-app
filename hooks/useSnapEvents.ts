import { trackSnapClientEvent, getSnapIdentityCookies, getClientCookie } from '@/lib/snapPixel';

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

async function sendToSnapCapiRoute(payload: Record<string, any>): Promise<any> {
  try {
    const snapIdentity = getSnapIdentityCookies();
    const isLoggedIn = getClientCookie('zb_user_logged_in') === 'true';
    const isCheckoutEvent = ['START_CHECKOUT', 'ADD_BILLING', 'PURCHASE'].includes(payload.eventName);

    const identityData: Record<string, any> = { ...snapIdentity };
    if (!isLoggedIn && !isCheckoutEvent) {
      delete identityData.em;
      delete identityData.ph;
      delete identityData.fn;
      delete identityData.ln;
    }

    const callerUserData = payload.userData || {};
    const mergedUserData = {
      ...identityData,
      ...callerUserData,
    };

    if (!isLoggedIn && !isCheckoutEvent && payload.eventName === 'SUBSCRIBE' && payload.userData?.em) {
      mergedUserData.em = payload.userData.em;
    }

    const enrichedPayload = {
      ...payload,
      userData: mergedUserData,
    };

    const res = await fetch('/api/snap/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('[Snap CAPI send error]', err);
  }
  return null;
}

function getBasePayload(eventName: string, overrideEventId?: string) {
  return {
    eventId: overrideEventId || `${eventName.toLowerCase()}_snap_${uuidv4()}`,
    eventName,
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    eventTime: Math.floor(Date.now() / 1000),
  };
}

export function useSnapEvents() {
  const trackViewContent = (
    contentId: string,
    contentName: string,
    value?: number,
    currency = 'INR',
    contentCategory?: string,
    userData?: Record<string, any>
  ) => {
    const cacheKey = `Snap-ViewContent-${contentId}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('VIEW_CONTENT');
    const customData: Record<string, any> = {
      price: value,
      currency,
      item_ids: [contentId],
      item_category: contentCategory,
      description: contentName,
    };

    trackSnapClientEvent('VIEW_CONTENT', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData, userData });
  };

  const trackAddToCart = (
    contentId: string,
    contentName: string,
    value: number,
    currency = 'INR',
    contentCategory?: string,
    numberItems = 1
  ) => {
    const cacheKey = `Snap-AddToCart-${contentId}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('ADD_CART');
    const customData: Record<string, any> = {
      price: value,
      currency,
      item_ids: [contentId],
      item_category: contentCategory,
      number_items: numberItems,
      description: contentName,
    };

    trackSnapClientEvent('ADD_CART', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData });
  };

  const trackAddToWishlist = (
    contentId: string,
    contentName: string,
    contentCategory?: string
  ) => {
    const base = getBasePayload('ADD_TO_WISHLIST');
    const customData: Record<string, any> = {
      item_ids: [contentId],
      item_category: contentCategory,
      description: contentName,
    };

    trackSnapClientEvent('ADD_TO_WISHLIST', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData });
  };

  const trackSearch = (
    searchString: string,
    contentIds?: string[],
    contentCategory?: string
  ) => {
    const base = getBasePayload('SEARCH');
    const customData: Record<string, any> = {
      search_string: searchString,
      item_ids: contentIds,
      item_category: contentCategory,
    };

    trackSnapClientEvent('SEARCH', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData });
  };

  const trackStartCheckout = (
    value: number,
    numberItems: number,
    currency = 'INR',
    contentCategory?: string,
    contentIds?: string[],
    userData?: Record<string, any>
  ) => {
    const cacheKey = `Snap-StartCheckout-${value}-${numberItems}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('START_CHECKOUT');
    const customData: Record<string, any> = {
      price: value,
      currency,
      number_items: numberItems,
      item_category: contentCategory,
      item_ids: contentIds,
    };

    trackSnapClientEvent('START_CHECKOUT', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData, userData });
  };

  const trackAddBilling = (
    value: number,
    currency = 'INR',
    userData?: Record<string, any>,
    contentIds?: string[]
  ) => {
    const base = getBasePayload('ADD_BILLING');
    const customData: Record<string, any> = {
      price: value,
      currency,
      item_ids: contentIds,
    };

    trackSnapClientEvent('ADD_BILLING', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData, userData });
  };

  const trackPurchase = (
    orderId: string,
    value: number,
    currency = 'INR',
    contentIds: string[] = [],
    userData?: Record<string, any>,
    contentCategory?: string,
    numberItems?: number
  ) => {
    const cacheKey = `Snap-Purchase-${orderId}`;
    if (!shouldFireEvent(cacheKey)) return;

    const base = getBasePayload('PURCHASE', orderId);
    const customData: Record<string, any> = {
      price: value,
      currency,
      item_ids: contentIds,
      item_category: contentCategory,
      number_items: numberItems || contentIds.length || 1,
      transaction_id: orderId,
    };

    trackSnapClientEvent('PURCHASE', customData, base.eventId);
    sendToSnapCapiRoute({ ...base, customData, userData });
  };

  const trackSignUp = () => {
    const base = getBasePayload('SIGN_UP');
    trackSnapClientEvent('SIGN_UP', {}, base.eventId);
    sendToSnapCapiRoute({ ...base });
  };

  const trackLogin = () => {
    const base = getBasePayload('LOGIN');
    trackSnapClientEvent('LOGIN', {}, base.eventId);
    sendToSnapCapiRoute({ ...base });
  };

  const trackSubscribe = (email?: string) => {
    const base = getBasePayload('SUBSCRIBE');
    const userData = email ? { em: email } : undefined;
    trackSnapClientEvent('SUBSCRIBE', {}, base.eventId);
    sendToSnapCapiRoute({ ...base, userData });
  };

  return {
    trackViewContent,
    trackAddToCart,
    trackAddToWishlist,
    trackSearch,
    trackStartCheckout,
    trackAddBilling,
    trackPurchase,
    trackSignUp,
    trackLogin,
    trackSubscribe,
  };
}
