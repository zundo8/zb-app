'use client'

import React from 'react'
import type { TagData } from '../utils/skuGenerator'

interface PriceTagCardProps {
  tag: TagData
  selected?: boolean
  onToggleSelect?: () => void
  showCheckbox?: boolean
}

export default function PriceTagCard({ tag, selected, onToggleSelect, showCheckbox }: PriceTagCardProps) {
  return (
    <div
      className="price-tag-card relative"
      style={{
        width: '200px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #000',
        borderRadius: '4px',
        padding: '12px 10px 10px',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontSize: '9px',
        lineHeight: '1.4',
        pageBreakInside: 'avoid',
      }}
    >
      {/* Checkbox for selection */}
      {showCheckbox && (
        <label
          className="absolute top-1.5 left-1.5 z-10 cursor-pointer no-print"
          style={{ position: 'absolute', top: '4px', left: '4px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ width: '14px', height: '14px', accentColor: '#000', cursor: 'pointer' }}
          />
        </label>
      )}

      {/* Logo */}
      <div style={{ marginBottom: '8px', textAlign: 'center' }}>
        <img
          src="/zb-logo-220px.png"
          alt="Zica Bella"
          style={{ height: '28px', objectFit: 'contain', filter: 'grayscale(100%) contrast(200%)' }}
          crossOrigin="anonymous"
        />
      </div>

      {/* MRP */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        width: '100%',
        padding: '4px 0',
      }}>
        <span style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}>MRP</span>
        <span style={{ fontWeight: 700, fontSize: '11px' }}>
          ₹ {tag.mrp.toLocaleString('en-IN')}
        </span>
      </div>
      <div style={{
        fontSize: '6.5px',
        color: '#555',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        textAlign: 'center',
        marginBottom: '6px',
      }}>
        Inclusive of All Taxes
      </div>

      {/* Divider */}
      <div style={{ width: '100%', height: '1px', backgroundColor: '#000', margin: '2px 0 6px' }} />

      {/* Info Rows */}
      <div style={{ width: '100%', fontSize: '7.5px' }}>
        <InfoRow label="NET QUANTITY" value={tag.netQuantity} />
        <InfoRow label="SIZE" value={tag.size} />
        <InfoRow label="MFG & MKT BY" value="ZICA BELLA PVT. LTD." />
        <InfoRow label="GENERIC NAME" value={tag.genericName} />
        <InfoRow label="COUNTRY OF ORIGIN" value="INDIA" />
        <InfoRow label="CC" value="care@zicabella.com" />
        <InfoRow label="MFG ON" value={tag.mfgDate} />
        <InfoRow label="EMAIL" value="support@zicabella.com" />
      </div>

      {/* QR Code */}
      <div style={{ marginTop: '8px', textAlign: 'center' }}>
        <img
          src={tag.qrDataUrl}
          alt={`QR: ${tag.sku}`}
          style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }}
        />
      </div>

      {/* SKU */}
      <div style={{
        marginTop: '4px',
        fontSize: '7.5px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        textAlign: 'center',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
      }}>
        {tag.sku}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '1.5px 0',
      gap: '8px',
    }}>
      <span style={{
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        color: '#333',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        textAlign: 'right',
        fontWeight: 500,
        color: '#000',
        wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  )
}
