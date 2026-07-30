/**
 * /feed.xml — Spec-complete product feed for Meta, Snapchat, TikTok & Google Merchant Center
 *
 * RSS 2.0 with Google Merchant `g:` namespace.
 * Data sourced from Shopify Admin REST API; feed-inclusion flags from Prisma.
 *
 * Platform requirements covered:
 * - Google Merchant Center: g:id, title, description, link, g:image_link, g:price, g:availability,
 *   g:brand, g:condition, g:google_product_category, g:item_group_id, g:size, g:color, g:mpn, g:gtin
 * - Meta Commerce Manager: Same fields (RSS 2.0 w/ Google namespace is accepted)
 * - Snapchat Catalog: Same RSS 2.0 feed format
 * - TikTok Catalog: Same RSS 2.0 feed format
 */

import {
  fetchAllProducts,
  fetchCollections,
  fetchProductsByCollectionId,
  type ShopifyProduct,
  type ShopifyCollection,
} from '@/lib/shopify-admin';
import prisma from '@/lib/db';
import { getGoogleCategory } from '@/lib/google-product-categories';

export const runtime = 'nodejs';
export const revalidate = 900; // 15 minutes — documented tradeoff in implementation plan

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zicabella.com').replace(/\/+$/, '');
const BRAND = 'Zica Bella';

// ─── XML Escape ──────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Strip HTML tags and decode basic entities for plain-text description */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Wrap text in CDATA, escaping any nested ]]> sequences */
function cdata(text: string): string {
  const safe = text.replace(/\]\]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

/** Format a price as "1999.00 INR" */
function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num) || num <= 0) return '';
  return `${num.toFixed(2)} INR`;
}

/** Determine size and color from a variant based on product option definitions */
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

// ─── Data Fetching ───────────────────────────────────────────────────

interface FeedExclusions {
  excludedProductIds: Set<string>;
  excludedCollectionHandles: Set<string>;
}

async function getFeedExclusions(): Promise<FeedExclusions> {
  try {
    const [excludedProducts, shop] = await Promise.all([
      prisma.product.findMany({
        where: { includeInFeed: false },
        select: { shopifyProductId: true },
      }),
      prisma.shop.findFirst({
        select: { feedExcludedCollections: true },
      }),
    ]);

    const excludedProductIds = new Set<string>(excludedProducts.map((p: { shopifyProductId: string }) => p.shopifyProductId));

    let excludedCollectionHandles = new Set<string>();
    if (shop?.feedExcludedCollections) {
      try {
        const handles: string[] = JSON.parse(shop.feedExcludedCollections);
        excludedCollectionHandles = new Set<string>(handles.map(h => h.trim().toLowerCase()));
      } catch {
        // Invalid JSON — treat as no exclusions
      }
    }

    return { excludedProductIds, excludedCollectionHandles };
  } catch (err) {
    console.error('[Feed] Error fetching feed exclusions from database:', err);
    return { excludedProductIds: new Set<string>(), excludedCollectionHandles: new Set<string>() };
  }
}

/** Build a map of productId → collection handles (for product_type + excluded-collection filtering) */
async function buildProductCollectionMap(
  collections: ShopifyCollection[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();

  // Batch fetch products per collection with concurrency limit
  const CONCURRENCY = 4;
  for (let i = 0; i < collections.length; i += CONCURRENCY) {
    const batch = collections.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (col) => {
        try {
          const products = await fetchProductsByCollectionId(col.id.toString());
          return { handle: col.handle, productIds: products.map(p => p.id) };
        } catch {
          return { handle: col.handle, productIds: [] as number[] };
        }
      })
    );

    for (const { handle, productIds } of results) {
      for (const pid of productIds) {
        const existing = map.get(pid) || [];
        existing.push(handle);
        map.set(pid, existing);
      }
    }
  }

  return map;
}

// ─── XML Generation ──────────────────────────────────────────────────

