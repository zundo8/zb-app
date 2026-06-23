/**
 * PDF Export Utility for Price Tags
 * 
 * Uses jsPDF native drawing API to generate print-ready A4 PDFs.
 * Each tag is drawn directly (text, lines, images) for crisp output.
 * 
 * Layout: A4 portrait (210mm × 297mm)
 * - 3 columns × 3 rows = 9 tags per page
 * - Tag size: 50mm × 82mm
 * - Proper multi-page pagination
 */

import jsPDF from 'jspdf'
import type { TagData } from './skuGenerator'

// ── Layout constants (all in mm) ──────────────────────────────
const PAGE_W = 210
const PAGE_H = 297
const MARGIN_X = 10
const MARGIN_Y = 10
const TAG_W = 50
const TAG_H = 82
const GAP_X = 5
const GAP_Y = 5

const USABLE_W = PAGE_W - 2 * MARGIN_X  // 190mm
const USABLE_H = PAGE_H - 2 * MARGIN_Y  // 277mm

const COLS = Math.floor((USABLE_W + GAP_X) / (TAG_W + GAP_X))  // 3
const ROWS = Math.floor((USABLE_H + GAP_Y) / (TAG_H + GAP_Y))  // 3
const TAGS_PER_PAGE = COLS * ROWS  // 9

// Center the grid horizontally
const GRID_W = COLS * TAG_W + (COLS - 1) * GAP_X
const OFFSET_X = MARGIN_X + (USABLE_W - GRID_W) / 2

// Center the grid vertically
const GRID_H = ROWS * TAG_H + (ROWS - 1) * GAP_Y
const OFFSET_Y = MARGIN_Y + (USABLE_H - GRID_H) / 2

// ── Helper: load image as base64 data URL ─────────────────────
async function loadImageAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

// ── Draw a single price tag at (x, y) ────────────────────────
function drawTag(
  pdf: jsPDF,
  tag: TagData,
  x: number,
  y: number,
  logoDataUrl: string | null
) {
  const pad = 2.5  // mm padding inside the tag border
  const contentX = x + pad
  const contentW = TAG_W - 2 * pad
  const rightX = x + TAG_W - pad

  // ── Outer border (subtle) ──
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.15)
  pdf.rect(x, y, TAG_W, TAG_H)

  let curY = y + pad

  // ── Logo ──
  if (logoDataUrl) {
    const logoH = 4.5
    const logoW = 16
    const logoX = x + (TAG_W - logoW) / 2
    try {
      pdf.addImage(logoDataUrl, 'PNG', logoX, curY, logoW, logoH)
    } catch {
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 30, 30)
      pdf.text('ZICA BELLA', x + TAG_W / 2, curY + 3, { align: 'center' })
    }
    curY += logoH + 2
  } else {
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text('ZICA BELLA', x + TAG_W / 2, curY + 3, { align: 'center' })
    curY += 6
  }

  // ── MRP section with top/bottom border ──
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.1)
  pdf.line(contentX, curY, rightX, curY)  // top line
  curY += 1.5

  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(17, 17, 17)
  pdf.text('MRP', contentX, curY + 2.5)

  const mrpStr = `\u20B9 ${tag.mrp.toLocaleString('en-IN')}`
  pdf.text(mrpStr, rightX, curY + 2.5, { align: 'right' })
  curY += 4.5

  // "Inclusive of All Taxes"
  pdf.setFontSize(4)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(140, 140, 140)
  pdf.text('INCLUSIVE OF ALL TAXES', x + TAG_W / 2, curY + 1, { align: 'center' })
  curY += 2.5

  pdf.setDrawColor(200, 200, 200)
  pdf.line(contentX, curY, rightX, curY)  // bottom line
  curY += 2

  // ── Info rows (matching card design) ──
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

  const rowH = 3
  pdf.setFontSize(4.5)

  for (const [label, value] of infoRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(100, 100, 100)
    pdf.text(label, contentX, curY + 1.8)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(17, 17, 17)
    // Truncate long values to fit
    const labelWidth = pdf.getTextWidth(label)
    const maxValW = contentW - labelWidth - 2
    let displayVal = value
    while (pdf.getTextWidth(displayVal) > maxValW && displayVal.length > 3) {
      displayVal = displayVal.slice(0, -1)
    }
    pdf.text(displayVal, rightX, curY + 1.8, { align: 'right' })
    curY += rowH
  }

  curY += 0.5

  // ── QR separator line ──
  pdf.setDrawColor(224, 224, 224)
  pdf.setLineWidth(0.1)
  pdf.line(contentX, curY, rightX, curY)
  curY += 1.5

  // ── QR Code ──
  if (tag.qrDataUrl && tag.qrDataUrl.startsWith('data:')) {
    const qrSize = 13
    const qrX = x + (TAG_W - qrSize) / 2
    try {
      pdf.addImage(tag.qrDataUrl, 'PNG', qrX, curY, qrSize, qrSize)
    } catch {
      // Skip if QR fails
    }
    curY += qrSize + 0.8
  } else {
    curY += 2
  }

  // ── SKU ──
  pdf.setFontSize(4.5)
  pdf.setFont('courier', 'bold')
  pdf.setTextColor(50, 50, 50)
  pdf.text(tag.sku, x + TAG_W / 2, curY + 1.5, { align: 'center' })
}

// ── Main export function ──────────────────────────────────────
export async function downloadTagsPDF(
  tags: TagData[],
  filename?: string
): Promise<void> {
  if (tags.length === 0) return

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Pre-load the logo once
  let logoDataUrl: string | null = null
  try {
    logoDataUrl = await loadImageAsDataURL('/zb-logo-220px.png')
  } catch {
    console.warn('Could not load logo for PDF, using text fallback')
  }

  for (let i = 0; i < tags.length; i++) {
    const indexOnPage = i % TAGS_PER_PAGE

    // Add a new page for each batch (except the first)
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
    logoDataUrl = await loadImageAsDataURL('/zb-logo-220px.png')
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
