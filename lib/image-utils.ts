/**
 * Image utility functions for progressive loading and Shopify CDN optimization.
 * Used across the webstore for consistent blur placeholders and image URL transformations.
 */

// 1×1 transparent gray pixel — universal blur placeholder fallback
const BLUR_FALLBACK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3KFb5QAAAABJRU5ErkJggg==";

/**
 * Generate a low-quality blur data URL from a Shopify CDN image source.
 * Returns a tiny (20px wide) version suitable for `blurDataURL` in next/image.
 */
export function getBlurDataUrl(src: string): string {
  if (!src || src.startsWith("/") || src.startsWith("data:")) return BLUR_FALLBACK;
  try {
    const u = new URL(src);
    u.searchParams.set("width", "20");
    u.searchParams.set("quality", "10");
    return u.toString();
  } catch {
    return BLUR_FALLBACK;
  }
}

/**
 * Append Shopify CDN optimization parameters to an image URL.
 * @param src - Original Shopify CDN image URL
 * @param width - Desired width (e.g. 400 for low-res, 800 for medium)
 * @returns Optimized URL string
 */
export function getShopifyCdnUrl(src: string, width: number = 400): string {
  if (!src || src.startsWith("/") || src.startsWith("data:")) return src;
  try {
    const u = new URL(src);
    if (u.hostname.includes("cdn.shopify.com") || u.hostname.includes("myshopify.com")) {
      u.searchParams.set("width", width.toString());
      u.searchParams.set("quality", "80");
    }
    return u.toString();
  } catch {
    return src;
  }
}

export { BLUR_FALLBACK };
