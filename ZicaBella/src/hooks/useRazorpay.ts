import { useState, useCallback, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl } from '../constants/config';
import { useAuthStore } from '../store/authStore';

// ── Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'processing'
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
          throw new Error('Server error: Invalid response format');
        }

        if (!orderRes.ok || !orderJson.order_id) {
          throw new Error(orderJson.error || 'Failed to create payment order');
        }

        const orderId = orderJson.order_id;
        const keyId = orderJson.key_id;

        if (abortRef.current) return;

        // ── Step 2: Build Razorpay options with STRICT method selection ──
        setStatus('processing');

        const contact = cleanContact(opts.prefill?.contact);
        
        // Define which methods to HIDE based on selected tab
        const allMethods = ['card', 'upi', 'netbanking', 'wallet', 'emi', 'paylater'];
        const hideMethods = allMethods.filter(m => m !== method).map(m => ({ method: m }));

        const rzpOptions: any = {
          key: keyId,
          amount: amountPaise,
          currency: opts.currency || 'INR',
          order_id: orderId,
          name: 'Zica Bella',
          description: 'Order Payment',
          prefill: {
            name: opts.cardName || opts.prefill?.name || '',
            email: opts.prefill?.email || '',
            contact: contact,
            method: method, // ← Tells Razorpay which tab to open
          },
          // ── Force the specific method ──
          method: {
            [method]: true,
            card: method === 'card',
            upi: method === 'upi',
            netbanking: method === 'netbanking',
            wallet: method === 'wallet',
          },
          config: {
            display: {
              hide: hideMethods,
              preferences: {
                show_default_blocks: false,
              },
            },
          },
          theme: { color: '#000000' },
          modal: {
            backdropclose: false,
            confirm_close: true,
          },
          notes: opts.notes || {},
        };

        // ── Method-specific pre-fills ──
        if (method === 'upi') {
          if (opts.upiId) {
            rzpOptions.prefill.vpa = opts.upiId;
          } else if (opts.upiApp) {
            const upiAppMap: Record<string, string> = {
              gpay: 'google_pay',
              phonepe: 'phonepe',
              paytm: 'paytm',
            };
            if (upiAppMap[opts.upiApp]) {
              rzpOptions.prefill.vpa = upiAppMap[opts.upiApp];
            }
          }
        } else if (method === 'card') {
          if (opts.cardNumber) rzpOptions['card[number]'] = opts.cardNumber.replace(/\s/g, '');
          if (opts.cardExpiry) rzpOptions['card[expiry]'] = opts.cardExpiry;
          if (opts.cardCvv) rzpOptions['card[cvv]'] = opts.cardCvv;
          if (opts.cardName) rzpOptions['card[name]'] = opts.cardName;
        } else if (method === 'netbanking') {
          if (opts.bankCode) rzpOptions.prefill.bank = opts.bankCode;
        } else if (method === 'wallet') {
          if (opts.walletCode) rzpOptions.prefill.wallet = opts.walletCode;
        }

        // ── Step 3: Open Razorpay SDK ──
        let paymentData: PaymentResult;
        try {
          console.log('[useRazorpay] Opening SDK for method:', method);
          paymentData = await RazorpayCheckout.open(rzpOptions);
        } catch (rzpErr: any) {
          console.log('[useRazorpay] SDK Error:', rzpErr);
          // code 2 is user cancelled
          if (rzpErr?.code === 2) {
            setStatus('idle');
            return;
          }
          throw new Error(rzpErr?.description || 'Payment was cancelled or failed');
        }

        if (abortRef.current) return;

        // ── Step 4: Verify on backend ──
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

        const verifyJson = await verifyRes.json();
        if (!verifyJson.success) {
          throw new Error(verifyJson.error || 'Payment verification failed');
        }

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
