export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID!;

export const pageview = () => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'PageView');
  }
};

type FbqEventName =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CompleteRegistration'
  | 'Contact'
  | 'FindLocation'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'Subscribe'
  | 'ViewContent';

export const trackEvent = (
  eventName: FbqEventName,
  params: Record<string, any> = {},
  eventId?: string
) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, params, eventId ? { eventID: eventId } : {});
  }
};
