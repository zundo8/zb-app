/**
 * /feed.csv — Google/Meta-format CSV product feed
 *
 * Companion to /feed.xml. Same data source (Shopify Admin API) and the SAME
 * per-variant field logic, emitted as an RFC-4180 CSV that Meta Commerce
 * Manager, Google Merchant Center, Snapchat, TikTok and OpenAI Ads accept.
 *
 * ⚠️ KEEP FIELD LOGIC IN SYNC WITH app/feed.xml/route.ts:
 *    - id            = bare Shopify VARIANT id  (MUST match pixel content_ids)
 *    - item_group_id = Shopify PRODUCT id       (variant grouping)
 *    - availability  = tracking-aware (untracked inventory => in_stock)
 *
 * Served at https://app.zicabella.com/feed.csv (the Next.js host — the apex
 * zicabella.com is the Shopify storefront and does NOT serve this route).
 */

import { fetchAllProducts, type ShopifyProduct } from '@/lib/shopify-admin';
import prisma from '@/lib/db';
import { getGoogleCategory } from '@/lib/google-product-categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zicabella.com').replace(/\/+$/, '');
const BRAND = 'Zica Bella';

// ─── Helpers (mirrored from feed.xml) ────────────────────────────────

/** RFC-4180 CSV cell: quote when the value contains comma, quote or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num) || num <= 0) return '';
  return `${num.toFixed(2)} INR`;
}

function getVariantAttributes(
  product: ShopifyProduct,
  variant: ShopifyProduct['variants'][0]
): { size: string | null; color: string | null } {
  const options = product.options || [];
  let size: string | null = null;
  let color: string | null = null;
  for (let i = 0; i < options.length; i++) {
    const name = options[i].name.toLowerCase();
    const value = i === 0 ? variant.option1 : i === 1 ? variant.option2 : variant.option3;
    if (name === 'size' && value) size = value;
    else if ((name === 'color' || name === 'colour') && value) color = value;
  }
  return { size, color };
}

async function getExcludedProductIds(): Promise<Set<string>> {
  try {
    const excluded = await prisma.product.findMany({
      where: { includeInFeed: false },
      select: { shopifyProductId: true },
    });
    return new Set<string>(excluded.map((p: { shopifyProductId: string }) => p.shopifyProductId));
  } catch (err) {
    console.error('[Feed CSV] Error fetching feed exclusions:', err);
    return new Set<string>();
  }
}

// ─── CSV column order (Google/Meta attribute names) ──────────────────
const HEADER = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'google_product_category',
  'product_type',
  'item_group_id',
  'size',
  'color',
  'mpn',
  'gtin',
  'identifier_exists',
];

function buildRow(product: ShopifyProduct, variant: ShopifyProduct['variants'][0]): string {
  const { size, color } = getVariantAttributes(product, variant);

  const productId = String(product.id);
  const variantId = String(variant.id);
  const id = variantId; // MUST equal pixel content_id

  const variantTitle = variant.title && variant.title !== 'Default Title' ? variant.title : '';
  const fullTitle = variantTitle ? `${product.title} - ${variantTitle}` : product.title;
  const description = product.body_html ? stripHtml(product.body_html) : product.title;
  const link = `${SITE_URL}/products/${product.handle}`;

  const primaryImage = product.image?.src || product.images?.[0]?.src || '';
  const additionalImages = (product.images || []).slice(1, 11).map(img => img.src).join(',');

  // Tracking-aware availability
  const inventoryTracked = !!variant.inventory_management;
  const inStock = inventoryTracked ? (variant.inventory_quantity ?? 0) > 0 : true;
  const availability = inStock ? 'in_stock' : 'out_of_stock';

  const variantPrice = parseFloat(variant.price || '0');
  const compareAtPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  let price = '';
  let salePrice = '';
  if (compareAtPrice && compareAtPrice > variantPrice && variantPrice > 0) {
    price = formatPrice(compareAtPrice);
    salePrice = formatPrice(variantPrice);
  } else if (variantPrice > 0) {
    price = formatPrice(variantPrice);
  }

  const productType = product.product_type || '';
  const googleCategory = getGoogleCategory(product.product_type);
  const identifierExists = !variant.sku && !variant.barcode ? 'no' : '';

  const cells = [
    id,
    fullTitle,
    description,
    availability,
    'new',
    price,
    salePrice,
    link,
    primaryImage,
    additionalImages,
    BRAND,
    googleCategory,
    productType,
    productId,
    size || '',
    color || '',
    variant.sku || '',
    variant.barcode || '',
    identifierExists,
  ];

  return cells.map(csvCell).join(',');
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    const [allProducts, excludedProductIds] = await Promise.all([
      fetchAllProducts(250, { allowFallback: false }),
      getExcludedProductIds(),
    ]);

    const feedProducts = allProducts.filter(product => {
      if (product.status !== 'active') return false;
      if (excludedProductIds.has(String(product.id))) return false;
      return true;
    });

    const rows: string[] = [HEADER.join(',')];
    for (const product of feedProducts) {
      if (!product.variants || !Array.isArray(product.variants)) continue;
      for (const variant of product.variants) {
        if (!variant) continue;
        rows.push(buildRow(product, variant));
      }
    }

    const csv = rows.join('\r\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="feed.csv"',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'X-Feed-Items': String(rows.length - 1),
      },
    });
  } catch (err) {
    console.error('[Feed CSV] Critical error generating feed:', err);
    return new Response(HEADER.join(',') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60',
      },
    });
  }
}
