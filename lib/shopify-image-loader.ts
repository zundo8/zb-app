export default function shopifyImageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (!src) return '';
  
  // Return relative paths and data URLs as-is
  if (src.startsWith('/') || src.startsWith('data:')) {
    return src;
  }

  try {
    const url = new URL(src);
    const host = url.hostname;

    // Shopify CDN natively supports query parameter resizing
    if (host.includes('cdn.shopify.com') || host.includes('myshopify.com')) {
      url.searchParams.set('width', width.toString());
      // Shopify supports 'quality' query parameter (e.g. 1-100 or progressive format)
      // Standardizing on '80' quality for an excellent balance of fidelity and size
      url.searchParams.set('quality', (quality || 80).toString());
      return url.toString();
    }

    // Unsplash supports native width and quality queries
    if (host.includes('images.unsplash.com')) {
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', (quality || 80).toString());
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      return url.toString();
    }
  } catch (e) {
    // If invalid URL, fall back to the original src
  }

  return src;
}
