/**
 * Razorpay bank codes for Netbanking payments.
 * Key: Display name, Value: Razorpay bank code.
 * Reference: https://razorpay.com/docs/payments/payment-methods/netbanking/
 */
export const BANK_CODES: Record<string, string> = {
  'State Bank of India': 'SBIN',
  'HDFC Bank': 'HDFC',
  'ICICI Bank': 'ICIC',
  'Axis Bank': 'UTIB',
  'Kotak Mahindra': 'KKBK',
  'Yes Bank': 'YESB',
  'IndusInd Bank': 'INDB',
  'Punjab National Bank': 'PUNB',
  'Bank of Baroda': 'BARB',
  'Canara Bank': 'CNRB',
};

/** Top banks shown in the quick-select grid */
export const TOP_BANKS = [
  { code: 'SBIN', name: 'SBI', icon: 'https://cdn.razorpay.com/bank/SBIN.gif' },
  { code: 'HDFC', name: 'HDFC', icon: 'https://cdn.razorpay.com/bank/HDFC.gif' },
  { code: 'ICIC', name: 'ICICI', icon: 'https://cdn.razorpay.com/bank/ICIC.gif' },
  { code: 'UTIB', name: 'Axis', icon: 'https://cdn.razorpay.com/bank/UTIB.gif' },
  { code: 'KKBK', name: 'Kotak', icon: 'https://cdn.razorpay.com/bank/KKBK.gif' },
];
