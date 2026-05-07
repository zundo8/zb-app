export const config = {
  appUrl: process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com',
  /** Store / marketing contact page (matches web footer). */
  contactPage: 'https://www.zicabella.com/policies/contact-information',
  heroVideoUrl: 'https://app.zicabella.com/zb-video-heroo.mp4',
  razorpay: {
    keyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',
  },
  policies: {
    privacy: 'https://8tiahf-bk.myshopify.com/policies/privacy-policy',
    refund: 'https://8tiahf-bk.myshopify.com/policies/refund-policy',
    shipping: 'https://8tiahf-bk.myshopify.com/policies/shipping-policy',
    terms: 'https://8tiahf-bk.myshopify.com/policies/terms-of-service',
  },
  trending: ['T-shirt', 'Jeans', 'Pants', 'Trousers', 'Jorts', 'Shirts', 'Acid Tees', 'Leather'],
};
