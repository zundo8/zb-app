/**
 * PDF Export Utility for Price Tags
 * 
 * Uses jsPDF native drawing API to generate print-ready A4 PDFs.
 * Each tag is drawn directly (text, lines, images) for crisp output.
 * 
 * Layout: A4 portrait (210mm × 297mm)
 * - 1 tag per page (fits A4 fully)
 * - Tag size: 190mm × 277mm (fills usable page area with 10mm margins)
 * - Proper multi-page pagination (1 tag = 1 page)
 */

import jsPDF from 'jspdf'
import type { TagData } from './skuGenerator'

// ── Layout constants (all in mm) ──────────────────────────────
const PAGE_W = 210
const PAGE_H = 297
const MARGIN_X = 10
const MARGIN_Y = 10
const TAG_W = 190     // Fills the usable page width
const TAG_H = 277     // Fills the usable page height
const GAP_X = 0
const GAP_Y = 0

const COLS = 1
const ROWS = 1
const TAGS_PER_PAGE = 1

const OFFSET_X = MARGIN_X
const OFFSET_Y = MARGIN_Y

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
  const w = h * 0.72 // width is 72% of height
  const thick = h * 0.12 // bold line thickness (12% of height)
  
  pdf.setLineWidth(thick)
  pdf.setDrawColor(17, 17, 17)
  
  // 1. Vertical stem (located at 30% of width)
  const stemX = x + w * 0.3
  pdf.line(stemX, y, stemX, y + h)
  
  // 2. Top horizontal bar
  pdf.line(x, y + thick/2, x + w, y + thick/2)
  
  // 3. Middle horizontal bar
  pdf.line(x, y + h * 0.32, x + w * 0.9, y + h * 0.32)
  
  // 4. Curved loop (upper-right loop)
  const loopTopY = y
  const loopBotY = y + h * 0.55
  const loopRightX = x + w
  
  pdf.moveTo(stemX, loopTopY)
  pdf.curveTo(loopRightX, loopTopY, loopRightX, loopBotY, stemX, loopBotY)
  
  // 5. Diagonal leg (starts at stem intersection and goes to bottom right)
  pdf.moveTo(stemX + w * 0.05, loopBotY + h * 0.05)
  pdf.lineTo(x + w * 0.9, y + h)
  
  pdf.stroke()
}

