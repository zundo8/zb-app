/**
 * useRazorpay — Custom UI SDK hook (react-native-customui)
 *
 * Uses Razorpay Custom UI SDK instead of Standard SDK.
 * This gives us FULL control over the payment UI — no Razorpay checkout sheet
 * is ever shown. Razorpay.open() goes directly to the selected payment method.
 *
 * Key difference from Standard SDK:
 *   Standard SDK:  always opens Razorpay's own checkout sheet (cannot suppress)
 *   Custom UI SDK: you own the entire UI, SDK only processes the payment
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  razorpayOpen,
  razorpayGetAppsWhichSupportUPI,
  razorpayInit,
  isRazorpayAvailable,
  getRazorpayLoadError,
} from '../utils/razorpayBridge';
import type { UPIApp as BridgeUPIApp, PaymentResult as BridgePaymentResult } from '../utils/razorpayBridge';
import { getPaymentApiBaseUrl } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { checkOrderStatus } from '../api/payment';

// ── Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'processing'
  | 'waiting_capture'
  | 'verifying'
  | 'success'
  | 'failed';

export interface UPIApp {
  app_name: string;
  app_icon: string; // base64 encoded PNG
  package_name: string;
  is_available?: boolean;
}

export interface PaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}

export interface PaymentSuccessData {
  paymentId: string;
  orderId: string;
}

export interface UseRazorpayOptions {
  amount: number; // In rupees
  currency?: string;
  receipt?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  // Pre-created order fields (from OrderReviewScreen)
  orderId?: string;       // Razorpay order_id already created
  razorpayKeyId?: string; // Key used to create the order
  // ── Method-specific fields ──
  selectedAppPackage?: string;    // For UPI Intent — package name from getAppsWhichSupportUPI
  cardNumber?: string;            // For card payments
  cardExpiry?: string;            // MM/YY
  cardCvv?: string;
  cardName?: string;
  bankCode?: string;              // For netbanking (e.g. 'SBIN', 'HDFC')
  walletCode?: string;            // For wallet (e.g. 'paytm', 'phonepe')
}

export interface UseRazorpayReturn {
  status: PaymentStatus;
  error: string | null;
  successData: PaymentSuccessData | null;
  upiApps: UPIApp[];
  isLoadingApps: boolean;
  fetchInstalledUPIApps: () => void;
  startPayment: (method: PaymentMethod, options: UseRazorpayOptions) => Promise<void>;
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useRazorpay(): UseRazorpayReturn {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const [upiApps, setUpiApps] = useState<UPIApp[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = false;
    setStatus('idle');
    setError(null);
    setSuccessData(null);
  }, []);

  const cleanContact = (phone?: string) =>
    (phone || '').replace(/\D/g, '').slice(-10);

  const normalizeEmail = (email?: string) => {
    const value = (email || '').trim();
    return value.includes('@') ? value : 'support@zicabella.com';
  };

  const normalizeExpiry = (expiry?: string) => {
    const [monthRaw, yearRaw] = (expiry || '').split('/');
    const month = (monthRaw || '').replace(/\D/g, '').padStart(2, '0');
    const year = (yearRaw || '').replace(/\D/g, '');
    return {
      month,
      year: year.length === 2 ? year : year.slice(-2),
      combined: month && year ? `${month}/${year.length === 2 ? year : year.slice(-2)}` : '',
    };
  };

  const normalizePaymentResult = (data: any, fallbackOrderId: string): PaymentResult => {
    const paymentId =
      data?.razorpay_payment_id ||
      data?.payment_id ||
      data?.paymentId ||
      data?.data?.razorpay_payment_id ||
      data?.data?.payment_id;
    const resolvedOrderId =
      data?.razorpay_order_id ||
      data?.order_id ||
      data?.orderId ||
      data?.data?.razorpay_order_id ||
      data?.data?.order_id ||
      fallbackOrderId;
    const signature =
      data?.razorpay_signature ||
      data?.signature ||
      data?.data?.razorpay_signature ||
      data?.data?.signature;

    if (!paymentId) {
      throw new Error('Payment completed, but Razorpay did not return a payment id.');
    }

    return {
      razorpay_payment_id: String(paymentId),
      razorpay_order_id: String(resolvedOrderId),
      razorpay_signature: signature ? String(signature) : undefined,
    };
  };

  // ── Initialize SDK when key is available ───────────────────────────
  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
    if (key && isRazorpayAvailable()) {
      console.log('[useRazorpay] Initializing SDK...');
      razorpayInit(key).catch(err => {
        console.warn('[useRazorpay] Init failed:', err);
      });
    }
  }, []);

  // ── Polling for UPI Intent (payment may complete in external app) ──

  const pollIntervalRef = useRef<any>(null);
  const currentOrderIdRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);

  const startPolling = useCallback(async (orderId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    currentOrderIdRef.current = orderId;
    isPollingRef.current = true;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await checkOrderStatus(orderId);
        if (res.status === 'paid' && res.paymentId) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setSuccessData({ paymentId: res.paymentId, orderId: orderId });
          setStatus('success');
          isPollingRef.current = false;
        }
      } catch (e) {
        console.warn('[useRazorpay] Polling error:', e);
      }
    }, 3000);
  }, []);

  // AppState listener — check payment status when user returns from UPI app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && isPollingRef.current && currentOrderIdRef.current) {
        checkOrderStatus(currentOrderIdRef.current).then(res => {
          if (res.status === 'paid' && res.paymentId) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setSuccessData({ paymentId: res.paymentId, orderId: currentOrderIdRef.current! });
            setStatus('success');
            isPollingRef.current = false;
          }
        }).catch(() => {});
      }
    });
    return () => {
      sub.remove();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Fetch UPI apps installed on device ─────────────────────────────
  // This is the KEY function — shows only apps the user actually has installed.
  // Only works on real devices. Returns empty on emulators/simulators.
  const fetchInstalledUPIApps = useCallback(() => {
    setIsLoadingApps(true);
    if (!isRazorpayAvailable()) {
      console.warn('[useRazorpay] SDK not available:', getRazorpayLoadError());
      setUpiApps([]);
      setIsLoadingApps(false);
      return;
    }
    try {
      razorpayGetAppsWhichSupportUPI((data: BridgeUPIApp[]) => {
        const apps = Array.isArray(data) ? data : [];
        const availableCount = apps.filter(app => app.is_available !== false).length;
        console.log('[useRazorpay] Installed UPI apps:', availableCount);
        setUpiApps(apps);
        setIsLoadingApps(false);
      });
    } catch (e) {
      console.warn('[useRazorpay] getAppsWhichSupportUPI error:', e);
      setUpiApps([]);
      setIsLoadingApps(false);
    }
  }, []);

  // ── MAIN PAYMENT ENTRY POINT ──────────────────────────────────────

  const startPayment = useCallback(
    async (method: PaymentMethod, opts: UseRazorpayOptions) => {
      abortRef.current = false;
      setError(null);
      setSuccessData(null);

      const token = useAuthStore.getState().token || '';
      const apiBase = getPaymentApiBaseUrl();
      const amountPaise = Math.round(opts.amount * 100);

      try {
        let orderId = opts.orderId;
        let keyId = opts.razorpayKeyId;

        // ── Step 1: Create order on backend (only if not pre-created) ──
        if (!orderId || !keyId) {
          setStatus('creating_order');

          const orderRes = await fetch(`${apiBase}/api/app/payment/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              amount: opts.amount,
              currency: opts.currency || 'INR',
              receipt: opts.receipt || `zb_${Date.now()}`,
            }),
          });

          const orderText = await orderRes.text();
          let orderJson: any;
          try {
            orderJson = JSON.parse(orderText);
          } catch {
            throw new Error('Server error: Invalid response format');
          }

          if (!orderRes.ok || !orderJson.order_id) {
            throw new Error(orderJson.error || 'Failed to create payment order');
          }

          orderId = orderJson.order_id;
          keyId = orderJson.key_id;
        }

        if (!keyId || !String(keyId).startsWith('rzp_')) {
          throw new Error('Invalid Razorpay key. Please contact support.');
        }

        if (abortRef.current) return;

        // ── Step 2: Build Custom UI SDK options (method-specific) ──
        setStatus('processing');
        const contact = cleanContact(opts.prefill?.contact);
        const email = normalizeEmail(opts.prefill?.email);
        const name = (opts.prefill?.name || 'Zica Customer').trim();

        // Base options common to all methods
        const baseOptions: Record<string, any> = {
          description: 'Zica Bella Order Payment',
          image: 'https://zicabella.com/icon.png',
          currency: opts.currency || 'INR',
          key_id: keyId,
          amount: String(amountPaise),
          order_id: orderId,
          email,
          contact: contact || '9999999999',
          name,
          prefill: {
            name,
            email,
            contact: contact || '9999999999',
          },
          notes: opts.notes || {},
        };

        let rzpOptions: Record<string, any>;

        switch (method) {
          case 'upi': {
            // ── UPI Intent — directly launches the selected UPI app ──
            if (!opts.selectedAppPackage) {
              throw new Error('Please select a UPI app to continue');
            }
            rzpOptions = {
              ...baseOptions,
              method: 'upi',
              '_[flow]': 'intent',                        // ← CRITICAL: triggers UPI Intent
              upi_app_package_name: opts.selectedAppPackage, // ← CRITICAL: opens specific app
            };
            break;
          }

          case 'card': {
            // ── Card Payment — direct card processing, no SDK sheet ──
            if (!opts.cardNumber || !opts.cardExpiry || !opts.cardCvv) {
              throw new Error('Please fill in all card details');
            }
            const cardNumber = opts.cardNumber.replace(/\s/g, '');
            const expiry = normalizeExpiry(opts.cardExpiry);
            if (cardNumber.length < 12 || !expiry.month || !expiry.year || Number(expiry.month) < 1 || Number(expiry.month) > 12) {
              throw new Error('Please enter valid card details');
            }
            rzpOptions = {
              ...baseOptions,
              method: 'card',
              'card[number]': cardNumber,
              'card[expiry]': expiry.combined,
              'card[expiry_month]': expiry.month,
              'card[expiry_year]': expiry.year,
              'card[cvv]': opts.cardCvv,
              'card[name]': opts.cardName || name,
            };
            break;
          }

          case 'netbanking': {
            // ── Netbanking — opens bank login page ──
            if (!opts.bankCode) {
              throw new Error('Please select a bank to continue');
            }
            rzpOptions = {
              ...baseOptions,
              method: 'netbanking',
              bank: opts.bankCode.toUpperCase(),
            };
            break;
          }

          case 'wallet': {
            // ── Wallet — opens wallet payment flow ──
            if (!opts.walletCode) {
              throw new Error('Please select a wallet to continue');
            }
            rzpOptions = {
              ...baseOptions,
              method: 'wallet',
              wallet: opts.walletCode,
            };
            break;
          }

          default:
            throw new Error(`Unsupported payment method: ${method}`);
        }

        // ── Step 3: Open Custom UI SDK — NO Razorpay screen shown ──
        let paymentData: PaymentResult;
        try {
          console.log('[useRazorpay] Opening Custom UI SDK:', {
            method,
            key: rzpOptions.key_id?.slice(0, 10) + '...',
            order_id: orderId,
            ...(method === 'upi' ? { app: opts.selectedAppPackage } : {}),
          });

          // For UPI Intent, also start polling in case SDK callback doesn't fire
          if (method === 'upi') {
            startPolling(orderId!);
          }

          paymentData = normalizePaymentResult(await razorpayOpen(rzpOptions), orderId!);
          console.log('[useRazorpay] SDK Success:', {
            payment_id: paymentData.razorpay_payment_id,
            order_id: paymentData.razorpay_order_id,
          });

          // Stop polling if it was running
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          isPollingRef.current = false;

        } catch (rzpErr: any) {
          console.log('[useRazorpay] SDK Error:', JSON.stringify(rzpErr));
          // Stop polling on error
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          isPollingRef.current = false;

          // code 0 or 2 means user cancelled
          if (rzpErr?.code === 0 || rzpErr?.code === 2) {
            setStatus('idle');
            return;
          }
          throw new Error(
            rzpErr?.description || rzpErr?.message || 'Payment was cancelled or failed'
          );
        }

        if (abortRef.current) return;

        // ── Step 4: Verify signature on backend ──
        setStatus('verifying');

        const verifyBody = paymentData.razorpay_signature
          ? {
              razorpay_order_id: paymentData.razorpay_order_id,
              razorpay_payment_id: paymentData.razorpay_payment_id,
              razorpay_signature: paymentData.razorpay_signature,
            }
          : {
              razorpay_order_id: paymentData.razorpay_order_id,
              razorpay_payment_id: paymentData.razorpay_payment_id,
            };

        const verifyRes = await fetch(`${apiBase}/api/app/payment/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(verifyBody),
        });

        const verifyText = await verifyRes.text();
        let verifyJson: any;
        try {
          verifyJson = JSON.parse(verifyText);
        } catch {
          throw new Error('Server error: Invalid verification response');
        }

        if (!verifyJson.success) {
          throw new Error(verifyJson.error || 'Payment verification failed');
        }

        console.log('[useRazorpay] Payment verified successfully');

        setSuccessData({
          paymentId: paymentData.razorpay_payment_id,
          orderId: paymentData.razorpay_order_id,
        });
        setStatus('success');

      } catch (err: any) {
        if (!abortRef.current) {
          console.error('[useRazorpay] Final Error:', err);
          setError(err.message || 'Payment failed');
          setStatus('failed');
        }
      }
    },
    [startPolling],
  );

  return {
    status,
    error,
    successData,
    upiApps,
    isLoadingApps,
    fetchInstalledUPIApps,
    startPayment,
    reset,
  };
}
