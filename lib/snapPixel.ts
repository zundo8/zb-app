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

/**
 * Helper: detect if a value is already a 64-char lowercase hex SHA-256 hash.
 */
function isSha256Hash(val: string): boolean {
  return /^[a-f0-9]{64}$/.test(val.trim().toLowerCase());
}

/**
 * Build the browser-pixel identity object from guest/logged-in cookies.
 * Maps cookie fields to Snap Pixel advanced-matching field names.
 * Strips empty/undefined keys so the pixel only receives populated fields.
 */
export function buildBrowserIdentity(): Record<string, string> {
  const cookies = getSnapIdentityCookies();
  const identity: Record<string, string> = {};

  // Email: if already hashed, use user_hashed_email; otherwise user_email (Snap hashes client-side)
  if (cookies.em) {
    if (isSha256Hash(cookies.em)) {
      identity.user_hashed_email = cookies.em.trim().toLowerCase();
    } else {
      identity.user_email = cookies.em;
    }
  }

  // Phone: same hashed vs raw logic
  if (cookies.ph) {
    if (isSha256Hash(cookies.ph)) {
      identity.user_hashed_phone_number = cookies.ph.trim().toLowerCase();
    } else {
      identity.user_phone_number = cookies.ph;
    }
  }

  // Name fields
  if (cookies.fn) identity.firstname = cookies.fn;
  if (cookies.ln) identity.lastname = cookies.ln;

  // Geo fields
  if (cookies.ct) identity.geo_city = cookies.ct;
  if (cookies.st) identity.geo_region = cookies.st;
  if (cookies.zp) identity.geo_postal_code = cookies.zp;
  if (cookies.country) identity.geo_country = cookies.country;

  // External ID
  if (cookies.uuid_c1) identity.external_id = cookies.uuid_c1;

  return identity;
}

/**
 * Map a raw {em, ph, fn, ln, ct, st, zp, country, external_id} object
 * to Snap Pixel advanced-matching field names. Raw values are left raw
 * (Snap hashes client-side); already-hashed SHA-256 values use user_hashed_*.
 * Empty/undefined values are stripped.
 */
export function mapOverrideToSnapFields(src: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  const em = src.em?.trim();
  if (em) {
    if (isSha256Hash(em)) out.user_hashed_email = em.toLowerCase();
    else out.user_email = em.toLowerCase();
  }
  const ph = src.ph?.trim();
  if (ph) {
    if (isSha256Hash(ph)) out.user_hashed_phone_number = ph.toLowerCase();
    else out.user_phone_number = ph;
  }
  if (src.fn?.trim()) out.firstname = src.fn.trim();
  if (src.ln?.trim()) out.lastname = src.ln.trim();
  if (src.ct?.trim()) out.geo_city = src.ct.trim();
  if (src.st?.trim()) out.geo_region = src.st.trim();
  if (src.zp?.trim()) out.geo_postal_code = src.zp.trim();
  if (src.country?.trim()) out.geo_country = src.country.trim();
  if (src.external_id?.trim()) out.external_id = src.external_id.trim();
  return out;
}

let isInitialized = false;

/**
 * Initialize Snap Pixel with optional user data for advanced matching.
 * When called with no arguments (or empty {}), defaults to buildBrowserIdentity()
 * so the pixel is init'd with whatever PII cookies are currently available.
 */
export const initSnapPixel = (userData?: Record<string, any>) => {
  if (!SNAP_PIXEL_ID) return;
  const resolvedData = (userData && Object.keys(userData).length > 0)
    ? userData
    : buildBrowserIdentity();
  withSnaptr((snaptr) => {
    snaptr('init', SNAP_PIXEL_ID, resolvedData);
    isInitialized = true;
    if (typeof window !== 'undefined') {
      (window as any).__snapPixelInitialized = true;
    }
  }, 'init');
};

/**
 * Send client-side event via snaptr('track', eventName, params, options).
 * Re-inits the pixel with fresh identity cookies before each track call
 * so that late-arriving checkout PII (set during address entry) is captured.
 * @param identityOverride — raw or pre-hashed PII (em, ph, fn, ln, ct, st, zp, country, external_id)
 *   merged on top of cookie identity so checkout/purchase events carry full PII even without cookies.
 */
export const trackSnapClientEvent = (
  eventName: string,
  params: Record<string, any> = {},
  eventId?: string,
  identityOverride?: Record<string, string | undefined>
) => {
  if (!SNAP_PIXEL_ID) return;
  withSnaptr((snaptr) => {
    // Merge cookie identity with any explicit override (override wins)
    const cookieIdentity = buildBrowserIdentity();
    const overrideIdentity = identityOverride ? mapOverrideToSnapFields(identityOverride) : {};
    const identity = { ...cookieIdentity, ...overrideIdentity };

    if (Object.keys(identity).length > 0) {
      snaptr('init', SNAP_PIXEL_ID, identity);
      isInitialized = true;
      (window as any).__snapPixelInitialized = true;
    } else if (!isInitialized && typeof window !== 'undefined' && !(window as any).__snapPixelInitialized) {
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
