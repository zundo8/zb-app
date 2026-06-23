/**
 * Price Tag Generator — /dashboard/price-tags
 * 
 * Auto-generates printable price tags for Zica Bella products.
 * Features: SKU generation, QR codes, PDF export, print, batch history.
 * 
 * SUPABASE MIGRATION — Run these in Supabase SQL Editor before using:
 * 
 * -- 1. price_tag_batches table
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
 * -- 2. price_tag_sku_counters table
 * CREATE TABLE IF NOT EXISTS price_tag_sku_counters (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   sku_variant_key TEXT UNIQUE NOT NULL,
 *   last_counter INTEGER NOT NULL DEFAULT 0,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 3. Atomic counter increment RPC function
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

import React, { useEffect, useCallback, useRef } from 'react'
import { Tag, RefreshCw, History } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

import TagGeneratorForm from './components/TagGeneratorForm'
import TagPreviewPanel from './components/TagPreviewPanel'
import BatchHistory from './components/BatchHistory'
import { usePriceTags, type GenerateParams, type BatchRecord } from './hooks/usePriceTags'
import { downloadTagsPDF } from './utils/pdfExport'

export default function PriceTagsPage() {
  const {
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
    setError,
  } = usePriceTags()

  const previewRef = useRef<HTMLDivElement>(null)

  // Load products and batch history on mount
  useEffect(() => {
    fetchProducts()
    fetchBatches()
  }, [fetchProducts, fetchBatches])

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error)
      setError(null)
    }
  }, [error, setError])

  const handleGenerate = useCallback(async (params: GenerateParams) => {
    try {
      const generatedTags = await generateTags(params)
      toast.success(`${generatedTags.length} price tags generated!`)
      // Scroll to preview
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      // Error already handled in hook
    }
  }, [generateTags])

  const handleViewBatch = useCallback(async (batch: BatchRecord) => {
    try {
      await loadBatchTags(batch)
      toast.success(`Loaded ${batch.quantity} tags from batch #${String(batch.batch_number).padStart(2, '0')}`)
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err: any) {
      toast.error(`Failed to load batch: ${err.message}`)
    }
  }, [loadBatchTags])

  const handleRedownload = useCallback(async (batch: BatchRecord) => {
    try {
      // Load tags from batch data
      const loadedTags = await loadBatchTags(batch)
      toast.info('Preparing PDF...')

      // Use the batch's stored tag data directly — no DOM needed
      const tagsToExport = loadedTags || batch.tags_generated || []
      if (tagsToExport.length === 0) {
        toast.error('No tags found in this batch')
        return
      }

      await downloadTagsPDF(tagsToExport, `zicabella-batch-${batch.batch_number}-${Date.now()}.pdf`, 'thermal')
      toast.success('PDF downloaded!')
    } catch (err: any) {
      toast.error(`Failed to download: ${err.message}`)
    }
  }, [loadBatchTags])

  return (
    <>
      {/* Print CSS — proper paginated full-page layout (optimized for 50mm × 100mm Thermal Label) */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the tag print area */
          body > *:not(#__next),
          #__next > * > *:not(#price-tags-print-area) {
            display: none !important;
          }
          .no-print,
          nav, header, footer, aside,
          button, form, table, [class*="border-foreground"] {
            display: none !important;
          }
          
          /* Setup main print area container */
          #price-tags-print-area {
            display: block !important;
            width: 50mm !important;
            height: 100mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            position: static !important;
            box-sizing: border-box !important;
          }
          
          #price-tags-print-area * {
            visibility: visible !important;
          }
          
          /* Checkbox overlay hidden in print */
          .price-tag-card label,
          .price-tag-card input[type="checkbox"] {
            display: none !important;
          }

          /* ── Thermal Label (50mm × 100mm) ── */
          .price-tag-card {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 44mm !important;
            height: 94mm !important;
            margin: 3mm auto !important; /* Margins to fit the 50x100 label bounds */
            padding: 3mm 3mm 2mm 3mm !important;
            box-sizing: border-box !important;
            border: none !important;
            border-radius: 0 !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          .price-tag-card .logo-container {
            margin-bottom: 2.5mm !important;
            text-align: center !important;
            display: flex !important;
            justify-content: center !important;
          }
          .price-tag-card .logo-image {
            height: 8mm !important;
            width: 8mm !important;
            max-height: 8mm !important;
            max-width: 8mm !important;
          }
          
          .price-tag-card .mrp-section {
            padding: 2.5mm 0 !important;
            border-top: 0.15mm solid #dddddd !important;
            margin-bottom: 2.5mm !important;
          }
          .price-tag-card .mrp-title,
          .price-tag-card .mrp-value {
            font-size: 7.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 0.2px !important;
          }
          .price-tag-card .mrp-taxes {
            font-size: 3.5pt !important;
            color: #888888 !important;
            margin-top: 0.5mm !important;
            letter-spacing: 0.2px !important;
          }
          
          .price-tag-card .tag-divider {
            height: 0.15mm !important;
            background-color: #dddddd !important;
            margin-bottom: 2.5mm !important;
          }
          
          .price-tag-card .info-rows {
            width: 100% !important;
          }
          .price-tag-card .info-row {
            padding: 0.8mm 0 !important;
            gap: 2mm !important;
          }
          .price-tag-card .info-row-label {
            font-size: 4.2pt !important;
            font-weight: 700 !important;
            color: #555555 !important;
            letter-spacing: 0.1px !important;
          }
          .price-tag-card .info-row-value {
            font-size: 4.2pt !important;
            font-weight: 500 !important;
            color: #111111 !important;
          }
          
          .price-tag-card .qr-section {
            margin-top: auto !important;
            padding-top: 2mm !important;
            border-top: 0.15mm solid #eeeeee !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .price-tag-card .qr-image {
            width: 20mm !important;
            height: 20mm !important;
          }
          
          .price-tag-card .sku-text {
            margin-top: 1mm !important;
            font-size: 4.2pt !important;
            font-weight: 600 !important;
            color: #333333 !important;
            letter-spacing: 0.2px !important;
          }
          
          @page {
            size: 50mm 100mm;
            margin: 0;
          }
        }
      `}</style>


      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="px-2 py-0.5 bg-foreground/[0.03] rounded-md text-[7px] font-normal text-foreground/30 uppercase tracking-[0.3em] w-fit">
                Print Center
              </div>
            </div>
            <h1 className="text-lg font-normal text-foreground uppercase tracking-[0.2em] leading-none mt-1 flex items-center gap-3">
              <Tag className="w-5 h-5 text-foreground/40" strokeWidth={1.5} />
              Price Tags
            </h1>
            <p className="text-[9px] text-foreground/30 font-normal uppercase tracking-[0.2em] mt-1">
              Generate · Preview · Print
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchProducts(); fetchBatches(); }}
              className="flex items-center gap-2 px-4 py-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-foreground/[0.05] rounded-lg text-[8px] font-normal uppercase tracking-[0.2em] text-foreground/50 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingProducts ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Main Content: Left Form + Right Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left Panel — Generator Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-foreground/[0.015] border border-foreground/[0.06] rounded-2xl p-6"
          >
            <div className="mb-5">
              <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-[0.15em]">
                Tag Generator
              </h2>
              <p className="text-[8px] text-foreground/30 mt-0.5 uppercase tracking-[0.1em]">
                Configure and generate price tags
              </p>
            </div>

            <TagGeneratorForm
              products={products}
              isLoadingProducts={isLoadingProducts}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
            />
          </motion.div>

          {/* Right Panel — Tag Preview */}
          <motion.div
            ref={previewRef}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-foreground/[0.015] border border-foreground/[0.06] rounded-2xl p-6 min-h-[400px]"
          >
            <div className="mb-5">
              <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-[0.15em]">
                Tag Preview
              </h2>
              <p className="text-[8px] text-foreground/30 mt-0.5 uppercase tracking-[0.1em]">
                Preview, download, and print generated tags
              </p>
            </div>

            <TagPreviewPanel tags={tags} />
          </motion.div>
        </div>

        {/* Batch History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-foreground/[0.015] border border-foreground/[0.06] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                <History className="w-4 h-4 text-foreground/30" strokeWidth={1.5} />
                Batch History
              </h2>
              <p className="text-[8px] text-foreground/30 mt-0.5 uppercase tracking-[0.1em]">
                Previously generated tag batches
              </p>
            </div>
            <button
              onClick={fetchBatches}
              disabled={isLoadingBatches}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-foreground/[0.05] rounded-lg text-[8px] font-normal uppercase tracking-[0.2em] text-foreground/40 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingBatches ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>

          <BatchHistory
            batches={batches}
            isLoading={isLoadingBatches}
            onViewBatch={handleViewBatch}
            onRedownload={handleRedownload}
          />
        </motion.div>
      </div>
    </>
  )
}
