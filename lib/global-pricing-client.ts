/**
 * Global Pricing Client Utilities — Pure client-side formatting functions and types.
 * Does NOT import `lib/db` or `@prisma/client` to ensure zero Node.js native module leakage
 * into client bundles.
 */

// ── Types ──

export interface CountryPricingConfig {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  isBase: boolean;
  multiplier: number;
  exchangeRate: number;
  isActive: boolean;
  sortOrder: number;
}

export interface DisplayPrice {
  /** Numeric amount in the target currency (2 decimal places) */
  amount: number;
  /** Locale-formatted string with currency symbol (e.g. "$124.75", "₹4,990") */
  formatted: string;
  /** ISO 4217 currency code (e.g. "USD", "INR") */
  currencyCode: string;
  /** Currency symbol for display (e.g. "$", "₹") */
  currencySymbol: string;
  /** The country code this price was calculated for */
  countryCode: string;
}

// ── Pure Formatting Helpers ──

/**
 * Format a price already in the target currency (no conversion).
 */
export function formatPriceString(amount: number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: currencyCode === "INR" ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Synchronous format function for client-side use when pricing config
 * is already loaded.
 */
export function formatPriceWithConfig(
  basePriceINR: number,
  config: CountryPricingConfig | null,
  globalStoreEnabled: boolean
): DisplayPrice {
  if (!globalStoreEnabled || !config || config.isBase) {
    return {
      amount: basePriceINR,
      formatted: formatPriceString(basePriceINR, "INR", "en-IN"),
      currencyCode: "INR",
      currencySymbol: "₹",
      countryCode: "IN",
    };
  }

  const amount = Math.round(basePriceINR * config.multiplier * config.exchangeRate * 100) / 100;

  return {
    amount,
    formatted: formatPriceString(amount, config.currencyCode, config.locale),
    currencyCode: config.currencyCode,
    currencySymbol: config.currencySymbol,
    countryCode: config.code,
  };
}

// ── Currency minor-unit helpers (for Razorpay) ──

const MINOR_UNIT_MULTIPLIER: Record<string, number> = {
  INR: 100, // paise
  USD: 100, // cents
  GBP: 100, // pence
  CAD: 100, // cents
  AUD: 100, // cents
  AED: 100, // fils
  EUR: 100, // cents
};

export function toMinorUnits(amount: number, currencyCode: string): number {
  const multiplier = MINOR_UNIT_MULTIPLIER[currencyCode] ?? 100;
  return Math.round(amount * multiplier);
}

export function fromMinorUnits(minorAmount: number, currencyCode: string): number {
  const multiplier = MINOR_UNIT_MULTIPLIER[currencyCode] ?? 100;
  return minorAmount / multiplier;
}
