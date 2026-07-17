/**
 * One-Shot Geolocation Enrichment for Meta EMQ
 *
 * Silently captures the visitor's city/state/postcode/country via the browser's
 * Geolocation API + Google Maps reverse geocoding, then feeds them into the
 * shared Meta PII cookie pipeline so subsequent events include address fields.
 *
 * Behavior:
 * - Runs at most ONCE per session (sessionStorage guard).
 * - If permission is already 'granted': fetches silently, no prompt.
 * - If permission is 'prompt': triggers the native browser dialog once.
 * - If permission is 'denied': skips entirely, no nag.
 * - Never blocks rendering, hydration, or PageView firing.
 * - Never shows custom UI — only the native browser permission dialog.
 * - Fails silently on any error (timeout, GPS failure, API error).
 * - Only runs on webstore pages, never on /dashboard.
 */

import { saveUserDataToCookies, initPixel } from './metaPixel';
import { parseGeoAddressComponents } from './parseGeoAddressComponents';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const SESSION_KEY = 'zb_geo_done';

/**
 * Main entry point. Call this from MetaPixelRouteTracker after PageView fires.
 * Fire-and-forget — never awaited on the critical path.
 */
export async function enrichSessionWithGeolocation(): Promise<void> {
  try {
    // Guard: browser environment only
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // Guard: NEVER run or prompt on admin dashboard, admin routes, or API endpoints
    const path = window.location.pathname;
    if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/web-store')) {
      return;
    }

    // Guard: Geolocation API available
    if (!navigator.geolocation) {
      sessionStorage.setItem(SESSION_KEY, 'unsupported');
      return;
    }

    // Check permission state without triggering a prompt
    let permissionState: PermissionState | 'unknown' = 'unknown';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        permissionState = status.state;
      }
    } catch {
      // Permissions API not supported — state is unknown, proceed to getCurrentPosition
      permissionState = 'unknown';
    }

    // If explicitly denied, respect the user's choice — don't call getCurrentPosition
    if (permissionState === 'denied') {
      sessionStorage.setItem(SESSION_KEY, 'denied');
      return;
    }

    // Guard: if it's 'prompt' or 'unknown' (which triggers the browser dialog),
    // enforce the single-shot per session limit to avoid annoying the user.
    // If it is already 'granted', we bypass this guard to silently fetch the location.
    if (permissionState !== 'granted' && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    // For 'granted', 'prompt', or 'unknown': call getCurrentPosition.
    // - 'granted': fetches silently
    // - 'prompt': triggers native browser dialog
    // - 'unknown': same as prompt (Permissions API unsupported)
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null), // Error/denial — resolve null, don't throw
        {
          enableHighAccuracy: false, // Low accuracy is fine for city-level
          timeout: 8000,
          maximumAge: 300000, // 5 min cache OK
        }
      );
    });

    if (!position) {
      sessionStorage.setItem(SESSION_KEY, 'failed');
      return;
    }

    const { latitude, longitude } = position.coords;

    // Reverse geocode using Google Maps Geocoding API
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      sessionStorage.setItem(SESSION_KEY, 'no_api_key');
      return;
    }

    // Load the geocoding library via the same loader the checkout page uses
    try {
      setOptions({ key: apiKey, v: 'weekly' });
    } catch {
      // setOptions may throw if already configured — that's fine, reuse existing config
    }

    let geocodingLib: any;
    try {
      geocodingLib = await importLibrary('geocoding');
    } catch {
      // Fallback: try accessing google.maps.Geocoder directly if library is already loaded
      const googleObj = (window as any).google;
      if (googleObj?.maps?.Geocoder) {
        geocodingLib = { Geocoder: googleObj.maps.Geocoder };
      } else {
        sessionStorage.setItem(SESSION_KEY, 'geocoding_load_failed');
        return;
      }
    }

    const Geocoder = geocodingLib?.Geocoder || (window as any).google?.maps?.Geocoder;
    if (!Geocoder) {
      sessionStorage.setItem(SESSION_KEY, 'no_geocoder');
      return;
    }

    const geocoder = new Geocoder();
    const geoResult = await new Promise<any>((resolve) => {
      geocoder.geocode(
        { location: { lat: latitude, lng: longitude } },
        (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        }
      );
    });

    if (!geoResult || !geoResult.address_components) {
      sessionStorage.setItem(SESSION_KEY, 'geocode_failed');
      return;
    }

    // Parse address components using the shared utility
    const parsed = parseGeoAddressComponents(geoResult.address_components);

    // Only proceed if we got at least one useful field
    if (!parsed.city && !parsed.state && !parsed.zip && !parsed.country) {
      sessionStorage.setItem(SESSION_KEY, 'no_address_data');
      return;
    }

    // Cache the resolved data in sessionStorage for reference
    sessionStorage.setItem('zb_geo_data', JSON.stringify({
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      country: parsed.country,
      countryCode: parsed.countryCode,
      latitude,
      longitude,
    }));

    // Save to Meta PII cookies (hashed) via the existing pipeline
    // This uses the same saveUserDataToCookies that the checkout page uses,
    // so the hashing/normalization is identical.
    await saveUserDataToCookies({
      city: parsed.city || undefined,
      state: parsed.state || undefined,
      zip: parsed.zip || undefined,
      country: parsed.country || undefined,
    });

    // Re-init pixel with the new location data for advanced matching
    initPixel();

    sessionStorage.setItem(SESSION_KEY, 'success');
  } catch {
    // Fail completely silently — never crash the page
    try {
      sessionStorage.setItem(SESSION_KEY, 'error');
    } catch {
      // Even sessionStorage might fail in some contexts — that's fine
    }
  }
}
