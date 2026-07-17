/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client-side analytics tracker for Zica Bella.
 * Manages sessions, generates dedup event IDs, detects device/browser/OS,
 * captures UTM params, and posts events to /api/analytics/track.
 *
 * IMPORTANT: This module is fire-and-forget — it never blocks UI or checkout.
 */

// ─── Session Management ──────────────────────────────────

const SESSION_KEY = 'zb_analytics_sid';
const SESSION_TS_KEY = 'zb_analytics_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (GA4 convention)

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  ) + '-' + Date.now().toString(36);
}

/** Get or create a session ID. Expires after 30min inactivity. */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const now = Date.now();
    const existingId = sessionStorage.getItem(SESSION_KEY);
    const lastTs = parseInt(sessionStorage.getItem(SESSION_TS_KEY) || '0', 10);

    if (existingId && now - lastTs < SESSION_TIMEOUT_MS) {
      sessionStorage.setItem(SESSION_TS_KEY, String(now));
      return existingId;
    }

    // New session
    const newId = 'ses_' + generateId();
    sessionStorage.setItem(SESSION_KEY, newId);
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return newId;
  } catch {
    return 'ses_' + generateId();
  }
}

// ─── Anonymous ID (persistent visitor ID) ────────────────

function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  try {
    // Reuse the existing zb_external_id from MetaPixelRouteTracker
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === 'zb_external_id' && val) return val;
    }
  } catch { /* ignore */ }
  return '';
}

// ─── UTM Parameters ──────────────────────────────────────

interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
}

const UTM_CACHE_KEY = 'zb_utm_params';

function captureUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {};

  try {
    // Return cached UTM for this session (first-touch attribution)
    const cached = sessionStorage.getItem(UTM_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }

  try {
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      referrer: document.referrer || undefined,
    };

    // Cache for session
    try {
      sessionStorage.setItem(UTM_CACHE_KEY, JSON.stringify(utm));
    } catch { /* ignore */ }

    return utm;
  } catch {
    return {};
  }
}

// ─── Device Detection ────────────────────────────────────

interface DeviceInfo {
  deviceType: string;
  browser: string;
  os: string;
}

function detectDevice(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
  }

  const ua = navigator.userAgent;

  // Device type
  let deviceType = 'desktop';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    deviceType = /iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Browser
  let browser = 'other';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  // OS
  let os = 'other';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { deviceType, browser, os };
}

// ─── Geo Data (from existing session cache) ──────────────

function getGeoData(): { country?: string; region?: string; city?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const cached = sessionStorage.getItem('zb_geo_data');
    if (cached) {
      const geo = JSON.parse(cached);
      return {
        country: geo.country || undefined,
        region: geo.state || undefined,
        city: geo.city || undefined,
      };
    }
  } catch { /* ignore */ }
  return {};
}

// ─── Event Tracking Core ─────────────────────────────────

interface TrackEventOptions {
  eventName: string;
  productId?: string;
  variantId?: string;
  cartId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  pageUrl?: string;
  customerId?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

/** Fire-and-forget analytics event. Never throws, never blocks. */
export function trackEvent(options: TrackEventOptions): void {
  if (typeof window === 'undefined') return;

  // Don't track on admin pages
  if (window.location.pathname.startsWith('/dashboard') ||
      window.location.pathname.startsWith('/admin')) return;

  try {
    const sessionId = getSessionId();
    const anonymousId = getAnonymousId();
    const device = detectDevice();
    const utm = captureUtmParams();
    const geo = getGeoData();
    const eventId = `${options.eventName}_${generateId()}`;

    const payload = {
      eventId,
      eventName: options.eventName,
      sessionId,
      anonymousId,
      platform: options.platform || 'web',
      productId: options.productId || null,
      variantId: options.variantId || null,
      cartId: options.cartId || null,
      orderId: options.orderId || null,
      value: options.value || null,
      currency: options.currency || 'INR',
      quantity: options.quantity || null,
      pageUrl: options.pageUrl || window.location.pathname,
      customerId: options.customerId || null,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      referrer: utm.referrer || null,
      utmSource: utm.utmSource || null,
      utmMedium: utm.utmMedium || null,
      utmCampaign: utm.utmCampaign || null,
      utmContent: utm.utmContent || null,
      utmTerm: utm.utmTerm || null,
      country: geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      metadata: options.metadata || null,
    };

    // Use sendBeacon for page_view (survives navigation) with fetch fallback
    if (options.eventName === 'page_view' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/track', blob);
      if (sent) return;
    }

    // Fire-and-forget fetch
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* silently ignore */ });
  } catch {
    // Analytics must never break the user experience
  }
}

// ─── Convenience Functions ───────────────────────────────

export function trackPageView(pageUrl?: string): void {
  trackEvent({ eventName: 'page_view', pageUrl });
}

export function trackViewItem(productId: string, variantId?: string, value?: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'view_item', productId, variantId, value, metadata });
}

export function trackAddToCart(productId: string, variantId?: string, value?: number, quantity?: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'add_to_cart', productId, variantId, value, quantity, metadata });
}

export function trackRemoveFromCart(productId: string, variantId?: string, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'remove_from_cart', productId, variantId, metadata });
}

export function trackViewCart(value?: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'view_cart', value, metadata });
}

export function trackBeginCheckout(value?: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'begin_checkout', value, metadata });
}

export function trackAddShippingInfo(metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'add_shipping_info', metadata });
}

export function trackAddPaymentInfo(metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'add_payment_info', metadata });
}

export function trackPaymentInitiated(value?: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'payment_initiated', value, metadata });
}

export function trackPurchase(orderId: string, value: number, metadata?: Record<string, any>): void {
  trackEvent({ eventName: 'purchase', orderId, value, metadata });
}
