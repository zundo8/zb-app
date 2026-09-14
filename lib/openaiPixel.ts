/**
 * OpenAI (ChatGPT) Ads Pixel — Client-Side Helpers
 * Parallels lib/snapPixel.ts
 *
 * Provides defensive wrappers around the global `oaiq` SDK queue,
 * event tracking, minor-unit value conversion, and cookie helpers.
 */

import { getClientCookie } from '@/lib/snapPixel';

export const OPENAI_ADS_PIXEL_ID = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID || '';

// ── Minor-unit currency map ──────────────────────────────────────
// ISO-4217 minor digits. Most currencies (INR, USD, EUR) have 2.
// Zero-decimal currencies (JPY, KRW) have 0.
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Convert a major-unit amount (e.g. ₹2599.00) to the ISO-4217 minor
 * unit integer (e.g. 259900 for INR).
 *
 * OpenAI CAPI requires `amount` as an integer in minor units — a raw
 * float is WRONG.
 */
export function toMinorUnits(amount: number, currency = 'INR'): number {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) {
    return Math.round(amount);
  }
  // Default: 2 minor digits (INR, USD, EUR, GBP, etc.)
  return Math.round(amount * 100);
}

/**
 * Read the `__obref` first-party cookie set by the OpenAI pixel for
 * hybrid browser↔server deduplication. The value is passed through
 * unchanged to CAPI `user.obref`.
 */
export function readObrefCookie(): string | undefined {
  return getClientCookie('__obref') || undefined;
}

// ── Defensive SDK wrapper ────────────────────────────────────────

/**
 * Defensive helper: ensures `window.oaiq` exists before calling the
 * callback. If the SDK isn't available yet (script still loading),
 * retries every 100 ms for up to 5 seconds.
 *
 * Mirrors `withSnaptr` from snapPixel.ts.
 */
export function withOaiq(callback: (oaiq: (...args: any[]) => void) => void, eventLabel = 'unknown'): void {
  if (typeof window === 'undefined') return;

  if ((window as any).oaiq) {
    callback((window as any).oaiq);
    return;
  }

  const MAX_RETRIES = 50; // 50 × 100 ms = 5 s
  let attempt = 0;

  const retry = () => {
    attempt++;
    if ((window as any).oaiq) {
      callback((window as any).oaiq);
      return;
    }
    if (attempt >= MAX_RETRIES) {
      // Silent — spec says no console spam
      return;
    }
    setTimeout(retry, 100);
  };

  setTimeout(retry, 100);
}

// ── Event tracking helper ────────────────────────────────────────

/**
 * Fire a client-side event via the OpenAI pixel SDK.
 *
 *   oaiq("measure", eventName, data, options)
 *
 * `data` MUST include a `type` field matching the event's data type
 * (e.g. `"contents"` or `"customer_action"`).
 *
 * The optional `eventId` is passed inside `options.event_id` for
 * browser↔server deduplication.
 *
 * Does nothing when the Pixel ID is empty (env not configured).
 */
export function trackOpenAiClientEvent(
  eventName: string,
  data: Record<string, any>,
  eventId?: string,
): void {
  if (!OPENAI_ADS_PIXEL_ID) return;

  withOaiq((oaiq) => {
    const options = eventId ? { event_id: eventId } : undefined;
    oaiq('measure', eventName, data, options);
  }, eventName);
}
