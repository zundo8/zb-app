'use client'

import React from 'react'
import type { TagData } from '../utils/skuGenerator'

interface PriceTagCardProps {
  tag: TagData
  index?: number
  selected?: boolean
  onToggleSelect?: () => void
  showCheckbox?: boolean
  /** Renders a slightly larger version for the live preview panel */
  isPreview?: boolean
}

export default function PriceTagCard({
  tag,
  index,
  selected,
  onToggleSelect,
  showCheckbox,
  isPreview = false,
}: PriceTagCardProps) {
  const scale = isPreview ? 1.35 : 1

  return (
    <div
      className="price-tag-card relative"
      data-tag-index={index}
      style={{
        width: `${Math.round(190 * scale)}px`,
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #d0d0d0',
        borderRadius: '3px',
        padding: `${Math.round(10 * scale)}px ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px`,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: '#111',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        fontSize: `${Math.round(8 * scale)}px`,
        lineHeight: '1.35',
        pageBreakInside: 'avoid' as const,
        boxShadow: isPreview ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
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

      {/* Logo — rendered in square 1:1 ratio */}
      <div 
        className="logo-container"
        style={{ 
          marginBottom: `${Math.round(6 * scale)}px`, 
          textAlign: 'center' as const,
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <img
          className="logo-image"
          src="/zb-price-tag-logo.png"
          alt="Zica Bella"
          style={{
            height: `${Math.round(44 * scale)}px`,
            width: `${Math.round(44 * scale)}px`,
            objectFit: 'contain' as const,
            filter: 'grayscale(100%) contrast(200%)',
          }}
          crossOrigin="anonymous"
        />
      </div>

      {/* MRP Section */}
      <div 
        className="mrp-section"
        style={{
          width: '100%',
          padding: `${Math.round(4 * scale)}px 0`,
          borderTop: '0.5px solid #ccc',
          marginBottom: `${Math.round(3 * scale)}px`,
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          width: '100%',
        }}>
          <span 
            className="mrp-title"
            style={{
              fontWeight: 700,
              fontSize: `${Math.round(10 * scale)}px`,
              letterSpacing: '0.5px',
              textTransform: 'uppercase' as const,
            }}
          >
            MRP
          </span>
          <span 
            className="mrp-value"
            style={{
              fontWeight: 700,
              fontSize: `${Math.round(10 * scale)}px`,
              letterSpacing: '0.3px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: `${Math.round(8.5 * scale)}px`,
                height: `${Math.round(8.5 * scale)}px`,
                marginRight: `${Math.round(1 * scale)}px`,
                display: 'inline-block',
              }}
            >
              <path d="M6 3h12" />
              <path d="M6 8h12" />
              <path d="M6 3a5 5 0 0 1 5 5H6" />
              <path d="M6 8a5 5 0 0 1 5 5H6" />
              <path d="M6 13h5l4 7" />
            </svg>
            {tag.mrp.toLocaleString('en-IN')}
          </span>
        </div>
        <div 
          className="mrp-taxes"
          style={{
            fontSize: `${Math.round(5.5 * scale)}px`,
            color: '#888',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.6px',
            marginTop: `${Math.round(1 * scale)}px`,
          }}
        >
          Inclusive of All Taxes
        </div>
      </div>

      {/* Divider */}
      <div 
        className="tag-divider"
        style={{ width: '100%', height: '0.5px', backgroundColor: '#ccc', marginBottom: `${Math.round(4 * scale)}px` }} 
      />

      {/* Info Rows */}
      <div 
        className="info-rows"
        style={{ width: '100%', fontSize: `${Math.round(6.5 * scale)}px` }}
      >
        <InfoRow label="NET QUANTITY" value={tag.netQuantity} scale={scale} />
        <InfoRow label="SIZE" value={tag.size} scale={scale} />
        <InfoRow label="MFG & MKT BY" value="ZICA BELLA PVT. LTD." scale={scale} />
        <InfoRow label="GENERIC NAME" value={tag.genericName} scale={scale} />
        <InfoRow label="COUNTRY OF ORIGIN" value="INDIA" scale={scale} />
        <InfoRow label="CC" value="care@zicabella.com" scale={scale} />
        <InfoRow label="MFG ON" value={tag.mfgDate} scale={scale} />
        <InfoRow label="EMAIL" value="support@zicabella.com" scale={scale} />
      </div>

      {/* QR Code — always at the bottom */}
      <div 
        className="qr-section"
        style={{
          marginTop: `${Math.round(6 * scale)}px`,
          textAlign: 'center' as const,
          paddingTop: `${Math.round(4 * scale)}px`,
          borderTop: '0.5px solid #e0e0e0',
          width: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
        }}
      >
        {tag.qrDataUrl && tag.qrDataUrl.startsWith('data:') ? (
          <img
            className="qr-image"
            src={tag.qrDataUrl}
            alt={`QR: ${tag.sku}`}
            style={{
              width: `${Math.round(60 * scale)}px`,
              height: `${Math.round(60 * scale)}px`,
              imageRendering: 'pixelated' as const,
            }}
          />
        ) : (
          <div style={{
            width: `${Math.round(60 * scale)}px`,
            height: `${Math.round(60 * scale)}px`,
            border: '1px dashed #ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${Math.round(5 * scale)}px`,
            color: '#aaa',
          }}>
            QR Code
          </div>
        )}
      </div>

      {/* SKU — at the very bottom */}
      <div 
        className="sku-text"
        style={{
          marginTop: `${Math.round(3 * scale)}px`,
          fontSize: `${Math.round(6.5 * scale)}px`,
          fontWeight: 600,
          letterSpacing: '0.4px',
          textAlign: 'center' as const,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: '#333',
          wordBreak: 'break-all' as const,
        }}
      >
        {tag.sku}
      </div>
    </div>
  )
}

function InfoRow({ label, value, scale = 1 }: { label: string; value: string; scale?: number }) {
  return (
    <div 
      className="info-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: `${Math.round(1.5 * scale)}px 0`,
        gap: `${Math.round(6 * scale)}px`,
      }}
    >
      <span 
        className="info-row-label"
        style={{
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2px',
          color: '#333',
          whiteSpace: 'nowrap' as const,
          flexShrink: 0,
          fontSize: `${Math.round(6.5 * scale)}px`,
        }}
      >
        {label}
      </span>
      <span 
        className="info-row-value"
        style={{
          textAlign: 'right' as const,
          fontWeight: 500,
          color: '#111',
          wordBreak: 'break-word' as const,
          fontSize: `${Math.round(6.5 * scale)}px`,
        }}
      >
        {value}
      </span>
    </div>
  )
}
