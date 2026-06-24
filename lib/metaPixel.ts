export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '2049977412558608';

export const pageview = () => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'PageView');
  }
};

export function setClientCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax; Secure";
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

export const initPixel = (additionalData: Record<string, any> = {}) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    const extId = getClientCookie('zb_external_id');
    const fbcVal = getClientCookie('_fbc');
    const fbpVal = getClientCookie('_fbp');

    const userData: Record<string, any> = {
      external_id: extId || undefined,
    };

    if (fbcVal) userData.fbc = fbcVal;
    if (fbpVal) userData.fbp = fbpVal;

    const guestEmail = getClientCookie('zb_guest_email');
    const guestPhone = getClientCookie('zb_guest_phone');
    const guestFn = getClientCookie('zb_guest_fn');
    const guestLn = getClientCookie('zb_guest_ln');
    const guestCountry = getClientCookie('zb_guest_country');
    const guestState = getClientCookie('zb_guest_st');
    const guestCity = getClientCookie('zb_guest_ct');
    const guestZip = getClientCookie('zb_guest_zp');

    if (guestEmail) userData.em = guestEmail;
    if (guestPhone) userData.ph = guestPhone;
    if (guestFn) userData.fn = guestFn;
    if (guestLn) userData.ln = guestLn;
    if (guestCountry) userData.country = guestCountry;
    if (guestState) userData.st = guestState;
    if (guestCity) userData.ct = guestCity;
    if (guestZip) userData.zp = guestZip;

    const merged = { ...userData, ...additionalData };
    (window as any).fbq('init', META_PIXEL_ID, merged);
  }
};

export async function saveUserDataToCookies(data: {
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  fbLoginId?: string;
}) {
  if (typeof window === 'undefined') return;

  if (data.email) {
    const hashedEmail = await sha256(data.email);
    setClientCookie('zb_guest_email', hashedEmail, 365);
  }
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    let baseNumber = digits;
    if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
    const formattedPhone = `+91${baseNumber}`;
    const hashedPhone = await sha256(formattedPhone);
    setClientCookie('zb_guest_phone', hashedPhone, 365);
  }
  if (data.name) {
    const parts = data.name.trim().split(/\s+/);
    if (parts[0]) {
      const hashedFn = await sha256(parts[0]);
      setClientCookie('zb_guest_fn', hashedFn, 365);
    }
    if (parts.length > 1) {
      const hashedLn = await sha256(parts.slice(1).join(' '));
      setClientCookie('zb_guest_ln', hashedLn, 365);
    }
  }
  if (data.city) {
    const hashedCity = await sha256(data.city);
    setClientCookie('zb_guest_ct', hashedCity, 365);
  }
  if (data.state) {
    const hashedState = await sha256(data.state);
    setClientCookie('zb_guest_st', hashedState, 365);
  }
  if (data.zip) {
    const hashedZip = await sha256(data.zip);
    setClientCookie('zb_guest_zp', hashedZip, 365);
  }
  if (data.country) {
    const hashedCountry = await sha256(data.country);
    setClientCookie('zb_guest_country', hashedCountry, 365);
  }
  if (data.fbLoginId) {
    setClientCookie('zb_fb_login_id', data.fbLoginId, 365);
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
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, params, eventId ? { eventID: eventId } : {});
  }
};
