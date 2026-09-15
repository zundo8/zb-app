/**
 * Google Maps Loader — Single Source of Truth
 *
 * Wraps @googlemaps/js-api-loader so that `setOptions()` is called EXACTLY ONCE
 * per page load, regardless of how many components need Maps. Every consumer
 * (checkout page, geolocation enrichment, etc.) imports `loadGoogleMaps` from
 * this module instead of touching `setOptions`/`importLibrary` directly.
 *
 * This eliminates the "Sorry! Something went wrong" overlay caused by the
 * global singleton being reconfigured with different library/timing.
 *
 * Library modules loaded via importLibrary() are cached and exported via
 * `getLoadedLibrary()` so consumers can access classes like `Autocomplete`
 * and `Geocoder` directly without relying on `window.google.maps.*` globals.
 */

import { setOptions, importLibrary, type LibraryMap } from '@googlemaps/js-api-loader';

let configured = false;
let bootPromise: Promise<void> | null = null;
const loadedLibraries = new Set<string>();

/**
 * Retry-able failure state.
 * Instead of permanently locking out Maps on any failure, we allow retry
 * after a 30-second backoff to handle transient network/auth issues.
 */
let failedAt: number | null = null;
const RETRY_BACKOFF_MS = 30_000; // 30 seconds before allowing retry

/**
 * Cached library module references returned by importLibrary().
 * Stored so consumers can directly access classes (Autocomplete, Geocoder)
 * without relying on window.google.maps.* global namespace timing.
 */
const libraryModules = new Map<string, any>();

/**
 * Configure the Google Maps loader exactly once. Returns false if no API key
 * is available (Maps features should degrade gracefully).
 */
export function configureGoogleMaps(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return false;
  if (authFailed) return false;

  // On localhost/127.0.0.1, keys restricted to production domains throw RefererNotAllowedMapError.
  // We degrade gracefully to server-side geocoding & /api/geo/suggest.
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && !process.env.NEXT_PUBLIC_ALLOW_LOCAL_MAPS) {
      return false;
    }
  }

  if (!configured) {
    setOptions({ key, v: 'weekly' }); // called EXACTLY ONCE per page load
    configured = true;
  }
  return true;
}

let authFailed = false;

if (typeof window !== 'undefined') {
  // Capture Google Maps auth failure globally to suppress error dialogs
  // and trigger immediate fallback to OpenStreetMap / server geocoding
  (window as any).gm_authFailure = () => {
    console.warn('[GoogleMaps] Auth failure (referrer restriction or invalid key). Using server-side fallback providers.');
    authFailed = true;
    failedAt = Date.now();
    dismissGoogleMapsErrors();
  };
}

export function hasGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

/**
 * Remove Google Maps error overlays injected into the DOM.
 * Google Maps JS API injects error divs (with class "gm-err-*" or
 * data-attributes in certain containers) when there's an auth or loading error.
 * This function removes those overlays so they don't pollute the checkout UI.
 */
export function dismissGoogleMapsErrors(): void {
  if (typeof document === 'undefined') return;
  try {
    // Remove the "Sorry! Something went wrong" overlay containers
    const selectors = [
      '.gm-err-container',
      '.gm-style-pbc',          // The translucent overlay backdrop
      '[data-gm-err-container]',
      '.dismissButton',          // Error dismiss button
    ];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(el => el.remove());
    }
    // Also remove inline error style injections that Google Maps places
    document.querySelectorAll('div[style*="background-color: rgb(229, 227, 223)"]').forEach(el => {
      if (el.textContent?.includes('Something went wrong') || el.textContent?.includes('sorry')) {
        el.remove();
      }
    });
    // Remove standalone error messages, but NEVER delete input elements
    document.querySelectorAll('.gm-err-message, .gm-err-title').forEach(el => el.remove());
    document.querySelectorAll('.gm-err-autocomplete').forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.classList.remove('gm-err-autocomplete');
      } else {
        el.remove();
      }
    });
  } catch {
    // Non-critical — don't let cleanup errors break the app
  }
}

/**
 * Reset the failure state to allow an immediate retry.
 * Call this when the user explicitly requests location detection
 * (e.g., clicks "Detect my location") and you want to force a fresh attempt.
 */
export function resetGoogleMaps(): void {
  failedAt = null;
  bootPromise = null;
}

/**
 * Get a previously loaded library module.
 * Returns the module object (e.g., { Autocomplete, ... } for 'places',
 * { Geocoder, ... } for 'geocoding') or null if not loaded.
 */
export function getLoadedLibrary<T extends keyof LibraryMap>(name: T): LibraryMap[T] | null {
  return libraryModules.get(name) ?? null;
}

/**
 * Idempotent loader: every caller awaits the SAME libraries load; never
 * re-calls setOptions(). Returns true if all requested libraries loaded
 * successfully, false on any failure (missing key, network error, auth error).
 *
 * Failures are retryable after a 30-second backoff period. This prevents
 * permanent lockout from transient issues while avoiding retry-storm loops.
 *
 * @param libraries - Array of Google Maps library names to load.
 *                    Defaults to ['places', 'geocoding'] which covers both
 *                    checkout autocomplete and reverse-geocoding.
 */
export async function loadGoogleMaps(
  libraries: Array<'places' | 'geocoding' | 'maps' | 'marker'> = ['places', 'geocoding']
): Promise<boolean> {
  // Check if we're in a failure backoff period (retry allowed after 30s)
  if (failedAt !== null) {
    const elapsed = Date.now() - failedAt;
    if (elapsed < RETRY_BACKOFF_MS) {
      return false; // Still in backoff — don't retry yet
    }
    // Backoff expired — allow retry
    failedAt = null;
    bootPromise = null;
  }

  if (!configureGoogleMaps()) return false;

  // Determine which libraries still need loading
  const needed = libraries.filter((lib) => !loadedLibraries.has(lib));

  if (needed.length === 0 && bootPromise) {
    // All requested libraries are already loaded
    try {
      await bootPromise;
      return true;
    } catch {
      bootPromise = null;
      failedAt = Date.now();
      dismissGoogleMapsErrors();
      return false;
    }
  }

  if (!bootPromise) {
    // First call — load all requested libraries
    bootPromise = (async () => {
      await Promise.all(
        libraries.map(async (lib) => {
          const module = await importLibrary(lib as keyof LibraryMap);
          loadedLibraries.add(lib);
          libraryModules.set(lib, module);
        })
      );
    })();
  } else if (needed.length > 0) {
    // Subsequent call requesting additional libraries — chain onto existing promise
    const previousPromise = bootPromise;
    bootPromise = (async () => {
      await previousPromise;
      await Promise.all(
        needed.map(async (lib) => {
          const module = await importLibrary(lib as keyof LibraryMap);
          loadedLibraries.add(lib);
          libraryModules.set(lib, module);
        })
      );
    })();
  }

  try {
    await bootPromise;
    return true;
  } catch {
    bootPromise = null;
    failedAt = Date.now();
    dismissGoogleMapsErrors();
    return false;
  }
}
