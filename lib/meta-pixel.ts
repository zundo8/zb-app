export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "";

/**
 * Tracks a standard PageView event.
 */
export const pageview = () => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "PageView");
  } else if (process.env.NODE_ENV === "development") {
    console.log("[Meta Pixel DEBUG] PageView tracked");
  }
};

/**
 * Tracks custom or standard events.
 * @param name Event name (e.g. AddToCart, InitiateCheckout, Purchase, Search)
 * @param options Event payload (value, currency, content_ids, content_name, etc.)
 */
export const event = (name: string, options = {}) => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", name, options);
  } else if (process.env.NODE_ENV === "development") {
    console.log(`[Meta Pixel DEBUG] Event "${name}" tracked with payload:`, options);
  }
};
