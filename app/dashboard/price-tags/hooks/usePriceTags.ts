/**
 * usePriceTags — Data fetching/mutation hook for price tag generation
 * 
 * Database Tables (create in Supabase SQL Editor):
 * 
 * -- price_tag_batches table
 * CREATE TABLE IF NOT EXISTS price_tag_batches (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   batch_number INTEGER NOT NULL DEFAULT 1,
 *   product_id TEXT NOT NULL,
 *   product_name TEXT NOT NULL,
 *   generic_name TEXT NOT NULL,
 *   mrp NUMERIC(10,2) NOT NULL,
 *   size TEXT NOT NULL,
 *   quantity INTEGER NOT NULL DEFAULT 1,
 *   sku_prefix TEXT NOT NULL,
 *   tags_generated JSONB NOT NULL DEFAULT '[]',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- price_tag_sku_counters table (tracks the N value per variant)
 * CREATE TABLE IF NOT EXISTS price_tag_sku_counters (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   sku_variant_key TEXT UNIQUE NOT NULL,
 *   last_counter INTEGER NOT NULL DEFAULT 0,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Atomic counter increment RPC
 * CREATE OR REPLACE FUNCTION increment_sku_counter(
 *   p_variant_key TEXT,
 *   p_quantity INTEGER
 * ) RETURNS INTEGER AS $$
 * DECLARE
 *   v_new_counter INTEGER;
 * BEGIN
 *   INSERT INTO price_tag_sku_counters (sku_variant_key, last_counter)
 *   VALUES (p_variant_key, p_quantity)
 *   ON CONFLICT (sku_variant_key)
 *   DO UPDATE SET
 *     last_counter = price_tag_sku_counters.last_counter + p_quantity,
 *     updated_at = NOW()
 *   RETURNING last_counter INTO v_new_counter;
 *   RETURN v_new_counter;
 * END;
 * $$ LANGUAGE plpgsql;
 */

'use client'

import { useState, useCallback } from 'react'
import { generateSKUPrefix, generateSKU, type TagData } from '../utils/skuGenerator'
import QRCode from 'qrcode'

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  status: string
  product_type: string
  vendor: string
  tags: string
  image: { src: string } | null
  variants: {
    id: number
    title: string
    price: string
    sku: string | null
    barcode: string | null
    inventory_quantity: number
    option1: string | null
    option2: string | null
  }[]
}

export interface BatchRecord {
  id: string
  batch_number: number
  product_id: string
  product_name: string
  generic_name: string
  mrp: number
  size: string
  quantity: number
  sku_prefix: string
  tags_generated: TagData[]
  created_at: string
  updated_at: string
}

export interface GenerateParams {
  productId: string
  productName: string
  genericName: string
  mrp: number
  size: string
  batchNumber: number
  quantity: number
  mfgMonth: number
  mfgYear: number
}

export function usePriceTags() {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [tags, setTags] = useState<TagData[]>([])
  const [batches, setBatches] = useState<BatchRecord[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/price-tags/products')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      const mappedProducts: ShopifyProduct[] = (data.products || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        handle: '',
        status: 'active',
        product_type: '',
        vendor: '',
        tags: '',
        image: row.featuredImage ? { src: row.featuredImage } : null,
        variants: [
          {
            id: 0,
            title: 'Default Variant',
            price: String(row.price || 0),
            sku: row.sku || null,
            barcode: row.barcode || null,
            inventory_quantity: 0,
            option1: null,
            option2: null,
          }
        ]
      }))

      setProducts(mappedProducts)
    } catch (err: any) {
      setError(`Failed to load products: ${err.message}`)
    } finally {
      setIsLoadingProducts(false)
    }
  }, [])

  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true)
    try {
      const response = await fetch('/api/admin/price-tags/batches')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setBatches((data.batches as BatchRecord[]) || [])
    } catch (err: any) {
      console.error('Failed to load batches:', err)
    } finally {
      setIsLoadingBatches(false)
    }
  }, [])

  const generateTags = useCallback(async (params: GenerateParams): Promise<TagData[]> => {
    setIsGenerating(true)
    setError(null)
    try {
      const skuPrefix = generateSKUPrefix({
        year: params.mfgYear,
        productName: params.productName,
        batchNumber: params.batchNumber,
        genericName: params.genericName,
        size: params.size,
      })

      // Atomic counter increment via server-side endpoint
      const incrementRes = await fetch('/api/admin/price-tags/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'increment-counter',
          skuPrefix,
          quantity: params.quantity,
        }),
      })

      if (!incrementRes.ok) {
        const errData = await incrementRes.json()
        throw new Error(`SKU counter error: ${errData.error || incrementRes.statusText}`)
      }

      const { endCounter } = await incrementRes.json()
      const endCounterNum = endCounter as number
      const startCounter = endCounterNum - params.quantity + 1
      const mfgDate = `${String(params.mfgMonth).padStart(2, '0')}/${params.mfgYear}`

      // Generate all tags with QR codes
      const generatedTags: TagData[] = []
      for (let i = 0; i < params.quantity; i++) {
        const counter = startCounter + i
        const sku = generateSKU(skuPrefix, counter)

        const qrDataUrl = await QRCode.toDataURL(sku, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        })

        generatedTags.push({
          sku,
          mrp: params.mrp,
          size: params.size,
          genericName: params.genericName,
          productName: params.productName,
          mfgDate,
          qrDataUrl,
          netQuantity: '1 Pc',
        })
      }

      // Save batch to Server DB
      const saveRes = await fetch('/api/admin/price-tags/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-batch',
          batchNumber: params.batchNumber,
          productId: params.productId,
          productName: params.productName,
          genericName: params.genericName,
          mrp: params.mrp,
          size: params.size,
          quantity: params.quantity,
          skuPrefix,
          tagsGenerated: generatedTags,
        }),
      })

      if (!saveRes.ok) {
        const errData = await saveRes.json()
        console.error('Batch save error:', errData.error)
        // Don't throw — tags are already generated, just warn
      }

      setTags(generatedTags)
      // Refresh batch history
      fetchBatches()

      return generatedTags
    } catch (err: any) {
      setError(err.message || 'Failed to generate tags')
      throw err
    } finally {
      setIsGenerating(false)
    }
  }, [fetchBatches])

  const loadBatchTags = useCallback(async (batch: BatchRecord) => {
    // Re-render tags from saved batch data
    // QR codes may need regeneration since they're stored as data URLs in JSONB
    const tagsWithQR: TagData[] = []
    for (const tag of batch.tags_generated) {
      // Regenerate QR if missing
      let qrDataUrl = tag.qrDataUrl
      if (!qrDataUrl || !qrDataUrl.startsWith('data:')) {
        qrDataUrl = await QRCode.toDataURL(tag.sku, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        })
      }
      tagsWithQR.push({ ...tag, qrDataUrl })
    }
    setTags(tagsWithQR)
  }, [])

  const clearTags = useCallback(() => {
    setTags([])
  }, [])

  return {
    products,
    tags,
    batches,
    isLoadingProducts,
    isGenerating,
    isLoadingBatches,
    error,
    fetchProducts,
    fetchBatches,
    generateTags,
    loadBatchTags,
    clearTags,
    setTags,
    setError,
  }
}
