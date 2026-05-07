import RazorpayCheckout from 'react-native-razorpay';
import { Alert } from 'react-native';
import { config } from '../constants/config';

/** Get a fresh auth token from zustand store at call time */
function getFreshAuthToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuthStore } = require('../store/authStore');
  return useAuthStore.getState().token || '';
}

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Fetches the Razorpay Key ID from the server if not configured locally.
 * Falls back to local config, then to server config.
 */
async function getRazorpayKey(): Promise<string> {
  // Use local key if available and valid
  if (config.razorpay.keyId && config.razorpay.keyId.startsWith('rzp_') && !config.razorpay.keyId.includes('xxxx')) {
    return config.razorpay.keyId;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(`${config.appUrl}/api/razorpay/config`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
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
    
    if (data.mockAllowed) {
       console.warn('Razorpay not configured on server. Mock mode enabled.');
       return 'rzp_test_MOCK_MODE_ACTIVE'; // Placeholder that won't trigger the regex failure
    }
    
    throw new Error(data.error || 'Razorpay Key ID not configured on server');
  } catch (e: any) {
    console.warn('Failed to fetch Razorpay config from server:', e?.message || e);
    
    // Final fallback attempt with local key if it looks valid
    if (config.razorpay.keyId && config.razorpay.keyId.startsWith('rzp_') && !config.razorpay.keyId.includes('xxxx')) {
      return config.razorpay.keyId;
    }
    
    throw new Error('Razorpay setup required. Please ensure RAZORPAY_KEY_ID is set in .env.local on the server.');
  }
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
  authToken: string
): Promise<any> {
  // Step 0: Resolve Public Key
  let razorpayKey = '';
  try {
    razorpayKey = await getRazorpayKey();
  } catch (e: any) {
    Alert.alert('Payment Setup Required', e.message);
    throw e;
  }

  // Step 1: Create Razorpay order on server
  let rzpOrder: any;
  let createOrderError: string | null = null;

  // Always use a fresh token from the store (not the stale one passed in)
  const freshToken = authToken || getFreshAuthToken();
  if (!freshToken) {
    throw new Error('Please log in to proceed with payment.');
  }

  // Try primary endpoint first
  try {
    const orderRes = await fetch(`${config.appUrl}/api/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Authorization: `Bearer ${freshToken}`,
      },
      body: JSON.stringify(orderData),
    });

    // Guard against HTML error pages
    const contentType = orderRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      createOrderError = `Server returned non-JSON response (${orderRes.status})`;
      console.warn('[Razorpay] Non-JSON response from create-order:', contentType);
    } else if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({ error: 'Order creation failed' }));
      createOrderError = err.error || 'Failed to create payment order';
    } else {
      rzpOrder = await orderRes.json();
    }
  } catch (e: any) {
    createOrderError = e.message || 'Network error creating order';
  }

  if (!rzpOrder) {
    throw new Error(createOrderError || 'Failed to create payment order');
  }

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
            razorpay_order_id: rzpOrder.id || rzpOrder.razorpay_order_id,
            razorpay_signature: 'mock_sig_valid'
          });
        }}]
      );
    });
  }

  // Step 3: Open Razorpay native checkout
  const orderId = rzpOrder.id || rzpOrder.razorpay_order_id;
  const orderAmount = rzpOrder.amount || Math.round((orderData.amount || orderData.total_price || 0) * 100);
  
  const options = {
    description: 'Zica Bella Order',
    image: 'https://app.zicabella.com/zb-logo-silver.png', 
    currency: rzpOrder.currency || 'INR',
    key: rzpOrder.key_id || rzpOrder.keyId || razorpayKey,
    amount: orderAmount.toString(),
    name: 'Zica Bella',
    order_id: orderId,
    prefill: {
      name: orderData.shipping_address?.first_name || '',
      email: orderData.email || '',
      contact: orderData.phone ? `+91${orderData.phone.replace(/^\+91/, '')}` : '',
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

  console.log('[Razorpay] Opening native checkout with options:', JSON.stringify(options, null, 2));

  try {
    const paymentData = await RazorpayCheckout.open(options) as PaymentResult;
    console.log('[Razorpay] Payment captured by native SDK:', JSON.stringify(paymentData, null, 2));

    // Step 4: Verify signature server-side
    try {
      const verifyToken = getFreshAuthToken(); // Re-fetch in case it refreshed
      const verifyRes = await fetch(`${config.appUrl}/api/razorpay/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${verifyToken}`,
        },
        body: JSON.stringify({
          ...paymentData,
          order_id: orderId // Add original order reference if needed
        }),
      });

      const verifyResult = await verifyRes.json().catch(() => ({ success: false }));

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Payment verification failed');
      }

      // Return the final verified order if returned, otherwise return payment data
      return verifyResult.order || verifyResult;
    } catch (verifyError: any) {
      console.error('[Razorpay] Verification API error:', verifyError);
      throw new Error(verifyError.message || 'Payment verification failed');
    }
  } catch (error: any) {
    if (error?.code === 2 || error?.code === 0) {
      throw new Error('Payment cancelled by user');
    }
    throw error;
  }
}
