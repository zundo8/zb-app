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
let loadedLibraries = new Set<string>();

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
    return false;
  }
}
