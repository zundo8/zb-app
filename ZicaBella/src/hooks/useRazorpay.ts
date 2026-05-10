import { useState, useCallback, useRef, useEffect } from 'react';
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

        // ── Step 2: Build method-specific Razorpay options ──
        setStatus('processing');

        const contact = cleanContact(opts.prefill?.contact);
        const basePrefill = {
          name: opts.prefill?.name || '',
          email: opts.prefill?.email || '',
          contact,
        };

        let rzpOptions: Record<string, any>;

        switch (method) {
          // ════════════════════════════════════════════════════════════
          // UPI — Razorpay SDK with strict UPI-only lock
          // The SDK handles UPI intent/collect internally on both iOS+Android
          // ════════════════════════════════════════════════════════════
          case 'upi': {
            rzpOptions = {
              key: keyId,
              amount: amountPaise,
              currency: opts.currency || 'INR',
              order_id: orderId,
              name: 'Zica Bella',
              description: 'Order Payment',
              prefill: {
                ...basePrefill,
                method: 'upi',
                // Pre-fill VPA if user typed one
                ...(opts.upiId ? { vpa: opts.upiId } : {}),
              },
              // CRITICAL: Only allow UPI, disable everything else
              method: {
                upi: true,
                card: false,
                netbanking: false,
                wallet: false,
                emi: false,
                paylater: false,
              },
              config: {
                display: {
                  hide: [
                    { method: 'card' },
                    { method: 'netbanking' },
                    { method: 'wallet' },
                    { method: 'emi' },
                    { method: 'paylater' },
                  ],
                  preferences: {
                    show_default_blocks: false,
                  },
                },
              },
              theme: { color: '#000000' },
              modal: { backdropclose: false, confirm_close: true },
              notes: opts.notes || {},
            };
            break;
          }

          // ════════════════════════════════════════════════════════════
          // CARD — Razorpay SDK with strict card-only lock
          // ════════════════════════════════════════════════════════════
          case 'card': {
            rzpOptions = {
              key: keyId,
              amount: amountPaise,
              currency: opts.currency || 'INR',
              order_id: orderId,
              name: 'Zica Bella',
              description: 'Order Payment',
              prefill: {
                ...basePrefill,
                name: opts.cardName || basePrefill.name,
                method: 'card',
                ...(opts.cardNumber ? { 'card[number]': opts.cardNumber.replace(/\s/g, '') } : {}),
                ...(opts.cardExpiry ? { 'card[expiry]': opts.cardExpiry } : {}),
                ...(opts.cardCvv ? { 'card[cvv]': opts.cardCvv } : {}),
                ...(opts.cardName ? { 'card[name]': opts.cardName } : {}),
              },
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
                  hide: [
                    { method: 'upi' },
                    { method: 'netbanking' },
                    { method: 'wallet' },
                    { method: 'emi' },
                    { method: 'paylater' },
                  ],
                  preferences: { show_default_blocks: false },
                },
              },
              theme: { color: '#000000' },
              modal: { backdropclose: false, confirm_close: true },
              notes: opts.notes || {},
            };
            break;
          }

          // ════════════════════════════════════════════════════════════
          // NETBANKING — Razorpay SDK with strict bank lock
          // ════════════════════════════════════════════════════════════
          case 'netbanking': {
            if (!opts.bankCode) throw new Error('Please select a bank first.');
            rzpOptions = {
              key: keyId,
              amount: amountPaise,
              currency: opts.currency || 'INR',
              order_id: orderId,
              name: 'Zica Bella',
              description: 'Order Payment',
              prefill: {
                ...basePrefill,
                method: 'netbanking',
                bank: opts.bankCode,
              },
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
                  preferences: { show_default_blocks: false },
                },
              },
              theme: { color: '#000000' },
              modal: { backdropclose: false, confirm_close: true },
              notes: opts.notes || {},
            };
            break;
          }

          // ════════════════════════════════════════════════════════════
          // WALLET — Razorpay SDK with strict wallet lock
          // ════════════════════════════════════════════════════════════
          case 'wallet': {
            if (!opts.walletCode) throw new Error('Please select a wallet first.');
            rzpOptions = {
              key: keyId,
              amount: amountPaise,
              currency: opts.currency || 'INR',
              order_id: orderId,
              name: 'Zica Bella',
              description: 'Order Payment',
              prefill: {
                ...basePrefill,
                method: 'wallet',
                wallet: opts.walletCode,
              },
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
                  preferences: { show_default_blocks: false },
                },
              },
              theme: { color: '#000000' },
              modal: { backdropclose: false, confirm_close: true },
              notes: opts.notes || {},
            };
            break;
          }

          default:
            throw new Error('Unsupported payment method.');
        }

        // ── Step 3: Open Razorpay SDK ──
        let paymentData: PaymentResult;
        try {
          console.log('[useRazorpay] Opening Razorpay SDK | method:', method, '| locks:', JSON.stringify(rzpOptions.method));
          paymentData = await RazorpayCheckout.open(rzpOptions);
        } catch (rzpErr: any) {
          // code === 2 means user cancelled
          if (rzpErr?.code === 2) {
            setStatus('idle');
            return;
          }
          throw new Error(rzpErr?.description || 'Payment was not completed.');
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
