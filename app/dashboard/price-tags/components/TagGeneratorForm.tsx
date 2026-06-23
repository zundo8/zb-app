'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, ChevronDown, Sparkles, Eye } from 'lucide-react'
import type { ShopifyProduct, GenerateParams } from '../hooks/usePriceTags'
import { SIZES, GENERIC_NAMES, generateSKUPrefix } from '../utils/skuGenerator'
import PriceTagCard from './PriceTagCard'
import type { TagData } from '../utils/skuGenerator'
import QRCode from 'qrcode'

interface TagGeneratorFormProps {
  products: ShopifyProduct[]
  isLoadingProducts: boolean
  isGenerating: boolean
  onGenerate: (params: GenerateParams) => Promise<void>
}

export default function TagGeneratorForm({
  products,
  isLoadingProducts,
  isGenerating,
  onGenerate,
}: TagGeneratorFormProps) {
  const now = new Date()

  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null)
  const [size, setSize] = useState('M')
  const [batchNumber, setBatchNumber] = useState(1)
  const [quantity, setQuantity] = useState(10)
  const [mrpOverride, setMrpOverride] = useState<number>(0)
  const [genericName, setGenericName] = useState('T-SHIRT')
  const [mfgMonth, setMfgMonth] = useState(now.getMonth() + 1)
  const [mfgYear, setMfgYear] = useState(now.getFullYear())

  // When product changes, auto-fill MRP and generic name
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find((p) => String(p.id) === selectedProductId)
      if (product) {
        setSelectedProduct(product)
        const price = parseFloat(product.variants[0]?.price || '0')
        setMrpOverride(price)

        // Attempt to detect generic name from title first, then product_type
        const title = (product.title || '').toUpperCase()
        const type = (product.product_type || '').toUpperCase()
        const match = GENERIC_NAMES.find((gn) =>
          title.includes(gn) || title.includes(gn.replace('-', '')) ||
          type.includes(gn) || type.includes(gn.replace('-', ''))
        )
        if (match) {
          setGenericName(match)
        } else if (title.includes('TEE') || title.includes('T-SHIRT') || title.includes('TSHIRT')) {
          setGenericName('T-SHIRT')
        } else if (title.includes('PANT') || title.includes('TROUSER')) {
          setGenericName('TROUSER')
        } else if (title.includes('SHORT')) {
          setGenericName('SHORTS')
        } else if (title.includes('SWEAT')) {
          setGenericName('SWEATSHIRT')
        } else {
          setGenericName('T-SHIRT') // Default fallback
        }
      }
    } else {
      setSelectedProduct(null)
    }
  }, [selectedProductId, products])

  // ── Live preview tag data (with real QR code) ──
  const [previewTag, setPreviewTag] = useState<TagData | null>(null)

  useEffect(() => {
    if (!selectedProduct && mrpOverride === 0) {
      setPreviewTag(null)
      return
    }

    const mfgDate = `${String(mfgMonth).padStart(2, '0')}/${mfgYear}`
    const previewSku = selectedProduct
      ? generateSKUPrefix({
          year: mfgYear,
          productName: selectedProduct.title,
          batchNumber: batchNumber,
          genericName: genericName,
          size: size,
        }) + '1'
      : 'ZB00XX00XXX1'

    // Generate a real QR code for the preview
    QRCode.toDataURL(previewSku, {
      width: 120,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then((qrDataUrl) => {
      setPreviewTag({
        sku: previewSku,
        mrp: mrpOverride || 0,
        size: size,
        genericName: genericName,
        productName: selectedProduct?.title || 'Product Name',
        mfgDate,
        qrDataUrl,
        netQuantity: '1 Pc',
      })
    }).catch(() => {
      setPreviewTag({
        sku: previewSku,
        mrp: mrpOverride || 0,
        size: size,
        genericName: genericName,
        productName: selectedProduct?.title || 'Product Name',
        mfgDate,
        qrDataUrl: '',
        netQuantity: '1 Pc',
      })
    })
  }, [selectedProduct, mrpOverride, size, genericName, mfgMonth, mfgYear, batchNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return

    await onGenerate({
      productId: String(selectedProduct.id),
      productName: selectedProduct.title,
      genericName,
      mrp: mrpOverride,
      size,
      batchNumber,
      quantity,
      mfgMonth,
      mfgYear,
    })
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Dropdown */}
        <div>
          <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
            Product
          </label>
          <div className="relative">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={isLoadingProducts}
              className="w-full appearance-none bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 pr-10 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <option value="">
                {isLoadingProducts ? 'Loading products...' : 'Select a product'}
              </option>
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.title} — ₹{parseFloat(p.variants[0]?.price || '0').toLocaleString('en-IN')}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
          </div>
        </div>

        {/* Size + Batch in a row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
              Size
            </label>
            <div className="relative">
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full appearance-none bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 pr-10 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all cursor-pointer"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
              Batch Number
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={batchNumber}
              onChange={(e) => setBatchNumber(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
            />
          </div>
        </div>

        {/* Quantity + MRP Override */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
            />
            <p className="text-[8px] text-foreground/30 mt-1 ml-1">Max 500 per batch</p>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
              MRP Override (₹)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={mrpOverride}
              onChange={(e) => setMrpOverride(parseFloat(e.target.value) || 0)}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
            />
          </div>
        </div>

        {/* Generic Name */}
        <div>
          <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
            Generic Name
          </label>
          <div className="relative">
            <select
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              className="w-full appearance-none bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 pr-10 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all cursor-pointer"
            >
              {GENERIC_NAMES.map((gn) => (
                <option key={gn} value={gn}>{gn}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
          </div>
        </div>

        {/* MFG Month/Year */}
        <div>
          <label className="block text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-2">
            MFG Month / Year
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <select
                value={mfgMonth}
                onChange={(e) => setMfgMonth(parseInt(e.target.value))}
                className="w-full appearance-none bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 pr-10 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all cursor-pointer"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
            </div>
            <input
              type="number"
              min={2024}
              max={2050}
              value={mfgYear}
              onChange={(e) => setMfgYear(parseInt(e.target.value) || now.getFullYear())}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl px-4 py-3 text-[12px] text-foreground focus:outline-none focus:border-foreground/20 transition-all"
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={!selectedProduct || isGenerating || quantity < 1}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-foreground text-background rounded-xl text-[11px] font-semibold uppercase tracking-[0.15em] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-foreground/10"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating {quantity} Tags...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate {quantity} Tags
            </>
          )}
        </button>
      </form>

      {/* ── Live Preview ── */}
      {previewTag && (
        <div className="pt-5 border-t border-foreground/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
            <h3 className="text-[9px] font-semibold text-foreground/50 uppercase tracking-[0.2em]">
              Live Preview
            </h3>
            <div className="flex-1 h-px bg-foreground/[0.05]" />
          </div>

          <div className="flex justify-center">
            <PriceTagCard tag={previewTag} isPreview />
          </div>

          {selectedProduct && (
            <div className="mt-4 p-3 bg-foreground/[0.02] rounded-xl border border-foreground/[0.05]">
              <div className="flex items-center gap-3">
                {selectedProduct.image && (
                  <img
                    src={selectedProduct.image.src}
                    alt={selectedProduct.title}
                    className="w-10 h-10 rounded-lg object-cover grayscale opacity-70"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-foreground truncate">{selectedProduct.title}</p>
                  <p className="text-[8px] text-foreground/40 mt-0.5">
                    {selectedProduct.product_type || 'No type'} • {selectedProduct.variants.length} variant{selectedProduct.variants.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
