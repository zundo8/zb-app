import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, Linking, AppState, AppStateStatus } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { checkOrderStatus } from '../api/payment';

// ── Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'processing'
  | 'waiting_capture' // For headless UPI
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
  // Pre-created order fields (from OrderReviewScreen)
  orderId?: string;       // Razorpay order_id already created
  razorpayKeyId?: string; // Key used to create the order
  // ── Method-specific fields ──
  upiId?: string;               // For UPI VPA payments
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
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useRazorpay(): UseRazorpayReturn {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = false;
    setStatus('idle');
    setError(null);
    setSuccessData(null);
  }, []);

  const cleanContact = (phone?: string) =>
    (phone || '').replace(/\D/g, '').slice(-10);

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

        // ── Step 2: Decide Flow (Headless S2S vs Native SDK) ──
        const contact = cleanContact(opts.prefill?.contact);
        
        // Headless for UPI (GPay, PhonePe, Paytm) to bypass Razorpay UI
        if (method === 'upi' && opts.upiApp) {
          setStatus('processing');
          try {
            const processRes = await fetch(`${apiBase}/api/app/payment/process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify({
                order_id: orderId,
                amount: amountPaise,
                method: 'upi',
                upi_app: opts.upiApp,
                email: opts.prefill?.email || 'support@zicabella.com',
                contact: contact ? `+91${contact}` : '9999999999',
                name: opts.prefill?.name || 'Zica Customer',
              }),
            });

            const processJson = await processRes.json();
            if (!processRes.ok) {
              throw new Error(processJson.error || 'Failed to initiate payment');
            }

            // The link is returned in 'vpa' or 'next.url'
            const upiLink = processJson.vpa || processJson.next?.url;
            if (!upiLink) {
              throw new Error('No payment link returned from server');
            }

            console.log('[useRazorpay] Opening Direct UPI Link:', upiLink);
            const supported = await Linking.canOpenURL(upiLink);
            if (!supported) {
              throw new Error(`Your device cannot open the ${opts.upiApp} app link`);
            }

            await Linking.openURL(upiLink);
            setStatus('waiting_capture');
            startPolling(orderId!);
            return; // Success handled by polling
          } catch (headlessErr: any) {
            console.error('[useRazorpay] S2S Error:', headlessErr.message);
            throw headlessErr;
          }
        }

        // Standard SDK Flow (For Cards and fallbacks)
        setStatus('processing');
        const rzpOptions: Record<string, any> = {
          key: keyId,
          amount: String(amountPaise),
          currency: opts.currency || 'INR',
          order_id: orderId,
          name: 'Zica Bella',
          description: 'Order Payment',
          image: 'https://app.zicabella.com/zb-logo-silver.png',
          method: method,
          prefill: {
            name: opts.cardName || opts.prefill?.name || 'Zica Customer',
            email: opts.prefill?.email || 'support@zicabella.com',
            contact: contact ? `+91${contact}` : '+918000000000',
            method: method,
          },
          config: {
            display: {
              hide: ['card', 'netbanking', 'wallet', 'upi']
                .filter(m => m !== method)
                .map(m => ({ method: m })),
              preferences: { show_default_blocks: false }
            }
          },
          theme: { color: '#000000' },
          modal: { backdropclose: false, confirm_close: true },
          retry: { enabled: true, max_count: 4 },
          notes: opts.notes || {},
        };

        // ── Method-specific pre-fills ──
        if (method === 'upi') {
          if (opts.upiId) {
            rzpOptions.prefill.vpa = opts.upiId;
          }
          // Direct App Intent support
          if (opts.upiApp) {
             let upiApp = opts.upiApp;
             if (Platform.OS === 'android') {
               if (upiApp === 'gpay') upiApp = 'com.google.android.apps.nbu.paisa.user';
               else if (upiApp === 'phonepe') upiApp = 'com.phonepe.app';
               else if (upiApp === 'paytm') upiApp = 'net.one97.paytm';
             }
             // @ts-ignore
             rzpOptions.prefill.upi_app = upiApp;
          }
        } else if (method === 'netbanking' && opts.bankCode) {
          rzpOptions.prefill.bank = opts.bankCode;
        } else if (method === 'wallet' && opts.walletCode) {
          rzpOptions.prefill.wallet = opts.walletCode;
        }

        // ── Step 3: Open Razorpay Native SDK Checkout ──
        let paymentData: PaymentResult;
        try {
          console.log('[useRazorpay] Opening SDK with options:', {
            ...rzpOptions,
            key: rzpOptions.key?.slice(0, 10) + '...',
          });
          paymentData = await RazorpayCheckout.open(rzpOptions);
          console.log('[useRazorpay] SDK Success:', {
            payment_id: paymentData.razorpay_payment_id,
            order_id: paymentData.razorpay_order_id,
          });
        } catch (rzpErr: any) {
          console.log('[useRazorpay] SDK Error:', JSON.stringify(rzpErr));
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
    [],
  );

  return { status, error, successData, startPayment, reset };
}
