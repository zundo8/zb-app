export default ({ config }) => {
  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
    },
  };
};
