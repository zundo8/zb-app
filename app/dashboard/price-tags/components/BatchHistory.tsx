'use client'

import React from 'react'
import { Calendar, Package, Eye, Download, Loader2 } from 'lucide-react'
import type { BatchRecord } from '../hooks/usePriceTags'

interface BatchHistoryProps {
  batches: BatchRecord[]
  isLoading: boolean
  onViewBatch: (batch: BatchRecord) => void
  onRedownload: (batch: BatchRecord) => void
}

export default function BatchHistory({
  batches,
  isLoading,
  onViewBatch,
  onRedownload,
}: BatchHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/20" />
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-10">
        <Package className="w-8 h-8 text-foreground/10 mx-auto mb-3" />
        <p className="text-[10px] text-foreground/30 uppercase tracking-[0.2em] font-medium">
          No batch history yet
        </p>
        <p className="text-[9px] text-foreground/20 mt-1">
          Generated batches will appear here
        </p>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSkuRange = (batch: BatchRecord) => {
    const tags = batch.tags_generated
    if (!tags || tags.length === 0) return '—'
    if (tags.length === 1) return tags[0].sku
    return `${tags[0].sku} → ${tags[tags.length - 1].sku}`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-foreground/[0.06]">
            {['Date', 'Product', 'Size', 'Batch', 'Qty', 'SKU Range', 'Actions'].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-[8px] font-semibold text-foreground/40 uppercase tracking-[0.2em] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/[0.04]">
          {batches.map((batch) => (
            <tr
              key={batch.id}
              className="group hover:bg-foreground/[0.02] transition-colors"
            >
              <td className="px-3 py-3 text-[10px] text-foreground/60 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-foreground/20" />
                  {formatDate(batch.created_at)}
                </div>
              </td>
              <td className="px-3 py-3 text-[10px] text-foreground font-medium max-w-[160px] truncate">
                {batch.product_name}
              </td>
              <td className="px-3 py-3">
                <span className="text-[9px] font-semibold bg-foreground/[0.05] px-2 py-0.5 rounded-md text-foreground/70 uppercase tracking-wider">
                  {batch.size}
                </span>
              </td>
              <td className="px-3 py-3 text-[10px] text-foreground/60 text-center">
                #{String(batch.batch_number).padStart(2, '0')}
              </td>
              <td className="px-3 py-3 text-[10px] text-foreground/60 text-center">
                {batch.quantity}
              </td>
              <td className="px-3 py-3 text-[9px] text-foreground/50 font-mono max-w-[200px] truncate">
                {getSkuRange(batch)}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onViewBatch(batch)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-foreground/[0.06] rounded-lg text-[8px] font-semibold uppercase tracking-[0.1em] text-foreground/60 hover:text-foreground transition-all"
                    title="View Tags"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                  <button
                    onClick={() => onRedownload(batch)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-foreground/[0.06] rounded-lg text-[8px] font-semibold uppercase tracking-[0.1em] text-foreground/60 hover:text-foreground transition-all"
                    title="Re-download PDF"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
