/**
 * Production-safe Logger
 *
 * In __DEV__ mode, logs are forwarded to the native console.
 * In production builds, all console output is suppressed to prevent
 * leaking sensitive data (tokens, PII, API responses) to device logs.
 *
 * Import and call `suppressProductionLogs()` once at app startup.
 */

const noop = () => {};

/**
 * Call once in index.ts / App.tsx to suppress all console output in production.
 * This prevents tokens, user data, and API responses from leaking into device logs
 * that can be read by third-party crash reporters or device log aggregators.
 */
export function suppressProductionLogs(): void {
  if (__DEV__) return; // Keep logs in development

  // Suppress all console methods in production
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
  console.trace = noop;
}
