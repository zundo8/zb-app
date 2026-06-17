/**
 * PDF Export Utility for Price Tags
 * Uses jsPDF and html2canvas to generate print-ready A4 PDFs
 * Layout: 4 tags per row, 2 rows per page = 8 tags per A4 page
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function downloadTagsPDF(
  tagElements: HTMLElement[],
  filename?: string
): Promise<void> {
  if (tagElements.length === 0) return

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const tagsPerRow = 4
  const rowsPerPage = 2
  const tagsPerPage = tagsPerRow * rowsPerPage
  const tagW = 47
  const tagH = 78
  const marginX = 5
  const marginY = 5
  const gapX = 3
  const gapY = 3

  for (let i = 0; i < tagElements.length; i++) {
    const canvas = await html2canvas(tagElements[i], {
      scale: 3,
      backgroundColor: '#FFFFFF',
      logging: false,
      useCORS: true,
    })

    const imgData = canvas.toDataURL('image/png')
    const col = i % tagsPerRow
    const row = Math.floor((i % tagsPerPage) / tagsPerRow)

    if (i > 0 && i % tagsPerPage === 0) {
      pdf.addPage()
    }

    const x = marginX + col * (tagW + gapX)
    const y = marginY + row * (tagH + gapY)
    pdf.addImage(imgData, 'PNG', x, y, tagW, tagH)
  }

  const outputFilename = filename || `zicabella-price-tags-${Date.now()}.pdf`
  pdf.save(outputFilename)
}
