/**
 * Safe bridge for react-native-customui (Razorpay Custom UI SDK).
 *
 * The SDK's Razorpay.js creates a NativeEventEmitter at import time,
 * which crashes with "NativeEventEmitter requires a non-null argument"
 * if the native binary hasn't been rebuilt after installing the package.
 *
 * This wrapper:
 *  1. Lazy-loads the SDK so the app doesn't crash at startup
 *  2. Provides a graceful fallback with clear error messages
 *  3. Auto-recovers once the native binary is rebuilt
 */
import { NativeModules } from 'react-native';

export interface UPIApp {
  app_name: string;
  app_icon: string; // base64 encoded PNG
  package_name: string;
}

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Check if native module is available BEFORE importing the JS wrapper
function isNativeModuleAvailable(): boolean {
  return !!(
    NativeModules.RazorpayCustomui &&
    NativeModules.RazorpayEventEmitterCustom
  );
}

let _razorpay: any = null;
let _loadError: string | null = null;

function getRazorpay(): any {
  if (_razorpay) return _razorpay;
  if (_loadError) return null;

  if (!isNativeModuleAvailable()) {
    _loadError =
      'Razorpay Custom UI native module not found. ' +
      'Please rebuild the native binary: npx expo run:ios';
    console.warn('[RazorpayBridge]', _loadError);
    return null;
  }

  try {
    // Safe to import now — native module exists
    _razorpay = require('react-native-customui').default;
    return _razorpay;
  } catch (e: any) {
    _loadError = `Failed to load Razorpay SDK: ${e.message}`;
    console.error('[RazorpayBridge]', _loadError);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function isRazorpayAvailable(): boolean {
  return !!getRazorpay();
}

export function getRazorpayLoadError(): string | null {
  if (!isNativeModuleAvailable()) {
    return 'Razorpay Custom UI native module not found. Rebuild required: npx expo run:ios';
  }
  return _loadError;
}

export async function razorpayOpen(
  options: Record<string, any>,
): Promise<PaymentResult> {
  const sdk = getRazorpay();
  if (!sdk) {
    throw new Error(
      getRazorpayLoadError() ||
        'Razorpay SDK not available. Rebuild the native app.',
    );
  }
  return sdk.open(options);
}

export async function razorpayInit(key: string): Promise<void> {
  const sdk = getRazorpay();
  if (!sdk) {
    console.warn('[RazorpayBridge] SDK not available for init');
    return;
  }
  return sdk.initRazorpay(key);
}

export function razorpayGetAppsWhichSupportUPI(
  callback: (apps: UPIApp[]) => void,
): void {
  const sdk = getRazorpay();
  if (!sdk) {
    console.warn('[RazorpayBridge] SDK not available, returning empty UPI apps');
    callback([]);
    return;
  }
  sdk.getAppsWhichSupportUPI(callback);
}
