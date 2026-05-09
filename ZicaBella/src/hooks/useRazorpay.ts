import { useState, useCallback, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl, config } from '../constants/config';
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

        // ── Step 2: Open Razorpay checkout SDK ──
        setStatus('processing');

        // Clean phone number — remove country code prefix
        const cleanContact = (opts.prefill?.contact || '')
          .replace(/\D/g, '')
          .slice(-10);

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
            contact: cleanContact,
          },
          method: {
            upi: method === 'upi',
            card: method === 'card',
            netbanking: method === 'netbanking',
            wallet: method === 'wallet',
          },
          theme: { color: '#000000' },
          modal: { backdropclose: false },
          notes: opts.notes || {},
        };

        let paymentData: PaymentResult;
        try {
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

        // ── Step 3: Verify on backend ──
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
          throw new Error(verifyJson.error || 'Payment verification failed.');
        }

        setSuccessData({
          paymentId: paymentData.razorpay_payment_id,
          orderId: paymentData.razorpay_order_id,
        });
        setStatus('success');
      } catch (err: any) {
        if (!abortRef.current) {
          setError(err.message || 'Payment failed. Please try again.');
          setStatus('failed');
        }
      }
    },
    [],
  );

  return { status, error, successData, startPayment, reset };
}
