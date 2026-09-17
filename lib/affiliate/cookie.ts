import crypto from 'crypto';
import { AFFILIATE_CONFIG } from './config';

export interface AffiliateCookiePayload {
  code: string;
  linkSlug?: string | null;
  linkId?: string | null;
  clickId?: string | null;
  ts: number;
}

/**
 * Creates an HMAC-SHA256 signature for the given payload string
 */
function signString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Signs and encodes the attribution cookie value
 */
export function signAffiliateCookie(payload: AffiliateCookiePayload): string {
  const secret = AFFILIATE_CONFIG.APP_JWT_SECRET;
  const json = JSON.stringify(payload);
  const dataB64 = Buffer.from(json, 'utf8').toString('base64url');
  const signature = signString(dataB64, secret);
  return `${dataB64}.${signature}`;
}

/**
 * Verifies and parses the attribution cookie value
 * Returns null if invalid or expired past ATTRIBUTION_WINDOW_DAYS
 */
export function verifyAffiliateCookie(token: string | null | undefined): AffiliateCookiePayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, signature] = parts;
  const secret = AFFILIATE_CONFIG.APP_JWT_SECRET;
  const expectedSignature = signString(dataB64, secret);

  try {
    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return null;
    }

    const json = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as AffiliateCookiePayload;

    if (!payload.code || typeof payload.ts !== 'number') {
      return null;
    }

    // Check expiration window (30 days)
    const maxAgeMs = AFFILIATE_CONFIG.ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - payload.ts > maxAgeMs) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Cookie options for the zb_aff attribution cookie
 */
export function getAffiliateCookieOptions() {
  const maxAge = AFFILIATE_CONFIG.ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60; // seconds
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: AFFILIATE_CONFIG.COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
