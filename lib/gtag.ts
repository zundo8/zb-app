export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Log page views via dataLayer push for GTM processing
export const pageview = (url: string) => {
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: 'page_view',
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
};

// Log specific events via gtag / dataLayer
export const event = (action: string, params: Record<string, any> = {}) => {
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', action, params);
    } else {
      (window as any).dataLayer.push({
        event: action,
        ...params,
      });
    }
  }
};

