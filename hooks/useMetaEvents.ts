import { trackEvent, initPixel, getMetaIdentityCookies } from '@/lib/metaPixel';
import { event as trackGAEvent } from '@/lib/gtag';

// Meta Purchase event "value" intentionally set to 50% of actual order total for ad reporting purposes only.
// Does not affect displayed price, payment amount, or order records.
const META_PURCHASE_VALUE_MULTIPLIER = 0.5;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sendToCapiRoute(payload: Record<string, any>) {
  try {
    // Always include identity cookies (fbc, fbp, external_id, PII) for maximum
    // Meta Event Match Quality. Explicit userData from event callers takes priority.
    const identityData = getMetaIdentityCookies();
    const enrichedPayload = {
      ...payload,
      userData: {
        ...identityData,
        ...(payload.userData || {}),
      },
    };
    await fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });
  } catch (err) {
    console.error('[CAPI send error]', err);
  }
}

function getBasePayload(eventName: string) {
  return {
    eventId: uuidv4(),
    eventName,
    eventSourceUrl: window.location.href,
    userAgent: navigator.userAgent,
    actionSource: 'website' as const,
    eventTime: Math.floor(Date.now() / 1000), // Sync event_time between client and server
  };
}

function cleanCustomData(data: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null && val !== '') {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export function useMetaEvents() {
  const trackViewContent = (contentId: string, contentName: string, value?: number, currency = 'INR', contentCategory?: string) => {
    const base = getBasePayload('ViewContent');
    const contents = value !== undefined ? [{ id: contentId, quantity: 1, item_price: value }] : [{ id: contentId, quantity: 1 }];
    const customData = cleanCustomData({
      content_ids: [contentId],
      content_name: contentName,
      currency,
      value,
      content_category: contentCategory,
      content_type: 'product',
      contents
    });
    trackEvent('ViewContent', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
    
    // GA4 equivalent: view_item
    trackGAEvent('view_item', {
      currency,
      value,
      items: [{
        item_id: contentId,
        item_name: contentName,
        price: value,
        item_category: contentCategory,
        quantity: 1
      }]
    });
  };

  const trackAddToCart = (contentId: string, contentName: string, value: number, currency = 'INR', contentCategory?: string) => {
    const base = getBasePayload('AddToCart');
    const customData = cleanCustomData({
      content_ids: [contentId],
      content_name: contentName,
      value,
      currency,
      content_category: contentCategory,
      content_type: 'product',
      contents: [{ id: contentId, quantity: 1, item_price: value }]
    });
    trackEvent('AddToCart', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
    
    // GA4 equivalent: add_to_cart
    trackGAEvent('add_to_cart', {
      currency,
      value,
      items: [{
        item_id: contentId,
        item_name: contentName,
        price: value,
        item_category: contentCategory,
        quantity: 1
      }]
    });
  };

  const trackRemoveFromCart = (contentId: string, contentName: string, value?: number, currency = 'INR', contentCategory?: string) => {
    const base = getBasePayload('RemoveFromCart');
    const contents = value !== undefined ? [{ id: contentId, quantity: 1, item_price: value }] : [{ id: contentId, quantity: 1 }];
    const customData = cleanCustomData({
      content_ids: [contentId],
      content_name: contentName,
      currency,
      value,
      content_category: contentCategory,
      content_type: 'product',
      contents
    });
    // fbq does not natively support RemoveFromCart as standard, send as custom or fbq track
    trackEvent('RemoveFromCart' as any, customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
  };

  const trackAddToWishlist = (contentId: string, contentName: string, contentCategory?: string, value?: number, currency = 'INR') => {
    const base = getBasePayload('AddToWishlist');
    const customData = cleanCustomData({
      content_ids: [contentId],
      content_name: contentName,
      content_category: contentCategory,
      content_type: 'product',
      contents: [{ id: contentId, quantity: 1, item_price: value }],
      value,
      currency
    });
    trackEvent('AddToWishlist', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
    
    // GA4 equivalent: add_to_wishlist
    trackGAEvent('add_to_wishlist', {
      items: [{
        item_id: contentId,
        item_name: contentName,
        item_category: contentCategory,
        quantity: 1
      }]
    });
  };

  const trackAddPaymentInfo = (
    userData?: {
      country?: string;
      st?: string;
      ge?: string;
      ct?: string;
      zp?: string;
      fn?: string;
      ln?: string;
      em?: string;
      ph?: string;
      external_id?: string;
      fb_login_id?: string;
    },
    value?: number,
    currency = 'INR',
    contentIds?: string[],
    contents?: { id: string; quantity: number; item_price?: number }[]
  ) => {
    const base = getBasePayload('AddPaymentInfo');
    if (userData) {
      initPixel(userData);
    }
    const finalContents = contents || (contentIds ? contentIds.map(id => ({ id, quantity: 1 })) : []);
    const customData = cleanCustomData({
      value,
      currency,
      content_ids: contentIds,
      content_type: 'product',
      contents: finalContents
    });
    trackEvent('AddPaymentInfo', customData, base.eventId);
    sendToCapiRoute({ 
      ...base, 
      customData, 
      userData: { client_user_agent: navigator.userAgent, ...userData } 
    });

    // GA4 equivalent: add_payment_info
    trackGAEvent('add_payment_info');
  };

  const trackInitiateCheckout = (
    value: number,
    numItems: number,
    currency = 'INR',
    contentCategory?: string,
    contentIds?: string[],
    userData?: any,
    contents?: { id: string; quantity: number; item_price?: number }[]
  ) => {
    const base = getBasePayload('InitiateCheckout');
    if (userData) {
      initPixel(userData);
    }
    const finalContents = contents || (contentIds ? contentIds.map(id => ({ id, quantity: 1 })) : []);
    const customData = cleanCustomData({
      value,
      num_items: numItems,
      currency,
      content_category: contentCategory,
      content_ids: contentIds,
      content_type: 'product',
      contents: finalContents
    });
    trackEvent('InitiateCheckout', customData, base.eventId);
    sendToCapiRoute({ 
      ...base, 
      customData,
      userData: { client_user_agent: navigator.userAgent, ...userData }
    });
    
    // GA4 equivalent: begin_checkout
    trackGAEvent('begin_checkout', {
      value,
      currency,
      items: finalContents.map(item => ({
        item_id: item.id,
        quantity: item.quantity
      }))
    });
  };

  const trackPurchase = (
    orderId: string,
    value: number,
    currency = 'INR',
    contentIds: string[],
    userData?: {
      country?: string;
      st?: string;
      ge?: string;
      ct?: string;
      zp?: string;
      fn?: string;
      ln?: string;
      em?: string;
      ph?: string;
      external_id?: string;
      fb_login_id?: string;
    },
    contentCategory?: string,
    contents?: { id: string; quantity: number; item_price?: number }[]
  ) => {
    const base = { ...getBasePayload('Purchase'), eventId: orderId }; // use order ID as event ID for dedup
    if (userData) {
      initPixel(userData);
    }
    const finalContents = contents || contentIds.map(id => ({ id, quantity: 1, item_price: value / (contentIds.length || 1) }));
    // Meta Purchase event "value" intentionally set to 50% of actual order total for ad reporting purposes only.
    // Does not affect displayed price, payment amount, or order records.
    const metaPurchaseValue = Math.round(value * META_PURCHASE_VALUE_MULTIPLIER * 100) / 100;
    const customData = cleanCustomData({
      value: metaPurchaseValue,
      currency,
      content_ids: contentIds,
      order_id: orderId,
      content_category: contentCategory,
      content_type: 'product',
      contents: finalContents,
      num_items: finalContents.reduce((sum, item) => sum + item.quantity, 0)
    });
    trackEvent('Purchase', customData, base.eventId);
    sendToCapiRoute({
      ...base,
      customData,
      userData: { client_user_agent: navigator.userAgent, ...userData },
    });
    
    // GA4 equivalent: purchase (uses full original value, not the Meta-adjusted value)
    trackGAEvent('purchase', {
      transaction_id: orderId,
      value,
      currency,
      items: finalContents.map(item => ({
        item_id: item.id,
        quantity: item.quantity,
        price: item.item_price
      }))
    });
  };

  const trackCompleteRegistration = () => {
    const base = getBasePayload('CompleteRegistration');
    const customData = {
      status: 'completed',
      content_name: 'registration'
    };
    trackEvent('CompleteRegistration', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
    
    // GA4 equivalent: sign_up
    trackGAEvent('sign_up');
  };

  const trackSearch = (searchString: string) => {
    const base = getBasePayload('Search');
    const customData = {
      search_string: searchString,
      content_type: 'product'
    };
    trackEvent('Search', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
    
    // GA4 equivalent: search
    trackGAEvent('search', {
      search_term: searchString
    });
  };

  const trackContact = () => {
    const base = getBasePayload('Contact');
    trackEvent('Contact', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: contact
    trackGAEvent('contact');
  };

  const trackFindLocation = () => {
    const base = getBasePayload('FindLocation');
    trackEvent('FindLocation', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: find_location
    trackGAEvent('find_location');
  };

  const trackSchedule = () => {
    const base = getBasePayload('Schedule');
    trackEvent('Schedule', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: schedule
    trackGAEvent('schedule');
  };

  const trackStartTrial = () => {
    const base = getBasePayload('StartTrial');
    trackEvent('StartTrial', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: start_trial
    trackGAEvent('start_trial');
  };

  const trackSubscribe = () => {
    const base = getBasePayload('Subscribe');
    trackEvent('Subscribe', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: subscribe
    trackGAEvent('subscribe');
  };

  const trackLead = (value?: number, currency = 'INR', contentCategory?: string, contentName?: string) => {
    const base = getBasePayload('Lead');
    const customData = cleanCustomData({
      value,
      currency,
      content_category: contentCategory,
      content_name: contentName
    });
    trackEvent('Lead', customData, base.eventId);
    sendToCapiRoute({ ...base, customData });
  };

  return {
    trackViewContent,
    trackAddToCart,
    trackRemoveFromCart,
    trackAddToWishlist,
    trackAddPaymentInfo,
    trackInitiateCheckout,
    trackPurchase,
    trackCompleteRegistration,
    trackSearch,
    trackContact,
    trackFindLocation,
    trackSchedule,
    trackStartTrial,
    trackSubscribe,
    trackLead,
  };
}
