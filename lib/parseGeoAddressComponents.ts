/**
 * Shared Google Maps Address Component Parser
 *
 * Extracts city, state, postal code, and country from Google Maps
 * Geocoding API `address_components` array. Used by:
 * - Checkout page (Places Autocomplete + detect location)
 * - Geolocation enrichment (silent reverse geocode for EMQ)
 */

export interface GoogleAddressComponent {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types: string[];
}

export interface ParsedGeoAddress {
  city: string;
  state: string;
  zip: string;
  country: string;
  /** 2-letter ISO country code (e.g. "IN", "US") — from short_name */
  countryCode: string;
}

/**
 * Parse Google Maps address_components into structured geo fields.
 * Returns only the fields needed for Meta user_data enrichment.
 */
export function parseGeoAddressComponents(components: GoogleAddressComponent[]): ParsedGeoAddress {
  let city = '';
  let district = '';
  let state = '';
  let zip = '';
  let country = '';
  let countryCode = '';
  let sublocality1 = '';
  let sublocality = '';

  for (const comp of components) {
    const longName = comp.long_name || comp.longText || comp.short_name || comp.shortText || '';
    const shortName = comp.short_name || comp.shortText || longName;
    const types = comp.types || [];

    if (types.includes('postal_code')) {
      zip = longName;
    } else if (types.includes('administrative_area_level_1')) {
      state = longName;
    } else if (types.includes('locality')) {
      city = longName;
    } else if (types.includes('administrative_area_level_2')) {
      district = longName;
    } else if (types.includes('sublocality_level_1')) {
      sublocality1 = longName;
    } else if (types.includes('sublocality')) {
      sublocality = longName;
    } else if (types.includes('country')) {
      country = longName;
      countryCode = shortName.toUpperCase();
    }
  }

  // In India, locality is typically the city. Fall back through district → sublocality.
  const finalCity = city || district || sublocality1 || sublocality || '';

  return {
    city: finalCity,
    state,
    zip,
    country,
    countryCode: countryCode || '',
  };
}
