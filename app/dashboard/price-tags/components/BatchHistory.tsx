'use client'

import React from 'react'
import { Calendar, Package, Eye, Download, Loader2, Trash2, Search, X, Filter, ChevronDown, AlertTriangle } from 'lucide-react'
import type { BatchRecord, BatchFilters } from '../hooks/usePriceTags'
import { SIZES } from '../utils/skuGenerator'
import { motion, AnimatePresence } from 'framer-motion'

interface BatchHistoryProps {
  batches: BatchRecord[]
  isLoading: boolean
  isDeleting: boolean
  isSuperAdmin: boolean
  filters: BatchFilters
  onViewBatch: (batch: BatchRecord) => void
  onRedownload: (batch: BatchRecord) => void
  onDeleteBatch: (batch: BatchRecord) => void
  onUpdateFilters: (filters: Partial<BatchFilters>) => void
  onClearFilters: () => void
  onApplyFilters: () => void
}

export default function BatchHistory({
  batches,
  isLoading,
  isDeleting,
  isSuperAdmin,
  filters,
  onViewBatch,
  onRedownload,
  onDeleteBatch,
  onUpdateFilters,
  onClearFilters,
  onApplyFilters,
}: BatchHistoryProps) {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [showFilters, setShowFilters] = React.useState(false)
  const hasActiveFilters = !!(filters.search || filters.size || filters.dateFrom || filters.dateTo)

  const handleDeleteClick = (batch: BatchRecord) => {
    setConfirmDeleteId(batch.id)
  }

  const handleConfirmDelete = (batch: BatchRecord) => {
    onDeleteBatch(batch)
    setConfirmDeleteId(null)
  }

  const handleCancelDelete = () => {
    setConfirmDeleteId(null)
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

  const getRelativeTime = (dateStr: string) => {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  }

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onUpdateFilters({ search: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') onApplyFilters() }}
              placeholder="Search by product or SKU prefix..."
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-[11px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/20 transition-all"
            />
            {filters.search && (
              <button
                onClick={() => { onUpdateFilters({ search: '' }); onApplyFilters() }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
              >
                <X className="w-3 h-3 text-foreground/40" />
              </button>
            )}
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-[0.1em] transition-all border ${
              showFilters || hasActiveFilters
                ? 'bg-foreground/10 text-foreground border-foreground/15'
                : 'bg-foreground/[0.03] text-foreground/50 border-foreground/[0.06] hover:bg-foreground/[0.06]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
            )}
          </button>

          {/* Apply + Clear */}
          <button
            onClick={onApplyFilters}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-foreground text-background rounded-xl text-[10px] font-semibold uppercase tracking-[0.1em] transition-all hover:opacity-90 active:scale-[0.97]"
          >
            Search
          </button>

          {hasActiveFilters && (
            <button
              onClick={() => { onClearFilters(); onApplyFilters() }}
              className="flex items-center gap-1 px-3 py-2.5 text-foreground/50 hover:text-foreground text-[10px] font-semibold uppercase tracking-[0.1em] transition-all"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-foreground/[0.02] rounded-xl border border-foreground/[0.05]">
                {/* Size Filter */}
                <div>
                  <label className="block text-[8px] font-semibold text-foreground/40 uppercase tracking-[0.2em] mb-1.5">
                    Size
                  </label>
                  <div className="relative">
                    <select
                      value={filters.size}
                      onChange={(e) => onUpdateFilters({ size: e.target.value })}
                      className="w-full appearance-none bg-foreground/[0.03] border border-foreground/[0.08] rounded-lg px-3 py-2 pr-8 text-[11px] text-foreground focus:outline-none focus:border-foreground/20 cursor-pointer transition-all"
                    >
                      <option value="">All Sizes</option>
                      {SIZES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/30 pointer-events-none" />
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-[8px] font-semibold text-foreground/40 uppercase tracking-[0.2em] mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => onUpdateFilters({ dateFrom: e.target.value })}
                    className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-lg px-3 py-2 text-[11px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-[8px] font-semibold text-foreground/40 uppercase tracking-[0.2em] mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => onUpdateFilters({ dateTo: e.target.value })}
                    className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-lg px-3 py-2 text-[11px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Loading State ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/20" />
            <p className="text-[9px] text-foreground/30 uppercase tracking-[0.2em] font-medium">Loading batches...</p>
          </div>
        </div>
      ) : batches.length === 0 ? (
        /* ── Empty State ── */
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.05] flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-foreground/10" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] text-foreground/40 font-semibold mb-1">
            {hasActiveFilters ? 'No Batches Match Filters' : 'No Batch History Yet'}
          </p>
          <p className="text-[9px] text-foreground/25 max-w-[280px] mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your filters or clear them to see all batches.'
              : 'Generated price tag batches will appear here with full history and actions.'}
          </p>
        </div>
      ) : (
        /* ── Batch Cards ── */
        <div className="space-y-3">
          {/* Summary Bar */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[9px] text-foreground/35 uppercase tracking-[0.15em] font-medium">
              {batches.length} batch{batches.length !== 1 ? 'es' : ''} found
              {hasActiveFilters && ' (filtered)'}
            </p>
            <p className="text-[9px] text-foreground/25 uppercase tracking-[0.15em]">
              {batches.reduce((sum, b) => sum + b.quantity, 0)} total tags
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-foreground/[0.06] bg-foreground/[0.01]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                  {['Date', 'Product', 'Size', 'Batch', 'Qty', 'MRP', 'SKU Range', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-[8px] font-bold text-foreground/40 uppercase tracking-[0.2em] whitespace-nowrap first:rounded-tl-xl last:rounded-tr-xl"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.04]">
                {batches.map((batch) => {
                  const isConfirmingDelete = confirmDeleteId === batch.id
                  return (
                    <tr
                      key={batch.id}
                      className="group hover:bg-foreground/[0.02] transition-colors"
                    >
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/60 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-foreground/20" strokeWidth={1.5} />
                            {formatDate(batch.created_at)}
                          </span>
                          <span className="text-[8px] text-foreground/25 mt-0.5 ml-[18px]">
                            {getRelativeTime(batch.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-[10px] text-foreground font-medium max-w-[180px] truncate" title={batch.product_name}>
                          {batch.product_name}
                        </p>
                        <p className="text-[8px] text-foreground/30 mt-0.5 uppercase tracking-wider">
                          {batch.generic_name}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[9px] font-bold bg-foreground/[0.06] px-2.5 py-1 rounded-lg text-foreground/70 uppercase tracking-wider">
                          {batch.size}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-[10px] text-foreground/60 font-mono">
                          #{String(batch.batch_number).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-[10px] text-foreground/60 font-semibold">{batch.quantity}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[10px] text-foreground/60">₹{Number(batch.mrp).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[9px] text-foreground/45 font-mono max-w-[200px] truncate block" title={getSkuRange(batch)}>
                          {getSkuRange(batch)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <AnimatePresence mode="wait">
                          {isConfirmingDelete ? (
                            <motion.div
                              key="confirm"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center gap-1.5"
                            >
                              <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                <span className="text-[8px] text-red-500 font-semibold uppercase tracking-wider">Delete?</span>
                              </div>
                              <button
                                onClick={() => handleConfirmDelete(batch)}
                                disabled={isDeleting}
                                className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-[8px] font-bold uppercase tracking-[0.1em] hover:bg-red-600 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                              </button>
                              <button
                                onClick={handleCancelDelete}
                                className="px-2.5 py-1.5 bg-foreground/[0.06] text-foreground/60 rounded-lg text-[8px] font-bold uppercase tracking-[0.1em] hover:bg-foreground/[0.1] transition-colors"
                              >
                                No
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="actions"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center gap-1"
                            >
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
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDeleteClick(batch)}
                                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-[8px] font-semibold uppercase tracking-[0.1em] text-foreground/30 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete Batch (Super Admin)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
