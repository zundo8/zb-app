import { trackEvent } from '@/lib/metaPixel';
import { event as trackGAEvent } from '@/lib/gtag';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sendToCapiRoute(payload: Record<string, any>) {
  try {
    await fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  };
}

export function useMetaEvents() {
  const trackViewContent = (contentId: string, contentName: string, value?: number, currency = 'INR', contentCategory?: string) => {
    const base = getBasePayload('ViewContent');
    trackEvent('ViewContent', { content_ids: [contentId], content_name: contentName, currency, value, content_category: contentCategory }, base.eventId);
    sendToCapiRoute({ ...base, customData: { content_ids: [contentId], content_name: contentName, currency, value, content_category: contentCategory } });
    
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
    trackEvent('AddToCart', { content_ids: [contentId], content_name: contentName, value, currency, content_category: contentCategory }, base.eventId);
    sendToCapiRoute({ ...base, customData: { content_ids: [contentId], content_name: contentName, value, currency, content_category: contentCategory } });
    
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

  const trackAddToWishlist = (contentId: string, contentName: string, contentCategory?: string) => {
    const base = getBasePayload('AddToWishlist');
    trackEvent('AddToWishlist', { content_ids: [contentId], content_name: contentName, content_category: contentCategory }, base.eventId);
    sendToCapiRoute({ ...base, customData: { content_ids: [contentId], content_name: contentName, content_category: contentCategory } });
    
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

  const trackAddPaymentInfo = (userData?: { country?: string; st?: string; ge?: string; ct?: string; em?: string; ph?: string }) => {
    const base = getBasePayload('AddPaymentInfo');
    trackEvent('AddPaymentInfo', {}, base.eventId);
    sendToCapiRoute({ ...base, userData: { client_user_agent: navigator.userAgent, ...userData } });
    
    // GA4 equivalent: add_payment_info
    trackGAEvent('add_payment_info');
  };

  const trackInitiateCheckout = (value: number, numItems: number, currency = 'INR', contentCategory?: string) => {
    const base = getBasePayload('InitiateCheckout');
    trackEvent('InitiateCheckout', { value, num_items: numItems, currency, content_category: contentCategory }, base.eventId);
    sendToCapiRoute({ ...base, customData: { value, num_items: numItems, currency, content_category: contentCategory } });
    
    // GA4 equivalent: begin_checkout
    trackGAEvent('begin_checkout', {
      value,
      currency,
      items: []
    });
  };

  const trackPurchase = (
    orderId: string,
    value: number,
    currency = 'INR',
    contentIds: string[],
    userData?: { country?: string; st?: string; ge?: string; ct?: string; em?: string; ph?: string },
    contentCategory?: string
  ) => {
    const base = { ...getBasePayload('Purchase'), eventId: orderId }; // use order ID as event ID for dedup
    trackEvent('Purchase', { value, currency, content_ids: contentIds, order_id: orderId, content_category: contentCategory }, base.eventId);
    sendToCapiRoute({
      ...base,
      customData: { value, currency, content_ids: contentIds, order_id: orderId, content_category: contentCategory },
      userData: { client_user_agent: navigator.userAgent, ...userData },
    });
    
    // GA4 equivalent: purchase
    trackGAEvent('purchase', {
      transaction_id: orderId,
      value,
      currency,
      items: contentIds.map(id => ({
        item_id: id,
        quantity: 1
      }))
    });
  };

  const trackCompleteRegistration = () => {
    const base = getBasePayload('CompleteRegistration');
    trackEvent('CompleteRegistration', {}, base.eventId);
    sendToCapiRoute({ ...base });
    
    // GA4 equivalent: sign_up
    trackGAEvent('sign_up');
  };

  const trackSearch = (searchString: string) => {
    const base = getBasePayload('Search');
    trackEvent('Search', { search_string: searchString }, base.eventId);
    sendToCapiRoute({ ...base, customData: { search_string: searchString } });
    
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

  return {
    trackViewContent,
    trackAddToCart,
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
  };
}
