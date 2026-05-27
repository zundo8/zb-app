/**
 * Razorpay wallet codes for Wallet payments.
 * Key: Display name, Value: Razorpay wallet code.
 * Reference: https://razorpay.com/docs/payments/payment-methods/wallets/
 */
export const WALLET_CODES: Record<string, string> = {
  'Paytm': 'paytm',
  'PhonePe': 'phonepe',
  'Amazon Pay': 'amazonpay',
  'Mobikwik': 'mobikwik',
  'Freecharge': 'freecharge',
};

/** Wallets shown in the quick-select grid */
export const WALLETS = [
  { id: 'paytm', name: 'Paytm', icon: 'https://cdn.razorpay.com/app/paytm.png', scheme: 'paytmmp://' },
  { id: 'phonepe', name: 'PhonePe', icon: 'https://cdn.razorpay.com/app/phonepe.png', scheme: 'phonepe://' },
  { id: 'amazonpay', name: 'Amazon Pay', icon: 'https://cdn.razorpay.com/app/amazon_pay.png', scheme: 'amazonpay://' },
  { id: 'mobikwik', name: 'Mobikwik', icon: 'https://cdn.razorpay.com/app/mobikwik.png', scheme: 'mobikwik://' },
  { id: 'freecharge', name: 'Freecharge', icon: 'https://cdn.razorpay.com/app/freecharge.png', scheme: 'freecharge://' },
];
