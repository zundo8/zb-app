import { getClientIP, lookupIpGeo } from './ip-geo';

export interface ClientGeoInput {
  latitude?: number | string | null;
  longitude?: number | string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null; // alias for region (used by zb_geo_data)
  country?: string | null;
  countryCode?: string | null;
  zip?: string | null;
}

export interface EventGeo {
  ip: string | null;
  geoSource: 'GPS' | 'IP' | 'NONE';
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
}

function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));
  return (
    Number.isFinite(numLat) &&
    Number.isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180 &&
    !(numLat === 0 && numLng === 0)
  );
}

/**
 * Resolves event geolocation given an explicit IP address and optional browser client coordinates.
 * Implements GPS-first with IP-fallback, completely fail-open.
 */
export async function resolveEventGeoFromIp(
  ip: string | null,
  clientGeo?: ClientGeoInput,
  req?: Request
): Promise<EventGeo> {
  const cleanIp = ip && ip.trim() ? ip.trim() : null;

  try {
    // 1. GPS-First check: If browser geolocation provides valid finite latitude and longitude
    if (clientGeo && isValidCoordinate(clientGeo.latitude, clientGeo.longitude)) {
      const lat = typeof clientGeo.latitude === 'number' ? clientGeo.latitude : parseFloat(String(clientGeo.latitude));
      const lng = typeof clientGeo.longitude === 'number' ? clientGeo.longitude : parseFloat(String(clientGeo.longitude));

      let city = clientGeo.city ? String(clientGeo.city).trim() : null;
      let region = clientGeo.region || clientGeo.state ? String(clientGeo.region || clientGeo.state).trim() : null;
      let country = clientGeo.country ? String(clientGeo.country).trim() : null;
      let countryCode = clientGeo.countryCode ? String(clientGeo.countryCode).trim() : null;
      let zip = clientGeo.zip ? String(clientGeo.zip).trim() : null;

      // If any textual fields (city/region/country) are missing, attempt to fill them from IP geo
      if ((!city || !region || !country) && cleanIp) {
        try {
          const ipGeo = await lookupIpGeo(cleanIp, req);
          if (ipGeo) {
            city = city || ipGeo.city || null;
            region = region || ipGeo.region || null;
            country = country || ipGeo.country || null;
            countryCode = countryCode || ipGeo.countryCode || null;
            zip = zip || ipGeo.zip || null;
          }
        } catch (ipErr) {
          // IP fallback enrichment failed; GPS lat/lng remains authoritative
          console.warn('[resolveEventGeo] Textual IP fallback lookup failed:', ipErr);
        }
      }

      return {
        ip: cleanIp,
        geoSource: 'GPS',
        city,
        region,
        country,
        countryCode,
        zip,
        latitude: lat,
        longitude: lng,
      };
    }

    // 2. IP Fallback check: If GPS is not available, resolve via lookupIpGeo
    if (cleanIp) {
      try {
        const ipGeo = await lookupIpGeo(cleanIp, req);
        if (ipGeo) {
          return {
            ip: cleanIp,
            geoSource: 'IP',
            city: ipGeo.city || null,
            region: ipGeo.region || null,
            country: ipGeo.country || null,
            countryCode: ipGeo.countryCode || null,
            zip: ipGeo.zip || null,
            latitude: ipGeo.lat ?? null,
            longitude: ipGeo.lng ?? null,
          };
        }
      } catch (ipErr) {
        console.warn('[resolveEventGeo] IP geo lookup failed:', ipErr);
      }
    }

    // 3. Fallback: Both GPS and IP geo are unavailable
    return {
      ip: cleanIp,
      geoSource: 'NONE',
      city: null,
      region: null,
      country: null,
      countryCode: null,
      zip: null,
      latitude: null,
      longitude: null,
    };
  } catch (error) {
    // Fail-open: Never throw, never block logins or support interactions
    console.error('[resolveEventGeo] Unhandled error during geo resolution:', error);
    return {
      ip: cleanIp,
      geoSource: 'NONE',
      city: null,
      region: null,
      country: null,
      countryCode: null,
      zip: null,
      latitude: null,
      longitude: null,
    };
  }
}

/**
 * Resolves event geolocation from a standard incoming HTTP Request.
 * Extracts client IP using getClientIP(req) from lib/ip-geo.ts.
 */
export async function resolveEventGeo(
  req: Request,
  clientGeo?: ClientGeoInput
): Promise<EventGeo> {
  let ip: string | null = null;
  try {
    ip = getClientIP(req);
  } catch {
    ip = null;
  }
  return resolveEventGeoFromIp(ip, clientGeo, req);
}
