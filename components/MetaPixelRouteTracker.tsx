'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { pageview as trackMetaPageView } from '@/lib/metaPixel';
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

export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    // 1. Generate/verify visitor UUID
    let extId = getCookie('zb_external_id');
    if (!extId) {
      extId = 'zb.' + uuidv4();
      setCookie('zb_external_id', extId, 365);
    }

    // 2. Capture fbclid and set as _fbc cookie
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    let fbcVal = getCookie('_fbc');
    if (fbclid) {
      const host = window.location.hostname;
      const depth = host.split('.').length > 2 ? host.split('.').length - 1 : 1;
      fbcVal = `fb.${depth}.${Date.now()}.${fbclid}`;
      setCookie('_fbc', fbcVal, 90);
    }

    const fbpVal = getCookie('_fbp');

    // 3. Update fbq user properties dynamically when session/visitor details are ready
    const updateFbq = async () => {
      if (typeof window === 'undefined' || !(window as any).fbq) return;

      const userData: Record<string, any> = {
        external_id: session?.user ? (session.user as any).id : extId,
      };

      if (fbcVal) userData.fbc = fbcVal;
      if (fbpVal) userData.fbp = fbpVal;

      if (session?.user) {
        const email = session.user.email;
        if (email) {
          userData.em = await sha256(email);
        }

        const phone = (session.user as any).phone || (session as any).customer?.phone;
        if (phone) {
          userData.ph = await sha256(phone);
        }

        const name = session.user.name;
        if (name) {
          const parts = name.trim().split(/\s+/);
          if (parts[0]) userData.fn = await sha256(parts[0]);
          if (parts.length > 1) userData.ln = await sha256(parts.slice(1).join(' '));
        }
      }

      const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
      if (pixelId) {
        (window as any).fbq('init', pixelId, userData);
      }
    };

    updateFbq();
  }, [session]);

  useEffect(() => {
    trackMetaPageView();
    trackGAPageView(pathname);
  }, [pathname]);

  return null;
}

export default MetaPixelRouteTracker;
