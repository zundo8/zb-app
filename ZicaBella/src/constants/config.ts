export const BACKEND_BASE_URL = 'https://app.zicabella.com';
export const config = {
  appUrl: process.env.EXPO_PUBLIC_APP_URL || BACKEND_BASE_URL,
  /** Store / marketing contact page (matches web footer). */
  contactPage: 'https://www.zicabella.com/policies/contact-information',
  heroVideoUrl: 'https://app.zicabella.com/zb-video-heroo.mp4',
  razorpay: {
    keyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',
  },
  policies: {
    privacy: 'https://www.zicabella.com/policies/privacy-policy',
    refund: 'https://www.zicabella.com/policies/refund-policy',
    shipping: 'https://www.zicabella.com/policies/shipping-policy',
    terms: 'https://www.zicabella.com/policies/terms-of-service',
  },
  trending: ['T-shirt', 'Jeans', 'Pants', 'Trousers', 'Jorts', 'Shirts', 'Acid Tees', 'Leather'],
};
