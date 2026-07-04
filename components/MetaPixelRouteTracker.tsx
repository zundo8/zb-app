'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  initPixel,
  getMetaIdentityCookies,
  getClientCookie,
  setClientCookie,
  sha256,
  cleanCountry,
  withFbq,
} from '@/lib/metaPixel';
import { pageview as trackGAPageView } from '@/lib/gtag';

let cachedProfileData: {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  dob?: string;
} | null = null;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function cleanStringNoSpaces(val: string | undefined): string {
  if (!val) return "";
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    // Don't fire any pixel/CAPI events on admin dashboard routes
    if (pathname.startsWith('/dashboard')) return;

    // ─── STEP 1: Synchronous setup (cookies, fbclid capture) ───

    // 1. Generate/verify visitor UUID (external_id)
    let extId = getClientCookie('zb_external_id');
    if (!extId) {
      extId = 'zb.' + uuidv4();
      setClientCookie('zb_external_id', extId, 365);
    }

    // 2. Generate/verify browser ID (_fbp) fallback
    let fbpVal = getClientCookie('_fbp');
    if (!fbpVal) {
      const randVal = Math.floor(Math.random() * 1000000000);
      fbpVal = `fb.1.${Date.now()}.${randVal}`;
      setClientCookie('_fbp', fbpVal, 90);
    }

    // 3. Capture fbclid from URL and set as _fbc cookie (Click ID)
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    if (fbclid) {
      const host = window.location.hostname;
      const depth = host.split('.').length > 2 ? host.split('.').length - 1 : 1;
      const fbcVal = `fb.${depth}.${Date.now()}.${fbclid}`;
      setClientCookie('_fbc', fbcVal, 90);
    }

    // 4. Resolve client public IP (IPv6 preferred) in background — non-blocking.
    // The cookie will be available for CAPI calls on this and subsequent page loads.
    const cachedIp = getClientCookie('zb_client_ip');
    if (!cachedIp) {
      fetch('https://api64.ipify.org?format=json')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.ip) {
            setClientCookie('zb_client_ip', data.ip, 1);
          }
        })
        .catch(() => {}); // silently ignore — proxy headers are fallback
    }

    // ─── STEP 2: Fire PageView IMMEDIATELY with sync-available data ───

    const eventId = 'pv.' + uuidv4();
    const eventTime = Math.floor(Date.now() / 1000);

    // Client-side pixel PageView — fires NOW, no awaits
    withFbq((fbq) => {
      const options: Record<string, any> = { eventID: eventId };
      const testCode = process.env.NEXT_PUBLIC_META_TEST_EVENT_CODE;
      if (testCode) {
        options.test_event_code = testCode;
      }
      fbq('track', 'PageView', {}, options);
    }, 'PageView');

    // Server-side CAPI PageView — fires NOW with sync-available identity data
    const identityData = getMetaIdentityCookies();

    // For anonymous PageView events, strip all PII fields (em, ph, fn, ln, address, DOB, fb_login_id).
    // Standard pageviews for guests must only contain available browser identifier parameters (fbp, fbc, external_id).
    if (!session?.user) {
      delete identityData.em;
      delete identityData.ph;
      delete identityData.fn;
      delete identityData.ln;
      delete identityData.country;
      delete identityData.st;
      delete identityData.ct;
      delete identityData.zp;
      delete identityData.db;
      delete identityData.fb_login_id;
    }

    // Clean empty fields from identityData
    const cleanedIdentity: Record<string, any> = {};
    for (const [key, val] of Object.entries(identityData)) {
      if (val !== undefined && val !== null && val !== '') {
        cleanedIdentity[key] = val;
      }
    }

    fetch('/api/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'PageView',
        eventId,
        eventTime,
        eventSourceUrl: window.location.href,
        userAgent: navigator.userAgent,
        actionSource: 'website',
        userData: cleanedIdentity,
      }),
    }).catch(err => console.warn('[Tracker Client] PageView CAPI failed:', err));

    // GA PageView
    trackGAPageView(pathname);

    // ─── STEP 3: Async identity enrichment (runs AFTER PageView) ───
    // This improves identity data for the NEXT event on this page (ViewContent, AddToCart, etc.)
    // but never gates or delays PageView itself.

    const enrichIdentityAsync = async () => {
      const sessionUserData: Record<string, any> = {};

      if (session?.user) {
        setClientCookie('zb_user_logged_in', 'true', 365);

        const email = session.user.email;
        if (email) {
          const hashedEmail = await sha256(email.trim().toLowerCase());
          sessionUserData.em = hashedEmail;
          setClientCookie('zb_guest_email', hashedEmail, 365);
        }

        const phone = (session.user as any).phone || (session as any).customer?.phone;
        if (phone) {
          const digits = phone.replace(/\D/g, "");
          let baseNumber = digits;
          if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
          else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
          const formattedPhone = `91${baseNumber}`;
          const hashedPhone = await sha256(formattedPhone);
          sessionUserData.ph = hashedPhone;
          setClientCookie('zb_guest_phone', hashedPhone, 365);
        }

        const name = session.user.name;
        if (name) {
          const parts = name.trim().split(/\s+/);
          if (parts[0]) {
            const hashedFn = await sha256(cleanStringNoSpaces(parts[0]));
            sessionUserData.fn = hashedFn;
            setClientCookie('zb_guest_fn', hashedFn, 365);
          }
          if (parts.length > 1) {
            const hashedLn = await sha256(cleanStringNoSpaces(parts.slice(1).join('')));
            sessionUserData.ln = hashedLn;
            setClientCookie('zb_guest_ln', hashedLn, 365);
          }
        }

        // Fetch default address and DOB for logged-in user if not cached
        if (!cachedProfileData) {
          try {
            const res = await fetch('/api/customers/me/default-address');
            if (res.ok) {
              cachedProfileData = await res.json();
            }
          } catch (e) {
            console.error('Failed to fetch default address/profile:', e);
          }
        }

        if (cachedProfileData) {
          const { city, state, zip, country, dob } = cachedProfileData;
          if (city) {
            const hashedCity = await sha256(cleanStringNoSpaces(city));
            sessionUserData.ct = hashedCity;
            setClientCookie('zb_guest_ct', hashedCity, 365);
          }
          if (state) {
            const hashedState = await sha256(cleanStringNoSpaces(state));
            sessionUserData.st = hashedState;
            setClientCookie('zb_guest_st', hashedState, 365);
          }
          if (zip) {
            const hashedZip = await sha256(cleanStringNoSpaces(zip));
            sessionUserData.zp = hashedZip;
            setClientCookie('zb_guest_zp', hashedZip, 365);
          }
          if (country) {
            const cleanC = cleanCountry(country);
            if (cleanC) {
              const hashedCountry = await sha256(cleanC);
              sessionUserData.country = hashedCountry;
              setClientCookie('zb_guest_country', hashedCountry, 365);
            }
          }
          if (dob) {
            const cleanD = dob.replace(/\D/g, "").slice(0, 8);
            if (cleanD.length === 8) {
              const hashedDob = await sha256(cleanD);
              sessionUserData.db = hashedDob;
              setClientCookie('zb_guest_dob', hashedDob, 365);
            }
          }
        }

        // Reinit pixel with full enriched user data for subsequent events
        initPixel(sessionUserData);
      } else {
        setClientCookie('zb_user_logged_in', 'false', 365);
        // Reinit pixel with browser-only params for subsequent events
        initPixel({});
      }
    };

    // Fire enrichment in background — NEVER blocks PageView
    enrichIdentityAsync().catch(err => {
      console.warn('[Meta Pixel Enrichment] Identity enrichment failed (non-fatal):', err);
    });
  }, [session, pathname]);

  return null;
}

export default MetaPixelRouteTracker;
