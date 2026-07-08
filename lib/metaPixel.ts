export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '2049977412558608';

/**
 * Demo/test account values that must NEVER be sent to Meta Pixel or CAPI.
 * These are checked pre-hash (raw values) to prevent the same deterministic
 * hash from appearing across many distinct external_id/fbp pairs, which
 * triggers Meta's "duplicate client email/phone" warning.
 */
export const DEMO_PHONES_RAW = ['919999999999', '9999999999', '+919999999999'];
export const DEMO_EMAILS_RAW = ['demo@zicabella.com', 'demo@example.com'];
export const DEMO_NAMES_RAW = ['demo user'];

/** Check if a raw (pre-hash) value matches a known demo/test account. */
export function isDemoValue(field: 'phone' | 'email' | 'name', rawValue: string | undefined | null): boolean {
  if (!rawValue) return false;
  const cleaned = rawValue.trim().toLowerCase().replace(/[\s+\-()]/g, '');
  if (!cleaned) return false;
  switch (field) {
    case 'phone': {
      const digits = cleaned.replace(/\D/g, '');
      return DEMO_PHONES_RAW.some(d => digits === d.replace(/\D/g, '') || digits.endsWith(d.replace(/\D/g, '')));
    }
    case 'email':
      return DEMO_EMAILS_RAW.includes(cleaned);
    case 'name':
      return DEMO_NAMES_RAW.includes(cleaned);
  }
}

/**
 * Defensive helper: ensures window.fbq exists before calling the callback.
 * If fbq isn't available yet (e.g. base pixel script still loading), retries
 * every 100ms for up to 3 seconds. After 3s, logs a visible warning instead
 * of silently dropping the event.
 */
export function withFbq(callback: (fbq: any) => void, eventLabel = 'unknown'): void {
  if (typeof window === 'undefined') return;

  if ((window as any).fbq) {
    callback((window as any).fbq);
    return;
  }

  const MAX_RETRIES = 30; // 30 × 100ms = 3 seconds
  let attempt = 0;

  const retry = () => {
    attempt++;
    if ((window as any).fbq) {
      callback((window as any).fbq);
      return;
    }
    if (attempt >= MAX_RETRIES) {
      console.warn(`[Meta Pixel] fbq never became available — event dropped: ${eventLabel}`);
      return;
    }
    setTimeout(retry, 100);
  };

  setTimeout(retry, 100);
}

export const pageview = () => {
  withFbq((fbq) => {
    fbq('track', 'PageView');
  }, 'PageView');
};

export function setClientCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }

  // Set cookie on root domain if possible so subdomains (e.g. www, checkout) can share it
  let domainAttr = "";
  const hostname = window.location.hostname;
  if (!/^localhost$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const root = parts.slice(-2).join('.');
      domainAttr = `; domain=.${root}`;
    }
  }

  document.cookie = name + "=" + (value || "") + expires + "; path=/" + domainAttr + "; SameSite=Lax; Secure";
}

/** Delete a cookie by setting max-age=0 on the same domain/path. */
export function deleteClientCookie(name: string) {
  if (typeof document === 'undefined') return;
  // Must set on root domain to match how setClientCookie works
  let domainAttr = "";
  const hostname = window.location.hostname;
  if (!/^localhost$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const root = parts.slice(-2).join('.');
      domainAttr = `; domain=.${root}`;
    }
  }
  document.cookie = `${name}=; max-age=0; path=/${domainAttr}; SameSite=Lax; Secure`;
}

/**
 * Clear all guest PII cookies. Called on logout to prevent stale identity
 * data from one user leaking into another user's Meta events on shared devices.
 */
export function clearGuestPiiCookies() {
  const piiCookieNames = [
    'zb_guest_email', 'zb_guest_phone', 'zb_guest_fn', 'zb_guest_ln',
    'zb_guest_country', 'zb_guest_st', 'zb_guest_ct', 'zb_guest_zp',
    'zb_guest_dob', 'zb_fb_login_id',
  ];
  for (const name of piiCookieNames) {
    deleteClientCookie(name);
  }
}

export async function sha256(message: string): Promise<string> {
  const cleaned = message.trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(cleaned)) {
    return cleaned;
  }
  const msgBuffer = new TextEncoder().encode(cleaned);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Reads all Meta identity cookies from the browser for CAPI event enrichment.
 * Includes fbc (Click ID), fbp (Browser ID), external_id, and all hashed PII cookies.
 * Used by useMetaEvents and MetaPixelRouteTracker to ensure every CAPI call
 * carries maximum user identity data for optimal Event Match Quality.
 */
