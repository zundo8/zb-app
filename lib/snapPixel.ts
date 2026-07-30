export const SNAP_PIXEL_ID = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID || '7d2481be-4ccf-42b2-b9ea-958c6c7bbdcd';

/**
 * Defensive helper: ensures window.snaptr exists before calling the callback.
 * If snaptr isn't available yet (e.g. base pixel script still loading), retries
 * every 100ms for up to 3 seconds.
 */
export function withSnaptr(callback: (snaptr: any) => void, eventLabel = 'unknown'): void {
  if (typeof window === 'undefined') return;

  if ((window as any).snaptr) {
    callback((window as any).snaptr);
    return;
  }

  const MAX_RETRIES = 50; // 50 × 100ms = 5 seconds
  let attempt = 0;

  const retry = () => {
    attempt++;
    if ((window as any).snaptr) {
      callback((window as any).snaptr);
      return;
    }
    if (attempt >= MAX_RETRIES) {
      console.warn(`[Snap Pixel] snaptr never became available — event dropped: ${eventLabel}`);
      return;
    }
    setTimeout(retry, 100);
  };

  setTimeout(retry, 100);
}

export function setClientCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }

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
 * Capture Snapchat Click ID (ScCid/sccid) from URL search parameters and store in cookie.
 */
export function captureSnapClickId(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const scCid = urlParams.get('ScCid') || urlParams.get('sccid') || urlParams.get('sc_click_id');
  if (scCid) {
    setClientCookie('ScCid', scCid, 90);
    return scCid;
  }
  return getClientCookie('ScCid');
}

/**
 * Read Snapchat identity cookies (_scid / ScCid) for event enrichment.
 */
export function getSnapIdentityCookies(): Record<string, string | undefined> {
  return {
    sc_click_id: getClientCookie('ScCid') || undefined,
    sc_cookie1: getClientCookie('_scid') || undefined,
    uuid_c1: getClientCookie('zb_external_id') || undefined,
    em: getClientCookie('zb_guest_email') || undefined,
    ph: getClientCookie('zb_guest_phone') || undefined,
    fn: getClientCookie('zb_guest_fn') || undefined,
    ln: getClientCookie('zb_guest_ln') || undefined,
    country: getClientCookie('zb_guest_country') || undefined,
    st: getClientCookie('zb_guest_st') || undefined,
    ct: getClientCookie('zb_guest_ct') || undefined,
    zp: getClientCookie('zb_guest_zp') || undefined,
  };
}

let isInitialized = false;

/**
 * Initialize Snap Pixel with optional user data for advanced matching.
 */
export const initSnapPixel = (userData: Record<string, any> = {}) => {
  if (!SNAP_PIXEL_ID) return;
  withSnaptr((snaptr) => {
    snaptr('init', SNAP_PIXEL_ID, userData);
    isInitialized = true;
    if (typeof window !== 'undefined') {
      (window as any).__snapPixelInitialized = true;
    }
  }, 'init');
};

/**
 * Send client-side event via snaptr('track', eventName, params, options)
 */
export const trackSnapClientEvent = (
  eventName: string,
  params: Record<string, any> = {},
  eventId?: string
) => {
  if (!SNAP_PIXEL_ID) return;
  withSnaptr((snaptr) => {
    if (!isInitialized && typeof window !== 'undefined' && !(window as any).__snapPixelInitialized) {
      snaptr('init', SNAP_PIXEL_ID);
      isInitialized = true;
      (window as any).__snapPixelInitialized = true;
    }
    const payload = { ...params };
    if (eventId) {
      payload.event_id = eventId;
    }
    snaptr('track', eventName, payload);
  }, eventName);
};
