/**
 * SKU Generation Utilities for Zica Bella Price Tags
 * 
 * SKU Format: ZB{YY}{PM}{BB}{GN}{SZ}{N}
 * - ZB: Zica Bella prefix (always fixed)
 * - YY: 2-digit year (e.g. 26 for 2026)
 * - PM: Product name abbreviation, 2 uppercase letters
 * - BB: Batch number, zero-padded 2 digits
 * - GN: Generic name shortcode, 2 uppercase letters
 * - SZ: Size (XS, S, M, L, XL, XXL)
 * - N: Unique sequential number for this exact product variant
 */

export function getProductAbbreviation(productName: string): string {
  const name = productName.toLowerCase()
  if (name.includes('t-shirt') || name.includes('tee') || name.includes('tshirt')) {
    return name.includes('women') || name.includes('woman') || name.includes('female') ? 'TW' : 'TM'
  }
  if (name.includes('kurta')) return name.includes('women') ? 'KW' : 'KM'
  if (name.includes('hoodie')) return 'HD'
  if (name.includes('sweatshirt')) return 'SW'
  if (name.includes('jacket')) return 'JK'
  if (name.includes('trouser') || name.includes('pant')) return 'TR'
  if (name.includes('short')) return 'SH'
  if (name.includes('dress')) return 'DR'
  if (name.includes('top')) return 'TP'
  // fallback: first 2 letters of first word
  const words = productName.trim().split(' ')
  return words[0].substring(0, 2).toUpperCase()
}

export function getGenericNameCode(genericName: string): string {
  const map: Record<string, string> = {
    'T-SHIRT': 'TS', 'TSHIRT': 'TS', 'TEE': 'TS',
    'KURTA': 'KU', 'HOODIE': 'HO', 'SWEATSHIRT': 'SW',
    'JACKET': 'JK', 'TROUSER': 'TR', 'PANT': 'TR',
    'SHORT': 'SH', 'SHORTS': 'SH', 'DRESS': 'DR',
    'TOP': 'TP', 'JEANS': 'JN', 'SHIRT': 'SR'
  }
  return map[genericName.toUpperCase()] || genericName.substring(0, 2).toUpperCase()
}

export function generateSKUPrefix(params: {
  year: number
  productName: string
  batchNumber: number
  genericName: string
  size: string
}): string {
  const yy = String(params.year).slice(-2)
  const pm = getProductAbbreviation(params.productName)
  const bb = String(params.batchNumber).padStart(2, '0')
  const gn = getGenericNameCode(params.genericName)
  const sz = params.size.toUpperCase()
  return `ZB${yy}${pm}${bb}${gn}${sz}`
}

export function generateSKU(prefix: string, counter: number): string {
  return `${prefix}${counter}`
}

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export type Size = typeof SIZES[number]

export const GENERIC_NAMES = [
  'T-SHIRT', 'KURTA', 'HOODIE', 'SWEATSHIRT', 'JACKET',
  'TROUSER', 'SHORTS', 'DRESS', 'TOP', 'JEANS', 'SHIRT'
] as const

export interface TagData {
  sku: string
  mrp: number
  size: string
  genericName: string
  productName: string
  mfgDate: string
  qrDataUrl: string
  netQuantity: string
}