export function getMetaIdentityCookies(): Record<string, string | undefined> {
  return {
    fbc: getClientCookie('_fbc') || undefined,
    fbp: getClientCookie('_fbp') || undefined,
    external_id: getClientCookie('zb_external_id') || undefined,
    em: getClientCookie('zb_guest_email') || undefined,
    ph: getClientCookie('zb_guest_phone') || undefined,
    fn: getClientCookie('zb_guest_fn') || undefined,
    ln: getClientCookie('zb_guest_ln') || undefined,
    country: getClientCookie('zb_guest_country') || undefined,
    st: getClientCookie('zb_guest_st') || undefined,
    ct: getClientCookie('zb_guest_ct') || undefined,
    zp: getClientCookie('zb_guest_zp') || undefined,
    fb_login_id: getClientCookie('zb_fb_login_id') || undefined,
    db: getClientCookie('zb_guest_dob') || undefined,
    client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}

import { buildClientUserData } from '@/lib/buildMetaUserData';

// Module-level guard to prevent redundant fbq('init') calls with identical data.
// The layout.tsx inline script handles the base init (no user data).
// This function only re-inits when advanced matching data actually changes.
let lastInitHash: string | null = null;

export const initPixel = (additionalData: Record<string, any> = {}) => {
  withFbq((fbq) => {
    // Build advanced matching user data for fbq('init') using the unified builder.
    // NOTE: fbc, fbp, and client_user_agent are NOT passed here — the pixel SDK reads them
    // directly from the cookies/browser. Passing them in init is unsupported or redundant.
    const rawIdentity = getMetaIdentityCookies();
    const builtIdentity = buildClientUserData(rawIdentity);
    const { fbc, fbp, client_user_agent, ...userData } = builtIdentity;

    const merged = { ...userData, ...additionalData };

    // Dedup guard: skip fbq('init') if the merged userData is identical to last call.
    // This prevents the "Duplicate Pixel ID" warning from fbevents.js.
    const currentHash = JSON.stringify(merged, Object.keys(merged).sort());
    if (currentHash === lastInitHash) {
      return; // Data unchanged — skip redundant init
    }
    lastInitHash = currentHash;

    fbq('init', META_PIXEL_ID, merged);
  }, 'init');
};

function cleanStringNoSpaces(val: string | undefined): string {
  if (!val) return "";
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cleanCountry(country: string | undefined): string {
  if (!country) return "";
  const c = country.trim().toLowerCase();
  if (c === 'india' || c === 'ind' || c === 'in') return 'in';
  if (c === 'united states' || c === 'usa' || c === 'us' || c === 'united states of america') return 'us';
  return c.replace(/[^a-z]/g, '').slice(0, 2);
}

export async function saveUserDataToCookies(data: {
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  fbLoginId?: string;
  dob?: string;
}) {
  if (typeof window === 'undefined') return;

  if (data.email && !isDemoValue('email', data.email)) {
    const hashedEmail = await sha256(data.email.trim().toLowerCase());
    setClientCookie('zb_guest_email', hashedEmail, 365);
  }
  if (data.phone && !isDemoValue('phone', data.phone)) {
    const digits = data.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
    const formattedPhone = `91${baseNumber}`; // Only digits, no plus sign for Meta
    const hashedPhone = await sha256(formattedPhone);
    setClientCookie('zb_guest_phone', hashedPhone, 365);
  }
  if (data.name && !isDemoValue('name', data.name)) {
    const parts = data.name.trim().split(/\s+/);
    if (parts[0]) {
      const hashedFn = await sha256(cleanStringNoSpaces(parts[0]));
      setClientCookie('zb_guest_fn', hashedFn, 365);
    }
    if (parts.length > 1) {
      const hashedLn = await sha256(cleanStringNoSpaces(parts.slice(1).join('')));
      setClientCookie('zb_guest_ln', hashedLn, 365);
    }
  }
  if (data.city) {
    const hashedCity = await sha256(cleanStringNoSpaces(data.city));
    setClientCookie('zb_guest_ct', hashedCity, 365);
  }
  if (data.state) {
    const hashedState = await sha256(cleanStringNoSpaces(data.state));
    setClientCookie('zb_guest_st', hashedState, 365);
  }
  if (data.zip) {
    const hashedZip = await sha256(cleanStringNoSpaces(data.zip));
    setClientCookie('zb_guest_zp', hashedZip, 365);
  }
  if (data.country) {
    const hashedCountry = await sha256(cleanCountry(data.country));
    setClientCookie('zb_guest_country', hashedCountry, 365);
  }
  if (data.fbLoginId) {
    setClientCookie('zb_fb_login_id', data.fbLoginId.trim(), 365); // Do NOT hash fb_login_id
  }
  if (data.dob) {
    const cleanDob = data.dob.replace(/\D/g, "").slice(0, 8);
    if (cleanDob.length === 8) {
      const hashedDob = await sha256(cleanDob);
      setClientCookie('zb_guest_dob', hashedDob, 365);
    }
  }
}

export async function saveUserDataToCookiesAndReinit(data: {
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  fbLoginId?: string;
  dob?: string;
}) {
  await saveUserDataToCookies(data);
  initPixel();
}


type FbqEventName =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CompleteRegistration'
  | 'Contact'
  | 'FindLocation'
  | 'InitiateCheckout'
  | 'Lead'
  | 'Purchase'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'Subscribe'
  | 'ViewContent';

export const trackEvent = (
  eventName: FbqEventName,
  params: Record<string, any> = {},
  eventId?: string
) => {
  withFbq((fbq) => {
    const options: Record<string, any> = {};
    if (eventId) options.eventID = eventId;
    
    const testCode = process.env.NEXT_PUBLIC_META_TEST_EVENT_CODE;
    if (testCode) {
      options.test_event_code = testCode;
    }
    
    fbq('track', eventName, params, options);
  }, eventName);
};
