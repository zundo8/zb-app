'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { initPixel } from '@/lib/metaPixel';
import { pageview as trackGAPageView } from '@/lib/gtag';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCookie(name: string): string | null {
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

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax; Secure";
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.trim().toLowerCase());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cleanStringNoSpaces(val: string | undefined): string {
  if (!val) return "";
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    // 1. Generate/verify visitor UUID (external_id)
    let extId = getCookie('zb_external_id');
    if (!extId) {
      extId = 'zb.' + uuidv4();
      setCookie('zb_external_id', extId, 365);
    }

    // 2. Generate/verify browser ID (_fbp) fallback
    let fbpVal = getCookie('_fbp');
    if (!fbpVal) {
      const randVal = Math.floor(Math.random() * 1000000000);
      fbpVal = `fb.1.${Date.now()}.${randVal}`;
      setCookie('_fbp', fbpVal, 90);
    }

    // 3. Capture fbclid and set as _fbc cookie
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    let fbcVal = getCookie('_fbc');
    if (fbclid) {
      const host = window.location.hostname;
      const depth = host.split('.').length > 2 ? host.split('.').length - 1 : 1;
      fbcVal = `fb.${depth}.${Date.now()}.${fbclid}`;
      setCookie('_fbc', fbcVal, 90);
    }

    // 4. Update fbq user properties dynamically when session/visitor details are ready
    const updateFbq = async () => {
      const sessionUserData: Record<string, any> = {};

      if (session?.user) {
        const email = session.user.email;
        if (email) {
          const hashedEmail = await sha256(email.trim().toLowerCase());
          sessionUserData.em = hashedEmail;
          setCookie('zb_guest_email', hashedEmail, 365);
        }

        const phone = (session.user as any).phone || (session as any).customer?.phone;
        if (phone) {
          // Normalize phone number (no plus sign, digits only) before hashing
          const digits = phone.replace(/\D/g, "");
          let baseNumber = digits;
          if (digits.length === 12 && digits.startsWith("91")) baseNumber = digits.slice(2);
          else if (digits.length === 11 && digits.startsWith("0")) baseNumber = digits.slice(1);
          const formattedPhone = `91${baseNumber}`;
          const hashedPhone = await sha256(formattedPhone);
          sessionUserData.ph = hashedPhone;
          setCookie('zb_guest_phone', hashedPhone, 365);
        }

        const name = session.user.name;
        if (name) {
          const parts = name.trim().split(/\s+/);
          if (parts[0]) {
            const hashedFn = await sha256(cleanStringNoSpaces(parts[0]));
            sessionUserData.fn = hashedFn;
            setCookie('zb_guest_fn', hashedFn, 365);
          }
          if (parts.length > 1) {
            const hashedLn = await sha256(cleanStringNoSpaces(parts.slice(1).join('')));
            sessionUserData.ln = hashedLn;
            setCookie('zb_guest_ln', hashedLn, 365);
          }
        }
      }

      initPixel(sessionUserData);
    };

    updateFbq();
  }, [session, pathname]);

  useEffect(() => {
    // Generate matched browser & server identifiers
    const eventId = 'pv.' + uuidv4();
    const eventTime = Math.floor(Date.now() / 1000);

    // Track Meta PageView in Browser
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'PageView', {}, { eventID: eventId });
    }

    // Track Meta PageView via CAPI for full browser/server deduplication
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
      }),
    }).catch(err => console.warn('[Tracker Client] PageView CAPI failed:', err));

    // Track GA PageView
    trackGAPageView(pathname);
  }, [pathname]);

  return null;
}

export default MetaPixelRouteTracker;
