import { useState, useCallback, useRef, useEffect } from 'react';
import { Linking, AppState, AppStateStatus, Platform } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl, config } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { checkOrderStatus } from '../api/payment';

// ── Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'processing'
  | 'awaiting_upi'      // ← New: waiting for user to return from UPI app
  | 'verifying'
  | 'success'
  | 'failed';

export interface PaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentSuccessData {
  paymentId: string;
  orderId: string;
}

export interface PaymentErrorData {
  code: number;
  description: string;
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
  // ── Method-specific fields ──
  upiId?: string;               // For UPI ID payments
  upiApp?: 'gpay' | 'phonepe' | 'paytm' | 'bhim'; // For UPI app quick-select
  cardNumber?: string;          // For card payments
  cardExpiry?: string;          // MM/YY
  cardCvv?: string;
  cardName?: string;
  bankCode?: string;            // For netbanking (e.g. 'SBIN', 'HDFC')
  walletCode?: string;          // For wallet (e.g. 'paytm', 'phonepe')
}

export interface UseRazorpayReturn {
  status: PaymentStatus;
  error: string | null;
  successData: PaymentSuccessData | null;
  startPayment: (method: PaymentMethod, options: UseRazorpayOptions) => Promise<void>;
  reset: () => void;
  /** Stop UPI polling (e.g. user taps "Cancel") */
  cancelUpiPolling: () => void;
}

// ── UPI App-specific URI schemes ─────────────────────────────────────

const UPI_APP_SCHEMES: Record<string, string> = {
  gpay: 'tez://upi/pay',        // Google Pay
  phonepe: 'phonepe://pay',      // PhonePe
  paytm: 'paytmmp://pay',        // Paytm
  bhim: 'upi://pay',             // BHIM / generic
};

// ── Merchant UPI VPA (used for UPI intent) ───────────────────────────
// This should match the VPA configured in your Razorpay dashboard.
// If you don't have one, users can still pay — the UPI app will prompt.
const MERCHANT_UPI_VPA = 'zicabella@razorpay';

// ── Hook ─────────────────────────────────────────────────────────────

