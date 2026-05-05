import RazorpayCheckout from 'react-native-razorpay';
import { Alert } from 'react-native';
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
 * Fetches the Razorpay Key ID from the server if not configured locally.
 */
async function getRazorpayKey(): Promise<string> {
  // Use local key if available and valid
  if (config.razorpay.keyId && config.razorpay.keyId.startsWith('rzp_') && !config.razorpay.keyId.includes('xxxx')) {
    return config.razorpay.keyId;
  }

  try {
    const res = await fetch(`${config.appUrl}/api/razorpay/config`, {
      headers: { 'Accept': 'application/json' }
    });
    
    // Check if response is HTML (starts with <) which causes JSON parse error
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Razorpay config API returned non-JSON response. Falling back to local config.');
      throw new Error('Invalid server response');
    }

    const data = await res.json();
    
    if (data.isConfigured && data.keyId) {
      return data.keyId;
    }
    
    throw new Error(data.error || 'Razorpay Key ID not configured on server');
  } catch (e) {
    console.warn('Failed to fetch Razorpay config from server:', e);
    
    // Final fallback attempt with local key if it looks valid
    if (config.razorpay.keyId && config.razorpay.keyId.startsWith('rzp_') && !config.razorpay.keyId.includes('xxxx')) {
      return config.razorpay.keyId;
    }
    
    throw new Error('Razorpay setup required. Please ensure RAZORPAY_KEY_ID is set in .env.local on the server.');
  }
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
  // Step 0: Resolve Public Key
  let razorpayKey = '';
  try {
    razorpayKey = await getRazorpayKey();
  } catch (e: any) {
    Alert.alert('Payment Setup Required', e.message);
    throw e;
  }

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
    const err = await orderRes.json().catch(() => ({ error: 'Order creation failed' }));
    throw new Error(err.error || 'Failed to create payment order');
  }

  const rzpOrder = await orderRes.json();

  // Step 2: Handle MOCK MODE for testing without real keys
  if (rzpOrder.mock) {
    console.warn('Proceeding with MOCK PAYMENT...');
    return new Promise((resolve) => {
      Alert.alert(
        'MOCK TRANSACTION',
        'Razorpay keys not set. Simulating a successful payment for testing purposes.',
        [{ text: 'Proceed', onPress: () => {
          resolve({
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_order_id: rzpOrder.id,
            razorpay_signature: 'mock_sig_valid'
          });
        }}]
      );
    });
  }

  // Step 3: Open Razorpay native checkout
  const options = {
    description: 'Zica Bella Order',
    image: 'https://app.zicabella.com/zb-logo-silver.png', 
    currency: rzpOrder.currency || 'INR',
    key: razorpayKey,
    amount: rzpOrder.amount.toString(),
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
    // Explicitly enable all methods and preferred UPI apps
    retry: {
      enabled: true,
      max_count: 4
    },
    config: {
      display: {
        blocks: {
          banks: {
            name: 'Most Used Methods',
            instruments: [
              { method: 'upi' },
              { method: 'card' },
              { method: 'wallet' }
            ],
          },
        },
        sequence: ['block.banks'],
        preferences: { show_default_blocks: true },
      },
    },
  };

  try {
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

    const verifyResult = await verifyRes.json().catch(() => ({ success: false }));

    if (!verifyResult.success) {
      throw new Error(verifyResult.error || 'Payment verification failed. Please contact support.');
    }

    return paymentData;
  } catch (error: any) {
    if (error?.code === 2) {
      throw new Error('Payment cancelled by user');
    }
    throw error;
  }
}
