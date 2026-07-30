/**
 * Google Product Category Mapping
 *
 * Maps Zica Bella's Shopify `product_type` values to Google's taxonomy.
 * Reference: https://support.google.com/merchants/answer/6324436
 *
 * Update this file whenever new product types are added in Shopify.
 */

// Map normalised (lowercase) product_type → Google Product Category string
export const GOOGLE_PRODUCT_CATEGORY_MAP: Record<string, string> = {
  // ── Tops ──────────────────────────────────────────────
  't-shirts':       'Apparel & Accessories > Clothing > Shirts & Tops',
  'tshirts':        'Apparel & Accessories > Clothing > Shirts & Tops',
  't-shirt':        'Apparel & Accessories > Clothing > Shirts & Tops',
  'tshirt':         'Apparel & Accessories > Clothing > Shirts & Tops',
  'shirts':         'Apparel & Accessories > Clothing > Shirts & Tops',
  'shirt':          'Apparel & Accessories > Clothing > Shirts & Tops',
  'polo':           'Apparel & Accessories > Clothing > Shirts & Tops',
  'polos':          'Apparel & Accessories > Clothing > Shirts & Tops',
  'tank tops':      'Apparel & Accessories > Clothing > Shirts & Tops',
  'tank top':       'Apparel & Accessories > Clothing > Shirts & Tops',
  'tops':           'Apparel & Accessories > Clothing > Shirts & Tops',

  // ── Outerwear ─────────────────────────────────────────
  'hoodies':        'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'hoodie':         'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'sweatshirts':    'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'sweatshirt':     'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'jackets':        'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'jacket':         'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'coats':          'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'coat':           'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'outerwear':      'Apparel & Accessories > Clothing > Outerwear',

  // ── Bottoms ───────────────────────────────────────────
  'pants':          'Apparel & Accessories > Clothing > Pants',
  'trousers':       'Apparel & Accessories > Clothing > Pants',
  'jeans':          'Apparel & Accessories > Clothing > Pants > Jeans',
  'shorts':         'Apparel & Accessories > Clothing > Shorts',
  'joggers':        'Apparel & Accessories > Clothing > Pants',
  'cargo':          'Apparel & Accessories > Clothing > Pants',
  'cargos':         'Apparel & Accessories > Clothing > Pants',

  // ── Accessories ───────────────────────────────────────
  'caps':           'Apparel & Accessories > Clothing Accessories > Hats',
  'cap':            'Apparel & Accessories > Clothing Accessories > Hats',
  'hats':           'Apparel & Accessories > Clothing Accessories > Hats',
  'hat':            'Apparel & Accessories > Clothing Accessories > Hats',
  'accessories':    'Apparel & Accessories > Clothing Accessories',
  'bags':           'Apparel & Accessories > Handbags, Wallets & Cases',
  'bag':            'Apparel & Accessories > Handbags, Wallets & Cases',
  'socks':          'Apparel & Accessories > Clothing > Underwear & Socks > Socks',

  // ── Sets ──────────────────────────────────────────────
  'co-ords':        'Apparel & Accessories > Clothing > Outfits & Sets',
  'sets':           'Apparel & Accessories > Clothing > Outfits & Sets',
  'set':            'Apparel & Accessories > Clothing > Outfits & Sets',
};

/** Fallback when product_type doesn't match any key above */
export const DEFAULT_GOOGLE_CATEGORY = 'Apparel & Accessories > Clothing';

/**
 * Look up the Google product category for a given Shopify product_type.
 * Normalises to lowercase for matching. Returns the default if not found.
 */
export function getGoogleCategory(productType: string | null | undefined): string {
  if (!productType) return DEFAULT_GOOGLE_CATEGORY;
  const normalised = productType.trim().toLowerCase();
  return GOOGLE_PRODUCT_CATEGORY_MAP[normalised] ?? DEFAULT_GOOGLE_CATEGORY;
}
