/**
 * Affiliate & Creator Program Configuration
 * Reads environment variables with safe, audited defaults.
 */

export const AFFILIATE_CONFIG = {
  // Attribution window (last-touch cookie validity)
  ATTRIBUTION_WINDOW_DAYS: parseInt(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || '30', 10),
  
  // Default creator commission rate (fraction, 10% = 0.10)
  DEFAULT_COMMISSION_RATE: parseFloat(process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || '0.10'),
  
  // Withdrawal thresholds in INR
  MIN_FIRST_WITHDRAWAL: parseFloat(process.env.AFFILIATE_MIN_FIRST_WITHDRAWAL || '5000'),
  MIN_WITHDRAWAL: parseFloat(process.env.AFFILIATE_MIN_WITHDRAWAL || '1000'),
  
  // Hold period in days before a referral can be confirmed (return/exchange window buffer)
  HOLD_DAYS: parseInt(process.env.AFFILIATE_HOLD_DAYS || '10', 10),
  
  // Click deduplication window in minutes
  CLICK_DEDUP_MINUTES: 30,
  
  // Attribution cookie name
  COOKIE_NAME: 'zb_aff',
  
  // RazorpayX Payouts configuration
  RAZORPAY_PAYOUTS_ENABLED: (process.env.RAZORPAY_PAYOUTS_ENABLED || 'false').trim().toLowerCase() === 'true',
  RAZORPAYX_ACCOUNT_NUMBER: process.env.RAZORPAYX_ACCOUNT_NUMBER || '',
  
  // Shared secrets
  get APP_JWT_SECRET(): string {
    return process.env.APP_JWT_SECRET || 'dev-fallback-affiliate-jwt-secret-do-not-use-in-prod';
  },
  
  get SECRET_ENCRYPTION_KEY(): string | undefined {
    return process.env.SECRET_ENCRYPTION_KEY;
  },
};
