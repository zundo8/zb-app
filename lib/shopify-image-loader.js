export default function shopifyImageLoader({ src, width, quality }) {
  if (!src) return '';
  
  if (src.startsWith('/') || src.startsWith('data:')) {
    return src;
  }

  try {
    const url = new URL(src);
    const host = url.hostname;

    if (host.includes('cdn.shopify.com') || host.includes('myshopify.com')) {
      url.searchParams.set('width', width.toString());
      url.searchParams.set('quality', (quality || 80).toString());
      return url.toString();
    }

    if (host.includes('images.unsplash.com')) {
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', (quality || 80).toString());
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      return url.toString();
    }

    if (host.includes('supabase.co')) {
      if (url.pathname.includes('/storage/v1/object/public/')) {
        url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        url.searchParams.set('width', width.toString());
        url.searchParams.set('quality', (quality || 80).toString());
        return url.toString();
      }
    }
  } catch (e) {
    // Return original src if parsing fails
  }

  return src;
}

