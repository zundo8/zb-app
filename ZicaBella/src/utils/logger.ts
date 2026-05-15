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
  if (__DEV__) return; 

  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  
  methods.forEach(method => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(console, method);
      if (descriptor && (descriptor.configurable === false || descriptor.writable === false)) {
        return;
      }
      (console as any)[method] = noop;
    } catch (e) {
      // Silently fail if console is locked
    }
  });
}
