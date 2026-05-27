export default ({ config }) => {
  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      eas: {
        ...(config.extra?.eas || {}),
      },
      razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
    },
  };
};
