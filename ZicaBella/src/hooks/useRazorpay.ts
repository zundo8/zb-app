import { useState, useCallback, useRef, useEffect } from 'react';
import { Linking, AppState, AppStateStatus } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { checkOrderStatus, processPaymentHeadless } from '../api/payment';

// ── Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'processing'
  | 'awaiting_confirmation' // ← Waiting for S2S payment completion
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
  upiId?: string;               // For UPI VPA payments
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
}

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
    return () => stopPolling();
  }, []);

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

  // ── AppState listener: detect return from UPI/Bank app ──
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (
        nextState === 'active' &&
        status === 'awaiting_confirmation' &&
        currentOrderIdRef.current
      ) {
        console.log('[useRazorpay] App active, polling status...');
        pollOnce(currentOrderIdRef.current);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [status]);

  const pollOnce = useCallback(async (orderId: string) => {
    try {
      const result = await checkOrderStatus(orderId);
      if (result.status === 'paid') {
        stopPolling();
        setSuccessData({
          paymentId: result.paymentId || 's2s_payment',
          orderId,
        });
        setStatus('success');
        return true;
      }
    } catch (e) {
      console.log('[useRazorpay] Poll error:', e);
    }
    return false;
  }, [stopPolling]);

  const startPolling = useCallback((orderId: string) => {
    currentOrderIdRef.current = orderId;
    setStatus('awaiting_confirmation');

    pollIntervalRef.current = setInterval(() => pollOnce(orderId), 3000);

    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      if (status === 'awaiting_confirmation') {
        setError('Payment confirmation timed out. Check your payment app.');
        setStatus('failed');
      }
    }, 300000); // 5 mins
  }, [pollOnce, stopPolling, status]);

  const reset = useCallback(() => {
    abortRef.current = false;
    stopPolling();
    setStatus('idle');
    setError(null);
    setSuccessData(null);
  }, [stopPolling]);

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
          throw new Error('Invalid server response.');
        }

        if (!orderRes.ok || !orderJson.order_id) {
          throw new Error(orderJson.error || 'Failed to create payment order.');
        }

        const orderId = orderJson.order_id;
        const keyId = orderJson.key_id;

        if (abortRef.current) return;

        // ── Step 2: Handle based on method ──
        setStatus('processing');

        if (method === 'card') {
          // ════════════════════════════════════════════════════════════
          // CARD — Use SDK (PCI compliance)
          // ════════════════════════════════════════════════════════════
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
              contact: cleanContact(opts.prefill?.contact),
              method: 'card',
              ...(opts.cardNumber ? { 'card[number]': opts.cardNumber.replace(/\s/g, '') } : {}),
              ...(opts.cardExpiry ? { 'card[expiry]': opts.cardExpiry } : {}),
              ...(opts.cardCvv ? { 'card[cvv]': opts.cardCvv } : {}),
            },
            method: { card: true, upi: false, netbanking: false, wallet: false },
            config: {
              display: {
                hide: [{ method: 'upi' }, { method: 'netbanking' }, { method: 'wallet' }],
              },
            },
            theme: { color: '#000000' },
            modal: { backdropclose: false, confirm_close: true },
          };

          const paymentData = await RazorpayCheckout.open(rzpOptions);
          
          setStatus('verifying');
          const verifyRes = await fetch(`${apiBase}/api/app/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: paymentData.razorpay_order_id,
              razorpay_payment_id: paymentData.razorpay_payment_id,
              razorpay_signature: paymentData.razorpay_signature,
            }),
          });

          const verifyJson = await verifyRes.json();
          if (!verifyJson.success) throw new Error(verifyJson.error || 'Verification failed');

          setSuccessData({ paymentId: paymentData.razorpay_payment_id, orderId: orderId });
          setStatus('success');
        } else {
          // ════════════════════════════════════════════════════════════
          // UPI, NETBANKING, WALLET — Use Backend S2S (Headless)
          // ════════════════════════════════════════════════════════════
          const processRes = await processPaymentHeadless({
            order_id: orderId,
            amount: amountPaise,
            method: method,
            vpa: opts.upiId,
            bank: opts.bankCode,
            wallet: opts.walletCode,
            email: opts.prefill?.email,
            contact: cleanContact(opts.prefill?.contact),
            name: opts.prefill?.name,
          });

          // If Razorpay requires a redirect (Netbanking/Wallets)
          if (processRes.next?.action === 'redirect' && processRes.next?.url) {
            await Linking.openURL(processRes.next.url);
          }

          // Start polling for payment capture
          startPolling(orderId);
        }
      } catch (err: any) {
        if (!abortRef.current) {
          setError(err.message || 'Payment failed.');
          setStatus('failed');
        }
      }
    },
    [startPolling],
  );

  return { status, error, successData, startPayment, reset };
}