export function useRazorpay(): UseRazorpayReturn {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const abortRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOrderIdRef = useRef<string | null>(null);

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // ── AppState listener: detect return from UPI app ──
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (
        nextState === 'active' &&
        status === 'awaiting_upi' &&
        currentOrderIdRef.current
      ) {
        // User returned from UPI app — do an immediate poll
        console.log('[useRazorpay] App became active, polling UPI status...');
        pollOnce(currentOrderIdRef.current);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [status]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
    stopPolling();
    currentOrderIdRef.current = null;
    setStatus('idle');
    setError(null);
    setSuccessData(null);
  }, [stopPolling]);

  const cancelUpiPolling = useCallback(() => {
    stopPolling();
    currentOrderIdRef.current = null;
    setStatus('idle');
  }, [stopPolling]);

  /**
   * Single poll attempt against the backend
   */
  const pollOnce = useCallback(async (orderId: string) => {
    try {
      const result = await checkOrderStatus(orderId);
      if (result.status === 'paid') {
        stopPolling();
        setSuccessData({
          paymentId: result.paymentId || 'upi_payment',
          orderId,
        });
        setStatus('success');
        return true;
      }
    } catch (e) {
      console.log('[useRazorpay] Poll error (non-fatal):', e);
    }
    return false;
  }, [stopPolling]);

  /**
   * Start polling the backend for UPI payment confirmation
   */
  const startUpiPolling = useCallback((orderId: string) => {
    currentOrderIdRef.current = orderId;
    setStatus('awaiting_upi');

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      pollOnce(orderId);
    }, 3000);

    // Auto-stop after 5 minutes
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      if (status === 'awaiting_upi') {
        setError('Payment confirmation timed out. If you completed the payment, please contact support.');
        setStatus('failed');
      }
    }, 300000);
  }, [pollOnce, stopPolling, status]);

  // ── Clean phone helper ──
  const cleanContact = (phone?: string) =>
    (phone || '').replace(/\D/g, '').slice(-10);

  // ── MAIN PAYMENT ENTRY POINT ──────────────────────────────────────

  const startPayment = useCallback(
    async (method: PaymentMethod, opts: UseRazorpayOptions) => {
      abortRef.current = false;
      setStatus('creating_order');
      setError(null);
      setSuccessData(null);

      const token = useAuthStore.getState().token || '';
      const apiBase = getPaymentApiBaseUrl();
      const amountPaise = Math.round(opts.amount * 100);

      try {
        // ── Step 1: Create order on backend ──
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
          throw new Error('Invalid server response. Check backend connectivity.');
        }

        if (!orderRes.ok || !orderJson.order_id) {
          throw new Error(orderJson.error || 'Failed to create payment order.');
        }

        const orderId = orderJson.order_id;
        const keyId = orderJson.key_id;

        if (!keyId || !String(keyId).startsWith('rzp_')) {
          throw new Error('Invalid Razorpay key returned from server.');
        }

        if (abortRef.current) return;

        // ── Step 2: Route to the correct payment handler ──
        setStatus('processing');

        switch (method) {
          case 'upi':
            await handleUpiPayment(orderId, keyId, amountPaise, opts);
            break;
          case 'card':
            await handleCardPayment(orderId, keyId, amountPaise, opts);
            break;
          case 'netbanking':
            await handleNetbankingPayment(orderId, keyId, amountPaise, opts);
            break;
          case 'wallet':
            await handleWalletPayment(orderId, keyId, amountPaise, opts);
            break;
        }
      } catch (err: any) {
        if (!abortRef.current) {
          setError(err.message || 'Payment failed. Please try again.');
          setStatus('failed');
        }
      }
    },
    [],
  );

  // ════════════════════════════════════════════════════════════════════
  // UPI PAYMENT — Bypass Razorpay SDK entirely, use Linking
  // ════════════════════════════════════════════════════════════════════

  const handleUpiPayment = async (
    orderId: string,
    _keyId: string,
    amountPaise: number,
    opts: UseRazorpayOptions,
  ) => {
    const amountRupees = (amountPaise / 100).toFixed(2);

    // Build UPI deep link
    let baseScheme = 'upi://pay';
    if (opts.upiApp && UPI_APP_SCHEMES[opts.upiApp]) {
      baseScheme = UPI_APP_SCHEMES[opts.upiApp];
    }

    const params = new URLSearchParams({
      pa: MERCHANT_UPI_VPA,              // Merchant VPA
      pn: 'Zica Bella',                  // Payee name
      am: amountRupees,                  // Amount
      cu: 'INR',                         // Currency
      tn: `Order ${orderId.slice(-12)}`, // Transaction note
      tr: orderId,                        // Transaction reference
    });

    const upiUrl = `${baseScheme}?${params.toString()}`;
    console.log('[useRazorpay] UPI URL:', upiUrl);

    // Check if any UPI app can handle this
    const canOpen = await Linking.canOpenURL(upiUrl);
    if (!canOpen) {
      // Fallback to generic upi:// scheme
      const fallbackUrl = `upi://pay?${params.toString()}`;
      const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
      if (!canOpenFallback) {
        throw new Error('No UPI app found on this device. Please use Card or Netbanking.');
      }
      await Linking.openURL(fallbackUrl);
    } else {
      await Linking.openURL(upiUrl);
    }

    // Start polling for payment confirmation
    // The UI should switch to the UPI confirmation screen
    startUpiPolling(orderId);
  };

  // ════════════════════════════════════════════════════════════════════
  // CARD PAYMENT — Use Razorpay SDK with STRICT method lock
  // ════════════════════════════════════════════════════════════════════

  const handleCardPayment = async (
    orderId: string,
    keyId: string,
    amountPaise: number,
    opts: UseRazorpayOptions,
  ) => {
    const contact = cleanContact(opts.prefill?.contact);

    const rzpOptions: Record<string, any> = {
      key: keyId,
      amount: amountPaise,
      currency: opts.currency || 'INR',
      order_id: orderId,
      name: 'Zica Bella',
      description: 'Order Payment',
      prefill: {
        name: opts.cardName || opts.prefill?.name || '',
        email: opts.prefill?.email || '',
        contact,
        // ── CRITICAL: Pre-select card method + pre-fill card details ──
        method: 'card',
        ...(opts.cardNumber ? { 'card[number]': opts.cardNumber.replace(/\s/g, '') } : {}),
        ...(opts.cardExpiry ? { 'card[expiry]': opts.cardExpiry } : {}),
        ...(opts.cardCvv ? { 'card[cvv]': opts.cardCvv } : {}),
        ...(opts.cardName ? { 'card[name]': opts.cardName } : {}),
      },
      // ── CRITICAL: Disable ALL other payment methods ──
      method: {
        card: true,
        upi: false,
        netbanking: false,
        wallet: false,
        emi: false,
        paylater: false,
      },
      config: {
        display: {
          // Hide all non-card methods from Razorpay UI
          hide: [
            { method: 'upi' },
            { method: 'netbanking' },
            { method: 'wallet' },
            { method: 'emi' },
            { method: 'paylater' },
          ],
          preferences: {
            show_default_blocks: false, // Hides "Recommended" section
          },
        },
      },
      theme: { color: '#000000', hide_topbar: false },
      modal: {
        backdropclose: false,
        escape: false,
        handleback: true,
        confirm_close: true,
      },
      notes: opts.notes || {},
    };

    await openRazorpayAndVerify(rzpOptions, orderId);
  };

  // ════════════════════════════════════════════════════════════════════
  // NETBANKING — Use Razorpay SDK with STRICT bank lock
  // ════════════════════════════════════════════════════════════════════

  const handleNetbankingPayment = async (
    orderId: string,
    keyId: string,
    amountPaise: number,
    opts: UseRazorpayOptions,
  ) => {
    const contact = cleanContact(opts.prefill?.contact);

    if (!opts.bankCode) {
      throw new Error('Please select a bank first.');
    }

    const rzpOptions: Record<string, any> = {
      key: keyId,
      amount: amountPaise,
      currency: opts.currency || 'INR',
      order_id: orderId,
      name: 'Zica Bella',
      description: 'Order Payment',
      prefill: {
        name: opts.prefill?.name || '',
        email: opts.prefill?.email || '',
        contact,
        // ── CRITICAL: Pre-select netbanking + specific bank ──
        method: 'netbanking',
        bank: opts.bankCode,
      },
      // ── CRITICAL: Disable ALL other payment methods ──
      method: {
        netbanking: true,
        card: false,
        upi: false,
        wallet: false,
        emi: false,
        paylater: false,
      },
      config: {
        display: {
          hide: [
            { method: 'upi' },
            { method: 'card' },
            { method: 'wallet' },
            { method: 'emi' },
            { method: 'paylater' },
          ],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      theme: { color: '#000000', hide_topbar: false },
      modal: {
        backdropclose: false,
        escape: false,
        handleback: true,
        confirm_close: true,
      },
      notes: opts.notes || {},
    };

    await openRazorpayAndVerify(rzpOptions, orderId);
  };

  // ════════════════════════════════════════════════════════════════════
  // WALLET — Use Razorpay SDK with STRICT wallet lock
  // ════════════════════════════════════════════════════════════════════

  const handleWalletPayment = async (
    orderId: string,
    keyId: string,
    amountPaise: number,
    opts: UseRazorpayOptions,
  ) => {
    const contact = cleanContact(opts.prefill?.contact);

    if (!opts.walletCode) {
      throw new Error('Please select a wallet first.');
    }

    const rzpOptions: Record<string, any> = {
      key: keyId,
      amount: amountPaise,
      currency: opts.currency || 'INR',
      order_id: orderId,
      name: 'Zica Bella',
      description: 'Order Payment',
      prefill: {
        name: opts.prefill?.name || '',
        email: opts.prefill?.email || '',
        contact,
        // ── CRITICAL: Pre-select wallet + specific wallet provider ──
        method: 'wallet',
        wallet: opts.walletCode,
      },
      // ── CRITICAL: Disable ALL other payment methods ──
      method: {
        wallet: true,
        netbanking: false,
        card: false,
        upi: false,
        emi: false,
        paylater: false,
      },
      config: {
        display: {
          hide: [
            { method: 'upi' },
            { method: 'card' },
            { method: 'netbanking' },
            { method: 'emi' },
            { method: 'paylater' },
          ],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      theme: { color: '#000000', hide_topbar: false },
      modal: {
        backdropclose: false,
        escape: false,
        handleback: true,
        confirm_close: true,
      },
      notes: opts.notes || {},
    };

    await openRazorpayAndVerify(rzpOptions, orderId);
  };

  // ════════════════════════════════════════════════════════════════════
  // SHARED: Open Razorpay SDK + Verify on backend
  // ════════════════════════════════════════════════════════════════════

  const openRazorpayAndVerify = async (
    rzpOptions: Record<string, any>,
    orderId: string,
  ) => {
    let paymentData: PaymentResult;

    try {
      console.log('[useRazorpay] Opening Razorpay SDK with method lock:', JSON.stringify(rzpOptions.method));
      paymentData = await RazorpayCheckout.open(rzpOptions);
    } catch (rzpErr: any) {
      // code === 2 means user cancelled — not a real error
      if (rzpErr?.code === 2) {
        setStatus('idle');
        return;
      }
      throw new Error(rzpErr?.description || 'Payment was not completed.');
    }

    if (abortRef.current) return;

    // Verify on backend
    setStatus('verifying');
    const apiBase = getPaymentApiBaseUrl();

    const verifyRes = await fetch(`${apiBase}/api/app/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      }),
    });

    const verifyJson = await verifyRes.json();

    if (!verifyJson.success) {
      throw new Error(verifyJson.error || 'Payment verification failed.');
    }

    setSuccessData({
      paymentId: paymentData.razorpay_payment_id,
      orderId: paymentData.razorpay_order_id,
    });
    setStatus('success');
  };

  return { status, error, successData, startPayment, reset, cancelUpiPolling };
}
