/**
 * PDF Export Utility for Price Tags
 * 
 * Uses jsPDF native drawing API to generate print-ready A4 PDFs or Thermal Labels.
 * Each tag is drawn directly (text, lines, images) for crisp output.
 * 
 * Layouts:
 * 1. A4 Portrait (210mm × 297mm) - Fits standard A4 sheet with 10mm margins.
 * 2. Thermal Label (50mm × 100mm) - Fits thermal labels (e.g. Toshiba BA400) with 3mm margins.
 */

import jsPDF from 'jspdf'
import type { TagData } from './skuGenerator'

// ── Layout constants ──────────────────────────────────────────
export type PDFLayoutType = 'a4' | 'thermal'

// ── Helper: load image as base64 data URL ─────────────────────
// SVG files are rasterized onto a high-res 512x512 canvas for crisp PDF rendering.
async function loadImageAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 512
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

// ── Helper: Draw vector Indian Rupee symbol next to MRP ───────
function drawRupeeVector(pdf: jsPDF, x: number, y: number, h: number) {
  const w = h * 0.70 // width is 70% of height
  const thick = h * 0.125 // bold line thickness (12.5% of height)
  
  pdf.setLineWidth(thick)
  pdf.setDrawColor(17, 17, 17)
  
  // 1. Vertical stem (located at 30% of width, only in upper half)
  const stemX = x + w * 0.3
  const stemEndY = y + h * 0.52
  pdf.line(stemX, y, stemX, stemEndY)
  
  // 2. Top horizontal bar
  pdf.line(x, y + thick/2, x + w, y + thick/2)
  
  // 3. Middle horizontal bar
  pdf.line(x, y + h * 0.30, x + w * 0.85, y + h * 0.30)
  
  // 4. Curved loop (upper-right loop)
  const loopTopY = y
  const loopBotY = stemEndY
  const loopRightX = x + w
  
  pdf.moveTo(stemX, loopTopY)
  pdf.curveTo(loopRightX, loopTopY, loopRightX, loopBotY, stemX, loopBotY)
  
  // 5. Diagonal leg (starts at bottom of loop and goes to bottom right)
  pdf.moveTo(stemX, loopBotY)
  pdf.lineTo(x + w * 0.85, y + h)
  
  pdf.stroke()
}

// ── Draw a single price tag ──────────────────────────────────
function drawTag(
  pdf: jsPDF,
  tag: TagData,
  x: number,
  y: number,
  logoDataUrl: string | null,
  layout: PDFLayoutType = 'a4'
) {
  const isThermal = layout === 'thermal'
  
  // Dimensions based on page layout
  const tagW = isThermal ? 44 : 190
  const tagH = isThermal ? 94 : 277
  const pad = isThermal ? 3 : 12
  const contentX = x + pad
  const contentW = tagW - 2 * pad
  const rightX = x + tagW - pad

  // ── No outer border for a clean full-page minimal look.
  let curY = y + pad + (isThermal ? 1.5 : 6)

  // ── Logo ──
  // Brand logo is 1:1 ratio. Render at 26mm × 26mm (A4) or 8mm × 8mm (Thermal).
  if (logoDataUrl) {
    const logoSize = isThermal ? 8 : 26
    const logoX = x + (tagW - logoSize) / 2
    try {
      pdf.addImage(logoDataUrl, 'PNG', logoX, curY, logoSize, logoSize)
    } catch {
      pdf.setFontSize(isThermal ? 8 : 24)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 30, 30)
      pdf.text('ZICA BELLA', x + tagW / 2, curY + (isThermal ? 4 : 12), { align: 'center' })
    }
    curY += logoSize + (isThermal ? 2.5 : 10)
  } else {
    pdf.setFontSize(isThermal ? 8 : 24)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text('ZICA BELLA', x + tagW / 2, curY + (isThermal ? 4 : 12), { align: 'center' })
    curY += isThermal ? 8 : 30
  }

  // ── MRP section with top border ──
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(isThermal ? 0.15 : 0.3)
  pdf.line(contentX, curY, rightX, curY)
  curY += isThermal ? 2.5 : 8

  pdf.setFontSize(isThermal ? 7.5 : 24)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(17, 17, 17)
  pdf.text('MRP', contentX, curY + (isThermal ? 2 : 6))

  // Align custom Rupee vector symbol with the baseline of text
  const priceValStr = tag.mrp.toLocaleString('en-IN')
  const priceW = pdf.getTextWidth(priceValStr)

  const rupeeH = isThermal ? 1.8 : 6.0
  const rupeeW = rupeeH * 0.70
  const gap = isThermal ? 0.6 : 2.0

  const rupeeX = rightX - priceW - rupeeW - gap
  const rupeeY = curY + (isThermal ? 2 : 6) - rupeeH

  drawRupeeVector(pdf, rupeeX, rupeeY, rupeeH)
  pdf.text(priceValStr, rightX, curY + (isThermal ? 2 : 6), { align: 'right' })
  curY += isThermal ? 4.5 : 14

  // "Inclusive of All Taxes"
  pdf.setFontSize(isThermal ? 3.5 : 10.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(140, 140, 140)
  pdf.text('INCLUSIVE OF ALL TAXES', contentX, curY + (isThermal ? 0.5 : 2))
  curY += isThermal ? 2.5 : 8

  // Bottom divider
  pdf.setDrawColor(220, 220, 220)
  pdf.line(contentX, curY, rightX, curY)
  curY += isThermal ? 3.5 : 12

  // ── Info rows ──
  const infoRows = [
    ['NET QUANTITY', tag.netQuantity || '1 Pc'],
    ['SIZE', tag.size],
    ['MFG & MKT BY', 'ZICA BELLA PVT. LTD.'],
    ['GENERIC NAME', tag.genericName],
    ['COUNTRY OF ORIGIN', 'INDIA'],
    ['CC', 'care@zicabella.com'],
    ['MFG ON', tag.mfgDate],
    ['EMAIL', 'support@zicabella.com'],
  ]

  const rowH = isThermal ? 3.1 : 11.5
  pdf.setFontSize(isThermal ? 4.2 : 12.5)

  for (const [label, value] of infoRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(80, 80, 80)
    pdf.text(label, contentX, curY + (isThermal ? 1.5 : 5))

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(17, 17, 17)
    
    // Truncate long values to fit
    const labelWidth = pdf.getTextWidth(label)
    const maxValW = contentW - labelWidth - (isThermal ? 2 : 6)
    let displayVal = value
    while (pdf.getTextWidth(displayVal) > maxValW && displayVal.length > 3) {
      displayVal = displayVal.slice(0, -1)
    }
    pdf.text(displayVal, rightX, curY + (isThermal ? 1.5 : 5), { align: 'right' })
    curY += rowH
  }

  curY += isThermal ? 1.5 : 4

  // ── QR separator ──
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(isThermal ? 0.15 : 0.3)
  pdf.line(contentX, curY, rightX, curY)
  curY += isThermal ? 2.5 : 10

  // ── QR Code ──
  if (tag.qrDataUrl && tag.qrDataUrl.startsWith('data:')) {
    const qrSize = isThermal ? 20 : 52
    const qrX = x + (tagW - qrSize) / 2
    try {
      pdf.addImage(tag.qrDataUrl, 'PNG', qrX, curY, qrSize, qrSize)
    } catch {
      // Skip if QR fails
    }
    curY += qrSize + (isThermal ? 1.5 : 6)
  } else {
    curY += isThermal ? 3 : 10
  }

  // ── SKU ──
  pdf.setFontSize(isThermal ? 4.2 : 13)
  pdf.setFont('courier', 'bold')
  pdf.setTextColor(50, 50, 50)
  pdf.text(tag.sku, x + tagW / 2, curY + (isThermal ? 1 : 3), { align: 'center' })
}

