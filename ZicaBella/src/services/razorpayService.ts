import RazorpayCheckout from 'react-native-razorpay';
import { getPaymentApiBaseUrl } from '../constants/config';

async function readJsonResponse(res: Response): Promise<{ ok: boolean; status: number; data: Record<string, any>; raw: string }> {
  const raw = await res.text();
  let data: Record<string, any> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.slice(0, 280) || `HTTP ${res.status}` };
  }
  return { ok: res.ok, status: res.status, data, raw };
}

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}


/**
 * Full Razorpay checkout flow:
 * 1. Creates server-side order (tries /api/razorpay/create-order first, then /api/checkout/razorpay)
 * 2. Opens Razorpay native checkout (all payment methods)
 * 3. Verifies payment signature server-side
 * Returns PaymentResult on success, throws on failure or user cancel
 */
export async function openRazorpayCheckout(
  orderData: any,
  _authToken: string
): Promise<any> {
  const amountInRupees = Number(orderData.amount || orderData.total || orderData.total_price || 0);
  if (!amountInRupees || amountInRupees <= 0) {
    throw new Error('Invalid payment amount');
  }

  const apiBase = getPaymentApiBaseUrl();

  // Step 1: Create order on backend
  const orderRes = await fetch(`${apiBase}/api/payment/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInRupees,
      currency: orderData.currency || 'INR',
      receipt: `zb_${Date.now()}`,
    }),
  });

  const orderParsed = await readJsonResponse(orderRes);
  const orderJson = orderParsed.data;
  if (!orderParsed.ok || !orderJson.order_id) {
    const detail =
      (orderJson.error as string) ||
      (orderJson.message as string) ||
      (orderParsed.raw ? `Server HTTP ${orderParsed.status}` : 'Failed to create payment order');
    throw new Error(detail);
  }

  // Must match the key used on the server to create the order (avoids "Authentication failed")
  const razorpayKeyId = orderJson.key_id as string | undefined;
  if (!razorpayKeyId || !String(razorpayKeyId).startsWith('rzp_')) {
    throw new Error(
      'Invalid Razorpay response: missing key_id. Save Razorpay keys in Admin → Settings → Payment Gateways and redeploy.'
    );
  }

  // Step 3: Open Razorpay native checkout (UPI, cards, wallets shown here)
  const options = {
    description: 'Zica Bella Order',
    image: 'https://app.zicabella.com/zb-logo-silver.png', 
    currency: orderJson.currency || 'INR',
    key: razorpayKeyId,
    amount: String(orderJson.amount),
    name: 'Zica Bella',
    order_id: orderJson.order_id,
    prefill: {
      name: orderData.shipping_address?.name || orderData.shipping_address?.first_name || '',
      email: orderData.email || '',
      contact: orderData.phone ? String(orderData.phone).replace(/^\+91/, '') : '',
    },
    theme: { color: '#000000' },
    modal: {
      confirm_close: true,
      backdropclose: false,
    },
    retry: {
      enabled: true,
      max_count: 4
    },
  };

  try {
    const paymentData = await RazorpayCheckout.open(options) as PaymentResult;

    // Step 4: Verify signature server-side
    const verifyRes = await fetch(`${apiBase}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      }),
    });

    const verifyParsed = await readJsonResponse(verifyRes);
    const verifyResult = verifyParsed.data;
    if (!verifyParsed.ok || !verifyResult.success) {
      throw new Error((verifyResult.error as string) || `Payment verification failed (${verifyParsed.status})`);
    }

    return paymentData;
  } catch (error: any) {
    if (error?.code === 2 || error?.code === 0) {
      throw new Error('Payment cancelled by user');
    }
    throw error;
  }
}
