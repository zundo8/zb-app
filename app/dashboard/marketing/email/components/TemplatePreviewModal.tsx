'use client';

function ensureDoctype(html: string): string {
  if (!html.includes('<!DOCTYPE html>')) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#000;">${html}</body></html>`;
  }
  return html;
}

export default function TemplatePreviewModal({ template, onClose, onUse }: { template: any, onClose: () => void, onUse: () => void }) {
  const renderedHtml = ensureDoctype(
    template.htmlBody
      .replace(/\{\{customerName\}\}/g, 'Aria')
      .replace(/\{\{orderId\}\}/g, 'ZB-10294')
      .replace(/\{\{totalPrice\}\}/g, '₹4,500')
      .replace(/\{\{total\}\}/g, '₹4,500 INR')
      .replace(/\{\{amount\}\}/g, '₹4,500')
      .replace(/\{\{customerEmail\}\}/g, 'aria@example.com')
      .replace(/\{\{orderDate\}\}/g, new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }))
      .replace(/\{\{orderStatusUrl\}\}/g, 'https://zicabella.com/orders/ZB-10294')
      .replace(/\{\{trackingUrl\}\}/g, 'https://zicabella.com/track?id=TRACK123')
      .replace(/\{\{trackingNumber\}\}/g, 'TRACK123')
      .replace(/\{\{courier\}\}/g, 'Delhivery')
      .replace(/\{\{courierName\}\}/g, 'Delhivery')
      .replace(/\{\{carrier\}\}/g, 'Delhivery')
      .replace(/\{\{reason\}\}/g, 'Requested by customer')
      .replace(/\{\{paymentMethod\}\}/g, 'Prepaid')
      .replace(/\{\{reviewUrl\}\}/g, 'https://zicabella.com/reviews')
      .replace(/\{\{itemsHtml\}\}/g, `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td width="88" valign="top" style="padding-right:16px;">
          <div style="width:88px; height:88px; background:#1a1a1a; border-radius:1px;"></div>
        </td>
        <td valign="middle" style="color:rgba(255,255,255,0.55); font-family:'DM Mono','Courier New',monospace;">
          <p style="margin:0 0 4px; font-size:11px; color:rgba(255,255,255,0.85);">Oversized Obsidian Blazer</p>
          <p style="margin:0 0 4px; font-size:10px; color:rgba(255,255,255,0.4);">Size M</p>
          <p style="margin:0; font-size:10px; color:rgba(255,255,255,0.4);">Qty: 1 &nbsp;·&nbsp; ₹4,500</p>
        </td>
      </tr>
    </table>
    <div style="height:1px; background:rgba(255,255,255,0.05); margin-bottom:16px;"></div>`)
      .replace(/\{\{collectionName\}\}/g, 'Midnight Mirage')
      .replace(/\{\{collectionEditorialLine\}\}/g, 'Effortless warmth, considered detail.')
      .replace(/\{\{collectionUrl\}\}/g, '#')
      .replace(/\{\{productsGrid\}\}/g, '<p style="color:rgba(255,255,255,0.3); font-family:\'DM Mono\',monospace; font-size:11px;">Collection preview loads on send.</p>')
      .replace(/\{\{[^}]+\}\}/g, '')
  );

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-[700px] flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161616] rounded-t-2xl">
          <div>
            <h2 className="text-base font-medium text-black dark:text-white">{template.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-black flex justify-center">
          <div className="bg-white w-[600px] max-w-full shadow-2xl overflow-hidden">
            <iframe
              title="Template Preview"
              srcDoc={renderedHtml}
              style={{ width: '100%', height: '640px', border: 'none', borderRadius: '4px', display: 'block' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-[#161616] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
            Close
          </button>
          <button onClick={onUse} className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-bold text-sm hover:bg-black/80 dark:hover:bg-gray-200 transition shadow-md">
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
}