function generateItemXml(
  product: ShopifyProduct,
  variant: ShopifyProduct['variants'][0],
  collectionHandles: string[]
): string {
  const { size, color } = getVariantAttributes(product, variant);

  const productId = String(product.id);
  const variantId = String(variant.id);
  const itemId = `${productId}_${variantId}`;

  const variantTitle = variant.title && variant.title !== 'Default Title' ? variant.title : '';
  const fullTitle = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

  const description = product.body_html ? stripHtml(product.body_html) : product.title;

  const link = `${SITE_URL}/products/${product.handle}`;

  // Images
  const primaryImage = product.image?.src || product.images?.[0]?.src || '';
  const additionalImages = (product.images || [])
    .slice(1, 11) // Max 10 additional images per Google spec
    .map(img => img.src);

  // Availability — from Shopify variant inventory
  const inStock = (variant.inventory_quantity ?? 0) > 0;
  const availability = inStock ? 'in_stock' : 'out_of_stock';

  // Pricing
  const variantPrice = parseFloat(variant.price || '0');
  const compareAtPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;

  let priceTag = '';
  let salePriceTag = '';

  if (compareAtPrice && compareAtPrice > variantPrice && variantPrice > 0) {
    // Product is on sale: g:price = original, g:sale_price = current
    priceTag = formatPrice(compareAtPrice);
    salePriceTag = formatPrice(variantPrice);
  } else if (variantPrice > 0) {
    priceTag = formatPrice(variantPrice);
  }

  // Product type / category
  const productType = product.product_type || collectionHandles[0] || '';
  const googleCategory = getGoogleCategory(product.product_type || collectionHandles[0]);

  const lines: string[] = [
    '    <item>',
    `      <g:id>${escapeXml(itemId)}</g:id>`,
    `      <title>${escapeXml(fullTitle)}</title>`,
    `      <description>${cdata(description)}</description>`,
    `      <link>${escapeXml(link)}</link>`,
  ];

  if (primaryImage) {
    lines.push(`      <g:image_link>${escapeXml(primaryImage)}</g:image_link>`);
  }
  for (const img of additionalImages) {
    lines.push(`      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`);
  }

  lines.push(`      <g:availability>${availability}</g:availability>`);

  if (priceTag) lines.push(`      <g:price>${escapeXml(priceTag)}</g:price>`);
  if (salePriceTag) lines.push(`      <g:sale_price>${escapeXml(salePriceTag)}</g:sale_price>`);

  lines.push(`      <g:brand>${escapeXml(BRAND)}</g:brand>`);
  lines.push(`      <g:condition>new</g:condition>`);

  if (productType) {
    lines.push(`      <g:product_type>${escapeXml(productType)}</g:product_type>`);
  }
  lines.push(`      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>`);

  // Variant grouping
  lines.push(`      <g:item_group_id>${escapeXml(productId)}</g:item_group_id>`);

  if (size) lines.push(`      <g:size>${escapeXml(size)}</g:size>`);
  if (color) lines.push(`      <g:color>${escapeXml(color)}</g:color>`);

  // Identifiers
  if (variant.sku) lines.push(`      <g:mpn>${escapeXml(variant.sku)}</g:mpn>`);
  if (variant.barcode) lines.push(`      <g:gtin>${escapeXml(variant.barcode)}</g:gtin>`);

  // If no GTIN or MPN, set identifier_exists to false
  if (!variant.sku && !variant.barcode) {
    lines.push(`      <g:identifier_exists>false</g:identifier_exists>`);
  }

  lines.push('    </item>');

  return lines.join('\n');
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    console.log('[Feed] Starting feed generation...');
    const startTime = Date.now();

    // Parallel fetch: Shopify products + collections + Prisma exclusions
    const [allProducts, allCollections, exclusions] = await Promise.all([
      fetchAllProducts(250),
      fetchCollections(250),
      getFeedExclusions(),
    ]);

    console.log(`[Feed] Fetched ${allProducts.length} products, ${allCollections.length} collections`);

    // Build product → collection map
    const productCollectionMap = await buildProductCollectionMap(allCollections);

    // Filter products
    const feedProducts = allProducts.filter(product => {
      // Must be active
      if (product.status !== 'active') return false;

      // Must not be excluded by includeInFeed flag
      if (exclusions.excludedProductIds.has(String(product.id))) return false;

      // Must not belong exclusively to excluded collections
      const productCollections = productCollectionMap.get(product.id) || [];
      if (
        exclusions.excludedCollectionHandles.size > 0 &&
        productCollections.length > 0 &&
        productCollections.every(h => exclusions.excludedCollectionHandles.has(h.toLowerCase()))
      ) {
        return false;
      }

      // Must have at least one variant with stock > 0
      const hasStock = product.variants.some(v => (v.inventory_quantity ?? 0) > 0);
      if (!hasStock) return false;

      return true;
    });

    console.log(`[Feed] ${feedProducts.length} products pass feed filters`);

    // Generate items — one per variant
    const items: string[] = [];
    for (const product of feedProducts) {
      const collectionHandles = productCollectionMap.get(product.id) || [];
      for (const variant of product.variants) {
        items.push(generateItemXml(product, variant, collectionHandles));
      }
    }

    const now = new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(BRAND)} Product Feed</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(`${BRAND} — Official Product Catalog Feed`)}</description>
    <lastBuildDate>${escapeXml(now)}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`;

    const elapsed = Date.now() - startTime;
    console.log(`[Feed] Generated feed with ${items.length} items in ${elapsed}ms`);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'X-Feed-Items': String(items.length),
        'X-Feed-Generated': now,
      },
    });
  } catch (err) {
    console.error('[Feed] Critical error generating feed:', err);

    // Return a valid but empty feed on error — platforms handle empty feeds gracefully
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(BRAND)} Product Feed</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Feed temporarily unavailable</description>
  </channel>
</rss>`;

    return new Response(errorXml, {
      status: 200, // Return 200 even on error — platforms may mark feeds as broken on 500
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60',
      },
    });
  }
}