// ── Main export function ──────────────────────────────────────
export async function downloadTagsPDF(
  tags: TagData[],
  filename?: string,
  layout: PDFLayoutType = 'a4'
): Promise<void> {
  if (tags.length === 0) return

  const isThermal = layout === 'thermal'
  const pageFormat = isThermal ? [50, 100] : 'a4'
  
  const pdf = new jsPDF({ 
    unit: 'mm', 
    format: pageFormat, 
    orientation: 'portrait' 
  })

  // Pre-load the official circular SVG logo
  let logoDataUrl: string | null = null
  try {
    logoDataUrl = await loadImageAsDataURL('/ZB-logo-silver.svg')
  } catch {
    console.warn('Could not load logo for PDF, using text fallback')
  }

  const pageW = isThermal ? 50 : 210
  const pageH = isThermal ? 100 : 297
  const marginX = isThermal ? 3 : 10
  const marginY = isThermal ? 3 : 10

  const tagW = pageW - 2 * marginX
  const tagH = pageH - 2 * marginY

  for (let i = 0; i < tags.length; i++) {
    // Add a new page for each tag (except the first)
    if (i > 0) {
      pdf.addPage(pageFormat, 'portrait')
    }

    drawTag(pdf, tags[i], marginX, marginY, logoDataUrl, layout)
  }

  const outputFilename = filename || `zicabella-price-tags-${Date.now()}.pdf`
  pdf.save(outputFilename)
}

// ── Print helper: open printable PDF in new tab ───────────────
export async function printTagsPDF(
  tags: TagData[],
  layout: PDFLayoutType = 'a4'
): Promise<void> {
  if (tags.length === 0) return

  const isThermal = layout === 'thermal'
  const pageFormat = isThermal ? [50, 100] : 'a4'

  const pdf = new jsPDF({ 
    unit: 'mm', 
    format: pageFormat, 
    orientation: 'portrait' 
  })

  let logoDataUrl: string | null = null
  try {
    logoDataUrl = await loadImageAsDataURL('/ZB-logo-silver.svg')
  } catch {
    console.warn('Could not load logo for PDF print')
  }

  const pageW = isThermal ? 50 : 210
  const pageH = isThermal ? 100 : 297
  const marginX = isThermal ? 3 : 10
  const marginY = isThermal ? 3 : 10

  for (let i = 0; i < tags.length; i++) {
    if (i > 0) {
      pdf.addPage(pageFormat, 'portrait')
    }

    drawTag(pdf, tags[i], marginX, marginY, logoDataUrl, layout)
  }

  // Open in new tab for printing
  const pdfBlob = pdf.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.print()
      }, 500)
    })
  }
}
