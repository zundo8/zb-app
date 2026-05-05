import RazorpayCheckout from 'react-native-razorpay';
import { config } from '../constants/config';

interface OrderPayload {
  amount: number;      // in rupees e.g. 999.00
  currency?: string;
  receipt?: string;
}

interface UserInfo {
  name?: string;
  email?: string;
  phone?: string;
}

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Full Razorpay checkout flow:
 * 1. Creates server-side order
 * 2. Opens Razorpay native checkout (all payment methods)
 * 3. Verifies payment signature server-side
 * Returns PaymentResult on success, throws on failure or user cancel
 */
export async function openRazorpayCheckout(
  orderPayload: OrderPayload,
  userInfo: UserInfo,
  authToken: string
): Promise<PaymentResult> {
  // Step 1: Create Razorpay order on server
  const orderRes = await fetch(`${config.appUrl}/api/razorpay/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      amount: orderPayload.amount,
      currency: orderPayload.currency || 'INR',
      receipt: orderPayload.receipt || `rcpt_${Date.now()}`,
    }),
  });

  if (!orderRes.ok) {
    const err = await orderRes.json();
    throw new Error(err.error || 'Failed to create payment order');
  }

  const rzpOrder = await orderRes.json();

  // Step 2: Open Razorpay native checkout — all payment methods enabled by default
  const options = {
    description: 'Zica Bella Order',
    image: 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb',
    currency: rzpOrder.currency || 'INR',
    key: config.razorpay.keyId,  // rzp_test_xxx or rzp_live_xxx
    amount: rzpOrder.amount.toString(),  // in paise, as string
    name: 'Zica Bella',
    order_id: rzpOrder.id,
    prefill: {
      name: userInfo.name || '',
      email: userInfo.email || '',
      contact: userInfo.phone ? `+91${userInfo.phone.replace(/^\+91/, '')}` : '',
    },
    theme: { color: '#000000' },
    modal: {
      confirm_close: true,
      backdropclose: false,
    },
  };

  // RazorpayCheckout.open returns a Promise
  const paymentData = await RazorpayCheckout.open(options) as PaymentResult;

  // Step 3: Verify signature server-side
  const verifyRes = await fetch(`${config.appUrl}/api/razorpay/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(paymentData),
  });

  const verifyResult = await verifyRes.json();

  if (!verifyResult.success) {
    throw new Error('Payment verification failed. Please contact support.');
  }

  return paymentData;
}
