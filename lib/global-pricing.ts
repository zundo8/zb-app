/**
 * Global Pricing Utility — Single source of truth for multi-currency price display
 *
 * Formula: finalPrice = round(basePriceINR * multiplier * exchangeRate, 2)
 *
 * - multiplier: admin-set markup factor (2.5× for non-India countries)
 * - exchangeRate: admin-set INR → local currency conversion rate
 * - India (isBase): always returns raw INR price (multiplier=1, exchangeRate=1)
 *
 * Caching: In-memory cache with 60s TTL, same pattern as lib/ip-geo.ts.
 * Cache is explicitly invalidated when admin saves changes via the Global Store module.
 */

import prisma from '@/lib/db';
import {
  CountryPricingConfig,
  DisplayPrice,
  formatPriceString,
  formatPriceWithConfig,
  toMinorUnits,
  fromMinorUnits,
} from './global-pricing-client';

export type { CountryPricingConfig, DisplayPrice };
export { formatPriceString, formatPriceWithConfig, toMinorUnits, fromMinorUnits };

// ── Cache ──

interface CacheState {
  countries: Map<string, CountryPricingConfig>;
  globalStoreEnabled: boolean;
  loadedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedState: CacheState | null = null;

/**
 * Invalidate the pricing cache. Called from the admin Global Store API
 * when countries/settings are updated — ensures real-time reflection on the storefront
 * without waiting for TTL expiry.
 */
export function invalidateGlobalPricingCache(): void {
  cachedState = null;
}

/**
 * Load all active countries + global settings, with caching.
 */
async function loadPricingConfig(): Promise<CacheState> {
  if (cachedState && (Date.now() - cachedState.loadedAt) < CACHE_TTL_MS) {
    return cachedState;
  }

  const [countriesData, settingsData] = await Promise.all([
    prisma.globalStoreCountry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.globalStoreSettings.findUnique({
      where: { id: 'singleton' },
    }),
  ]);

  const countries = new Map<string, CountryPricingConfig>();
  for (const c of countriesData) {
    countries.set(c.code, {
      code: c.code,
      name: c.name,
      currencyCode: c.currencyCode,
      currencySymbol: c.currencySymbol,
      locale: c.locale,
      isBase: c.isBase,
      multiplier: Number(c.multiplier),
      exchangeRate: Number(c.exchangeRate),
      isActive: c.isActive,
      sortOrder: c.sortOrder,
    });
  }

  cachedState = {
    countries,
    globalStoreEnabled: settingsData?.globalStoreEnabled ?? false,
    loadedAt: Date.now(),
  };

  return cachedState;
}

// ── Public API ──

/**
 * Check if the global store feature is enabled.
 */
export async function isGlobalStoreEnabled(): Promise<boolean> {
  const state = await loadPricingConfig();
  return state.globalStoreEnabled;
}

/**
 * Get all active countries for the switcher UI.
 */
export async function getActiveCountries(): Promise<CountryPricingConfig[]> {
  const state = await loadPricingConfig();
  return Array.from(state.countries.values());
}

/**
 * Get pricing config for a specific country.
 * Returns India config if country not found.
 */
export async function getCountryConfig(countryCode: string): Promise<CountryPricingConfig | null> {
  const state = await loadPricingConfig();
  return state.countries.get(countryCode) || state.countries.get('IN') || null;
}

/**
 * Convert and format a base INR price for display in the given country's currency.
 *
 * When globalStoreEnabled=false or country=IN/unresolved, returns exact same
 * output as the legacy `₹{price.toLocaleString("en-IN")}` pattern — zero
 * visual or behavioral change for the Indian storefront.
 *
 * @param basePriceINR - The product's base price in INR (from Shopify/DB)
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g. "US", "IN")
 */
export async function getDisplayPrice(
  basePriceINR: number,
  countryCode: string
): Promise<DisplayPrice> {
  const state = await loadPricingConfig();

  // If feature is off or country is India / unresolvable, return raw INR
  if (!state.globalStoreEnabled || !countryCode || countryCode === 'IN') {
    const config = state.countries.get('IN');
    const amount = basePriceINR;
    return {
      amount,
      formatted: formatPriceString(amount, 'INR', 'en-IN'),
      currencyCode: 'INR',
      currencySymbol: config?.currencySymbol || '₹',
      countryCode: 'IN',
    };
  }

  const config = state.countries.get(countryCode);
  if (!config) {
    // Unknown country — fall back to India pricing
    const amount = basePriceINR;
    return {
      amount,
      formatted: formatPriceString(amount, 'INR', 'en-IN'),
      currencyCode: 'INR',
      currencySymbol: '₹',
      countryCode: 'IN',
    };
  }

  // Formula: finalPrice = round(basePriceINR * multiplier * exchangeRate, 2)
  const amount = Math.round(basePriceINR * config.multiplier * config.exchangeRate * 100) / 100;

  return {
    amount,
    formatted: formatPriceString(amount, config.currencyCode, config.locale),
    currencyCode: config.currencyCode,
    currencySymbol: config.currencySymbol,
    countryCode: config.code,
  };
}


