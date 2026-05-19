'use client';

export default function TemplatePreviewModal({ template, onClose, onUse }: { template: any, onClose: () => void, onUse: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-[700px] flex flex-col h-[90vh] shadow-2xl">
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161616] rounded-t-2xl">
          <div>
            <h2 className="text-base font-medium text-black dark:text-white">{template.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-black flex justify-center">
          <div className="bg-white w-[600px] max-w-full shadow-2xl overflow-hidden h-full">
            <iframe
              title="Template Preview"
              srcDoc={
                template.htmlBody
                  .replace(/\{\{customerName\}\}/g, 'Aria')
                  .replace(/\{\{orderId\}\}/g, 'ZB-10294')
                  .replace(/\{\{totalPrice\}\}/g, '₹4,500')
                  .replace(/\{\{itemsHtml\}\}/g, `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(255,255,255,0.15); border-radius:2px; overflow:hidden; margin-bottom: 15px;">
          <tr>
            <td class="item-img" width="110" style="vertical-align:top; padding:0;">
              <img src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=220&q=80&auto=format&fit=crop" width="110" height="130" style="display:block; object-fit:cover; opacity:0.8;" alt="Mock Product" />
            </td>
            <td style="vertical-align:top; padding:20px 20px 20px 22px; border-left:1px solid rgba(255,255,255,0.1);">
              <p style="margin:0 0 4px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); text-transform:uppercase;">Qty: 1</p>
              <p style="margin:0 0 6px; font-family:'DM Serif Display',serif; font-size:17px; color:rgba(255,255,255,0.7); line-height:1.3;">Oversized Obsidian Blazer</p>
              <p style="margin:0 0 14px; font-family:'DM Mono',monospace; font-size:10px; color:rgba(255,255,255,0.3);">Size: M</p>
              <p style="margin:0; font-family:'DM Mono',monospace; font-size:12px; color:rgba(255,255,255,0.5);">₹4,500</p>
            </td>
          </tr>
        </table>
                  `)
                  .replace(/\{\{collectionName\}\}/g, 'Midnight Mirage')
              }
              className="w-full h-full border-none"
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
