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
 */

import { setOptions, importLibrary, type LibraryMap } from '@googlemaps/js-api-loader';

let configured = false;
let bootPromise: Promise<void> | null = null;
const loadedLibraries = new Set<string>();
let hasFailed = false;

/**
 * Configure the Google Maps loader exactly once. Returns false if no API key
 * is available (Maps features should degrade gracefully).
 */
export function configureGoogleMaps(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return false;
  if (!configured) {
    setOptions({ key, v: 'weekly' }); // called EXACTLY ONCE per page load
    configured = true;
  }
  return true;
}

/**
 * Remove Google Maps error overlays injected into the DOM.
 * Google Maps JS API injects error divs (with class "gm-err-*" or
 * data-attributesin certain containers) when there's an auth or loading error.
 * This function removes those overlays so they don't pollute the checkout UI.
 */
export function dismissGoogleMapsErrors(): void {
  if (typeof document === 'undefined') return;
  try {
    // Remove the "Sorry! Something went wrong" overlay containers
    // Google Maps injects these with specific class patterns
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
    // Remove the gm-err-message elements
    document.querySelectorAll('.gm-err-message, .gm-err-title, .gm-err-autocomplete').forEach(el => el.remove());
  } catch {
    // Non-critical — don't let cleanup errors break the app
  }
}

/**
 * Idempotent loader: every caller awaits the SAME libraries load; never
 * re-calls setOptions(). Returns true if all requested libraries loaded
 * successfully, false on any failure (missing key, network error, auth error).
 *
 * @param libraries - Array of Google Maps library names to load.
 *                    Defaults to ['places', 'geocoding'] which covers both
 *                    checkout autocomplete and reverse-geocoding.
 */
export async function loadGoogleMaps(
  libraries: Array<'places' | 'geocoding' | 'maps' | 'marker'> = ['places', 'geocoding']
): Promise<boolean> {
  // If a previous attempt failed, don't retry (avoids re-triggering the error overlay)
  if (hasFailed) return false;

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
      hasFailed = true;
      dismissGoogleMapsErrors();
      return false;
    }
  }

  if (!bootPromise) {
    // First call — load all requested libraries
    bootPromise = (async () => {
      await Promise.all(
        libraries.map(async (lib) => {
          await importLibrary(lib as keyof LibraryMap);
          loadedLibraries.add(lib);
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
          await importLibrary(lib as keyof LibraryMap);
          loadedLibraries.add(lib);
        })
      );
    })();
  }

  try {
    await bootPromise;
    return true;
  } catch {
    bootPromise = null;
    hasFailed = true;
    dismissGoogleMapsErrors();
    return false;
  }
}
