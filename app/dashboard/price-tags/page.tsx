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
      // Load tags first, then trigger PDF download
      await loadBatchTags(batch)
      toast.info('Preparing PDF...')

      // Wait for next render cycle so tags are rendered in DOM
      setTimeout(async () => {
        const printArea = document.getElementById('price-tags-print-area')
        if (!printArea) {
          toast.error('Could not find tags to download')
          return
        }
        const tagElements = Array.from(
          printArea.querySelectorAll('.price-tag-card')
        ) as HTMLElement[]
        await downloadTagsPDF(tagElements, `zicabella-batch-${batch.batch_number}-${Date.now()}.pdf`)
        toast.success('PDF downloaded!')
      }, 500)
    } catch (err: any) {
      toast.error(`Failed to download: ${err.message}`)
    }
  }, [loadBatchTags])

  return (
    <>
      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #price-tags-print-area,
          #price-tags-print-area * {
            visibility: visible !important;
          }
          #price-tags-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            z-index: 99999 !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2mm !important;
            padding: 5mm !important;
          }
          .price-tag-card {
            width: 50mm !important;
            height: 80mm !important;
            page-break-inside: avoid !important;
            margin: 2mm !important;
            display: inline-block !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
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