// ── Draw a single price tag at (x, y) ────────────────────────
function drawTag(
  pdf: jsPDF,
  tag: TagData,
  x: number,
  y: number,
  logoDataUrl: string | null
) {
  const pad = 12  // mm padding inside the tag border
  const contentX = x + pad
  const contentW = TAG_W - 2 * pad
  const rightX = x + TAG_W - pad

  // ── No outer border for a clean full-page minimal look.
  let curY = y + pad + 6

  // ── Logo ──
  // Zica Bella SVG logo is 1:1 ratio. Render at 26mm × 26mm square.
  if (logoDataUrl) {
    const logoSize = 26
    const logoX = x + (TAG_W - logoSize) / 2
    try {
      pdf.addImage(logoDataUrl, 'PNG', logoX, curY, logoSize, logoSize)
    } catch {
      pdf.setFontSize(24)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 30, 30)
      pdf.text('ZICA BELLA', x + TAG_W / 2, curY + 12, { align: 'center' })
    }
    curY += logoSize + 10
  } else {
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text('ZICA BELLA', x + TAG_W / 2, curY + 12, { align: 'center' })
    curY += 30
  }

  // ── MRP section with top border ──
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.3)
  pdf.line(contentX, curY, rightX, curY)
  curY += 8

  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(17, 17, 17)
  pdf.text('MRP', contentX, curY + 6)

  // Align custom Rupee vector symbol with the baseline of text
  const priceValStr = tag.mrp.toLocaleString('en-IN')
  const priceW = pdf.getTextWidth(priceValStr)

  const rupeeH = 5.8
  const rupeeW = rupeeH * 0.72
  const gap = 2.0

  const rupeeX = rightX - priceW - rupeeW - gap
  const rupeeY = curY + 6 - rupeeH + 0.5 // Align base of Rupee with text baseline

  drawRupeeVector(pdf, rupeeX, rupeeY, rupeeH)
  pdf.text(priceValStr, rightX, curY + 6, { align: 'right' })
  curY += 14

  // "Inclusive of All Taxes"
  pdf.setFontSize(10.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(140, 140, 140)
  pdf.text('INCLUSIVE OF ALL TAXES', contentX, curY + 2)
  curY += 8

  // Bottom divider
  pdf.setDrawColor(220, 220, 220)
  pdf.line(contentX, curY, rightX, curY)
  curY += 12

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

  const rowH = 11.5
  pdf.setFontSize(12.5)

  for (const [label, value] of infoRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(80, 80, 80)
    pdf.text(label, contentX, curY + 5)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(17, 17, 17)
    
    // Truncate long values to fit
    const labelWidth = pdf.getTextWidth(label)
    const maxValW = contentW - labelWidth - 6
    let displayVal = value
    while (pdf.getTextWidth(displayVal) > maxValW && displayVal.length > 3) {
      displayVal = displayVal.slice(0, -1)
    }
    pdf.text(displayVal, rightX, curY + 5, { align: 'right' })
    curY += rowH
  }

  curY += 4

  // ── QR separator ──
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.3)
  pdf.line(contentX, curY, rightX, curY)
  curY += 10

  // ── QR Code ──
  if (tag.qrDataUrl && tag.qrDataUrl.startsWith('data:')) {
    const qrSize = 52
    const qrX = x + (TAG_W - qrSize) / 2
    try {
      pdf.addImage(tag.qrDataUrl, 'PNG', qrX, curY, qrSize, qrSize)
    } catch {
      // Skip if QR fails
    }
    curY += qrSize + 6
  } else {
    curY += 10
  }

  // ── SKU ──
  pdf.setFontSize(13)
  pdf.setFont('courier', 'bold')
  pdf.setTextColor(50, 50, 50)
  pdf.text(tag.sku, x + TAG_W / 2, curY + 3, { align: 'center' })
}

// ── Main export function ──────────────────────────────────────
export async function downloadTagsPDF(
  tags: TagData[],
  filename?: string
): Promise<void> {
  if (tags.length === 0) return

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Pre-load the official circular SVG logo
  let logoDataUrl: string | null = null
  try {
    logoDataUrl = await loadImageAsDataURL('/ZB-logo-silver.svg')
  } catch {
    console.warn('Could not load logo for PDF, using text fallback')
  }

  for (let i = 0; i < tags.length; i++) {
    const indexOnPage = i % TAGS_PER_PAGE

    // Add a new page for each tag (except the first)
    if (i > 0 && indexOnPage === 0) {
      pdf.addPage()
    }

    const col = indexOnPage % COLS
    const row = Math.floor(indexOnPage / COLS)

    const tagX = OFFSET_X + col * (TAG_W + GAP_X)
    const tagY = OFFSET_Y + row * (TAG_H + GAP_Y)

    drawTag(pdf, tags[i], tagX, tagY, logoDataUrl)
  }

  const outputFilename = filename || `zicabella-price-tags-${Date.now()}.pdf`
  pdf.save(outputFilename)
}

// ── Print helper: open printable PDF in new tab ───────────────
export async function printTagsPDF(tags: TagData[]): Promise<void> {
  if (tags.length === 0) return

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  let logoDataUrl: string | null = null
  try {
    logoDataUrl = await loadImageAsDataURL('/ZB-logo-silver.svg')
  } catch {
    console.warn('Could not load logo for PDF print')
  }

  for (let i = 0; i < tags.length; i++) {
    const indexOnPage = i % TAGS_PER_PAGE

    if (i > 0 && indexOnPage === 0) {
      pdf.addPage()
    }

    const col = indexOnPage % COLS
    const row = Math.floor(indexOnPage / COLS)

    const tagX = OFFSET_X + col * (TAG_W + GAP_X)
    const tagY = OFFSET_Y + row * (TAG_H + GAP_Y)

    drawTag(pdf, tags[i], tagX, tagY, logoDataUrl)
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

// ── Exported constants for UI display ─────────────────────────
export { TAGS_PER_PAGE, COLS, ROWS }
