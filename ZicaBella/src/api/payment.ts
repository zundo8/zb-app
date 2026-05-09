/**
 * Typed payment API client for Razorpay integration.
 * Uses the same fetch pattern as api/shopify.ts (no Axios).
 */
import { getPaymentApiBaseUrl, config } from '../constants/config';
import { useAuthStore } from '../store/authStore';

// ── Request / Response Types ────────────────────────────────────────

export interface CreateOrderRequest {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  payment_id?: string;
  error?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  notes?: Record<string, string>;
}

export interface RefundResponse {
  id: string;
  amount: number;
  status: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function paymentFetch<T>(
  endpoint: string,
  body: any,
): Promise<T> {
  const apiBase = getPaymentApiBaseUrl();
  const token = useAuthStore.getState().token || '';

  const res = await fetch(`${apiBase}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server.');
  }
  if (!res.ok) {
    throw new Error(json.error || 'Request failed');
  }
  return json as T;
}

// ── Public API ──────────────────────────────────────────────────────

export async function createRazorpayOrder(
  amount: number,
  receipt?: string,
  notes?: Record<string, string>,
): Promise<CreateOrderResponse> {
  return paymentFetch<CreateOrderResponse>('/api/app/payment/create-order', {
    amount,
    currency: 'INR',
    receipt: receipt || `zb_${Date.now()}`,
    notes,
  });
}

export async function verifyRazorpayPayment(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<VerifyPaymentResponse> {
  return paymentFetch<VerifyPaymentResponse>('/api/app/payment/verify', {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });
}

export async function requestRefund(
  paymentId: string,
  amount?: number,
): Promise<RefundResponse> {
  return paymentFetch<RefundResponse>('/api/razorpay/refund', {
    paymentId,
    amount,
  });
}
